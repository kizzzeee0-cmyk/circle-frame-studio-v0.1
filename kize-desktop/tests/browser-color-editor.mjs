import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {setTimeout as delay} from 'node:timers/promises';

initializeCanvas(createCanvas);
const pixels=(w,h,fn)=>{
  const data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const color=fn(x,y),p=(y*w+x)*4;
    data.set(color,p);
  }
  return {width:w,height:h,data};
};
const bg=pixels(128,96,()=>[250,245,231,255]);
const asset=pixels(68,68,(x,y)=>x<36?[234,80,100,255]:[60,110,230,255]);
const composited=pixels(128,96,(x,y)=>{
  if(x>=12&&x<80&&y>=10&&y<78)return x-12<36?[234,80,100,255]:[60,110,230,255];
  return [250,245,231,255];
});
const fixture=writePsd({width:128,height:96,imageData:composited,children:[
  {name:'Color asset',left:12,top:10,right:80,bottom:78,imageData:asset},
  {name:'Background',left:0,top:0,right:128,bottom:96,imageData:bg},
]});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4180','--strictPort'],{stdio:'pipe'});
let browser;
try{
  let ready=false;for(let i=0;i<50;i++){
    if(server.exitCode!==null)throw Error('Preview server failed: '+server.exitCode);
    try{if((await fetch('http://127.0.0.1:4180/')).ok){ready=true;break;}}catch{}
    await delay(300);
  }
  if(!ready)throw Error('Vite preview did not start');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4180/',{waitUntil:'networkidle'});
  await page.locator('#importFile').setInputFiles({name:'colors.psd',mimeType:'application/octet-stream',buffer:Buffer.from(fixture)});
  await page.waitForFunction(()=>/불러오기 완료/.test(document.querySelector('#importReport')?.textContent||''),null,{timeout:60000});
  assert.equal(await page.locator('#layerCount').textContent(),'2');
  assert.equal(await page.locator('#selectedLayerOnly').isChecked(),false,'new default uses automatic PSD layer detection');
  await page.locator('.layer').filter({hasText:'Color asset'}).click();
  const layerInfo=await page.locator('#activeLayerInfo').textContent();
  assert.match(layerInfo,/Color asset/);
  const art=await page.locator('#overlayCanvas').boundingBox();
  async function clickPixel(x,y){await page.mouse.click(art.x+x,art.y+y);}
  const getPixel=async(x,y)=>page.evaluate(([x,y])=>Array.from(
    document.querySelector('#renderCanvas').getContext('2d').getImageData(x,y,1,1).data),[x,y]);
  await clickPixel(23,26); // Red on currently selected layer, not the background layer.
  await page.waitForFunction(()=>Number.parseInt((document.querySelector('#selectionInfo')?.textContent||'').replace(/[^0-9]/g,''),10)>0);
  assert.equal((await page.locator('#pickedHex').inputValue()).toUpperCase(),'#EA5064');
  const meta=await page.locator('#selectionInfo').textContent();
  assert.match(meta,/픽셀/);
  const beforeBlue=await getPixel(71,26),beforeBg=await getPixel(110,26);
  await page.locator('#preserveShading').uncheck();
  await page.locator('#targetColor').fill('#25bc83');
  await page.locator('#applyColor').click();
  const green=await getPixel(23,26);
  assert.deepEqual(green,[37,188,131,255],'Only picked red part should turn green');
  assert.deepEqual(await getPixel(71,26),beforeBlue,'Same layer blue part stays unchanged');
  assert.deepEqual(await getPixel(110,26),beforeBg,'Other layer stays unchanged');
  await page.locator('#undo').click();
  assert.deepEqual(await getPixel(23,26),[234,80,100,255],'Undo must restore source pixels');
  await clickPixel(23,26);
  await page.locator('#colorMode').selectOption('gradient');
  const colors=page.locator('#gradientStops input[type=color]');
  await colors.nth(0).fill('#ff0000');
  await colors.nth(1).fill('#0000ff');
  const positions=page.locator('#gradientStops input[type=number]');
  await positions.nth(0).fill('20');await positions.nth(0).press('Tab');
  await positions.nth(1).fill('85');await positions.nth(1).press('Tab');
  await page.locator('#gradientAngle').fill('90');
  const preview=await page.locator('#gradientPreview').evaluate(e=>e.style.background);
  assert.match(preview,/20%/);assert.match(preview,/85%/);
  await page.locator('#applyColor').click();
  const left=await getPixel(16,26),right=await getPixel(44,26);
  assert.ok(left[0]>left[2]+120,'Gradient start should be red: '+left);
  assert.ok(right[2]>right[0]+100,'Gradient end should be blue: '+right);
  assert.deepEqual(await getPixel(71,26),beforeBlue);
  assert.deepEqual(await getPixel(110,26),beforeBg);
  assert.deepEqual(errors,[],'No JS errors');
  console.log('PASS: PSD active-layer color pick excludes background and unrelated colors.');
  console.log('PASS: Solid replacement, undo, editable gradient stops and stop percentages.');
} finally {
  if(browser)await browser.close();
  server.kill();
}
