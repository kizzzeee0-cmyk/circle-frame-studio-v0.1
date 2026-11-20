import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {setTimeout as delay} from 'node:timers/promises';
import {readArchive} from '../project-archive.mjs';

initializeCanvas(createCanvas);
const rgba=(w,h,fn)=>{
  const data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),4*(y*w+x));
  return {width:w,height:h,data};
};
// Deliberately inconsistent: the source Photoshop merged pixels include
// effects and colors NOT represented by its raw red raster layer.
const original=rgba(68,56,(x,y)=>{
  if(x>=50&&y>=42)return [0,0,0,0];
  return [18+x%9,167+y%15,150,255];
});
const sourceLayer=rgba(30,28,()=>[240,66,91,255]);
const doc=writePsd({
  width:68,height:56,imageData:original,
  children:[
    {name:'PSD Styled Graphic',left:7,top:8,right:37,bottom:36,imageData:sourceLayer},
    {name:'Background',left:0,top:0,right:68,bottom:56,imageData:rgba(68,56,()=>[252,250,241,255])}
  ]
});
const host='http://127.0.0.1:4189/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4189','--strictPort'],{stdio:'pipe'});
let browser;
try{
  let started=false;
  for(let i=0;i<50;i++){
    if(server.exitCode!==null)throw Error('Vite server exited before PSD appearance test');
    try{if((await fetch(host)).ok){started=true;break;}}catch{}
    await delay(350);
  }
  if(!started)throw Error('Vite appearance preview failed to start');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1480,height:930},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(host,{waitUntil:'networkidle'});
  await page.locator('#importFile').setInputFiles({name:'styled.psd',mimeType:'application/octet-stream',buffer:Buffer.from(doc)});
  await page.waitForFunction(()=>/불러오기 완료/.test(document.querySelector('#importReport')?.textContent||''),null,{timeout:60000});
  const pixel=async(x,y)=>page.evaluate(([x,y])=>Array.from(
    document.querySelector('#renderCanvas').getContext('2d').getImageData(x,y,1,1).data),[x,y]);
  const at=(x,y)=>Array.from(original.data.slice((y*68+x)*4,(y*68+x)*4+4));
  assert.deepEqual(await pixel(15,16),at(15,16),'Initial Photoshop merged content must be exact');
  assert.deepEqual(await pixel(55,48),[0,0,0,0],'Transparent area stays transparent');

  await page.locator('.layer').filter({hasText:'PSD Styled Graphic'}).click();
  await page.locator('#selectionMode').selectOption('color');
  await page.locator('#preserveShading').uncheck();
  const r=await page.locator('#overlayCanvas').boundingBox();
  await page.mouse.click(r.x+15.5*r.width/68,r.y+16.5*r.height/56);
  assert.ok(await page.locator('#viewAppearance').evaluate(e=>e.classList.contains('selected')),
    'Clicking an individual PSD layer should not force broken raster reconstruction');
  assert.deepEqual(await pixel(15,16),at(15,16),'Selecting color must not disturb original merged pixels');
  await page.locator('#targetColor').fill('#A87AD7');
  await page.locator('#applyColor').click();
  assert.deepEqual(await pixel(15,16),[168,122,215,255],'Selected Photoshop appearance pixel changes');
  assert.deepEqual(await pixel(44,18),at(44,18),'Unselected original pixel unchanged');
  assert.deepEqual(await pixel(15,45),at(15,45),'Original backdrop untouched');
  assert.deepEqual(await pixel(55,48),[0,0,0,0],'Alpha/transparent border unchanged');
  assert.match(await page.locator('#previewStatus').textContent(),/외관 보존/);
  await page.locator('#undo').click();
  assert.deepEqual(await pixel(15,16),at(15,16),'Undo returns to original Photoshop MERGED appearance');
  await page.locator('#redo').click();
  assert.deepEqual(await pixel(15,16),[168,122,215,255],'Redo returns to exact desired color');

  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.locator('#saveProject').click()]);
  const archive=readArchive(new Uint8Array(await readFile(await dl.path())));
  assert.equal(archive.manifest.appearancePatches.length,1);
  assert.equal(archive.manifest.previewMode,'appearance');
  assert.equal(archive.manifest.appearanceSafe,true);
  await page.locator('#importFile').setInputFiles({name:'appearance.kize',
    mimeType:'application/octet-stream',buffer:await readFile(await dl.path())});
  await page.waitForFunction(()=>/프로젝트를 불러왔습니다/.test(document.querySelector('#status')?.textContent||''),null,{timeout:60000});
  assert.deepEqual(await pixel(15,16),[168,122,215,255],'Appearance edit survives project round-trip');
  assert.deepEqual(await pixel(44,18),at(44,18),'Untouched reference survives round-trip');
  await page.locator('#viewComposite').click();
  assert.deepEqual(await pixel(15,16),at(15,16),'Before view still shows original Photoshop pixels');
  await page.locator('#viewAppearance').click();
  assert.deepEqual(await pixel(15,16),[168,122,215,255],'After view correctly restores the edit');
  assert.deepEqual(errors,[],'No unexpected browser errors');
  console.log('PASS: Photoshop composite selected edits exact; unselected pixels+alpha unchanged; undo, redo and .kize round-trip.');
}finally{if(browser)await browser.close();server.kill();}
