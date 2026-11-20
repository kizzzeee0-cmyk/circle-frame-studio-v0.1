import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {readArchive} from '../project-archive.mjs';
import {setTimeout as delay} from 'node:timers/promises';

initializeCanvas(createCanvas);
const fill=(w,h,r,g,b)=>{
  const data=new Uint8Array(w*h*4);
  for(let i=0;i<data.length;i+=4){data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;}
  return {width:w,height:h,data};
};
const doc=writePsd({
  width:64,height:48,imageData:fill(64,48,18,175,150),
  children:[
    {name:'Heart',left:5,top:6,right:30,bottom:30,imageData:fill(25,24,235,70,105)},
    {name:'Background',left:0,top:0,right:64,bottom:48,imageData:fill(64,48,244,238,222)}
  ]
});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4188','--strictPort'],{stdio:'pipe'});
let browser;
try {
  let ready=false;
  for(let i=0;i<50;i++){
    if(server.exitCode!==null)throw Error('Vite preview stopped before startup');
    try {if((await fetch('http://127.0.0.1:4188/')).ok){ready=true;break;}}catch{}
    await delay(350);
  }
  if(!ready)throw Error('KIZE preview did not start');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1480,height:940},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:4188/',{waitUntil:'networkidle'});
  await page.locator('#importFile').setInputFiles({name:'original.psd',mimeType:'application/octet-stream',buffer:Buffer.from(doc)});
  await page.waitForFunction(()=>/불러오기 완료/.test(document.querySelector('#importReport')?.textContent||''),null,{timeout:60000});
  const current=async(x,y)=>page.evaluate(([x,y])=>Array.from(document.querySelector('#renderCanvas').getContext('2d').getImageData(x,y,1,1).data),[x,y]);
  assert.deepEqual(await current(50,35),[18,175,150,255],'PSD merged reference stays exact before edit');

  await page.locator('.layer').filter({hasText:'Heart'}).click();
  await page.locator('#selectionMode').selectOption('color');
  await page.locator('#preserveShading').uncheck();
  const rect=await page.locator('#overlayCanvas').boundingBox();
  await page.mouse.click(rect.x+12*rect.width/64,rect.y+14*rect.height/48);
  await page.locator('#targetColor').fill('#4466cc');
  await page.locator('#applyColor').click();
  assert.deepEqual(await current(12,14),[68,102,204,255],'Layer-local recolor should apply');
  assert.deepEqual(await current(50,35),[18,175,150,255],
    'Original merged pixels outside selected color area must remain untouched');
  assert.match(await page.locator('#dirtyStatus').textContent(),/저장되지/);
  await page.locator('#undo').click();
  assert.deepEqual(await current(12,14),[18,175,150,255],
    'Undo must restore the original Photoshop stored merged appearance, not naive red raw layer pixels');
  await page.locator('#redo').click();
  assert.deepEqual(await current(12,14),[68,102,204,255],'Redo restores chosen color');

  const [save]=await Promise.all([
    page.waitForEvent('download',{timeout:60000}),
    page.locator('#saveProject').click()
  ]);
  assert.ok(save.suggestedFilename().endsWith('.kize'),'New compact project extension');
  const bytes=await readFile(await save.path());
  const archive=readArchive(new Uint8Array(bytes));
  assert.equal(archive.manifest.layers.length,2);
  assert.equal(archive.manifest.edited,true);
  assert.equal(archive.manifest.composite,'reference/psd-merged.png');
  assert.match(await page.locator('#dirtyStatus').textContent(),/저장됨/);

  await page.locator('#importFile').setInputFiles({
    name:'roundtrip.kize',mimeType:'application/octet-stream',buffer:bytes
  });
  await page.waitForFunction(()=>/프로젝트를 불러왔습니다/.test(document.querySelector('#status')?.textContent||''),null,{timeout:60000});
  assert.deepEqual(await current(12,14),[68,102,204,255],'Edited raster survives archive reopen exactly');
  await page.locator('#viewComposite').click();
  assert.deepEqual(await current(50,35),[18,175,150,255],'Saved Photoshop composite reference survives reopen exactly');
  await page.locator('#viewLayers').click();
  const [pngSave]=await Promise.all([
    page.waitForEvent('download',{timeout:60000}),
    page.locator('#exportPng').click()
  ]);
  const output=await readFile(await pngSave.path());
  assert.deepEqual(Array.from(output.subarray(0,8)),[137,80,78,71,13,10,26,10],
    'Export must remain PNG and not silently flatten the project archive');
  assert.deepEqual(errors,[],'No browser exceptions');
  console.log('PASS: PSD exact merged pixels, layer recolor, undo/redo, KIZE archive, reopen, final PNG export.');
} finally {
  if(browser)await browser.close();
  server.kill();
}
