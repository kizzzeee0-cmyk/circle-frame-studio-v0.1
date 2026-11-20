import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {createCanvas} from '@napi-rs/canvas';
import {writePsd,initializeCanvas} from 'ag-psd';
import {chromium} from 'playwright-core';
import {pastelizeHex} from '../color-workflow.mjs';
initializeCanvas(createCanvas);

const w=128,h=96;
const art=createCanvas(w,h),ctx=art.getContext('2d');
const pixels=ctx.createImageData(w,h);
function colorAt(x,y){
  if((x<12||y<12)&&y<h-12)return [190,160,210,255]; // lavender
  if(x>=w-12&&y>=12)return [150,195,120,255]; // green
  if(y>=h-12)return [235,186,174,255]; // peach
  if(x>=56&&x<72&&y>=38&&y<54)return [231,207,143,255]; // sticker
  return [0,0,0,0];
}
for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixels.data.set(colorAt(x,y),4*(y*w+x));
ctx.putImageData(pixels,0,0);
const png=art.toBuffer('image/png');
const psd=writePsd({width:w,height:h,imageData:{width:w,height:h,data:pixels.data},
  children:[{name:'Lavender sticker frame',left:0,top:0,right:w,bottom:h,
    imageData:{width:w,height:h,data:pixels.data}}]});
const host='http://127.0.0.1:4198/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
  '--host','127.0.0.1','--port','4198','--strictPort'],{stdio:'pipe'});
let browser;
try{
  let ready=false;
  for(let t=0;t<60;t++){if(server.exitCode!==null)throw Error('Vite preview failed');
    try{if((await fetch(host)).ok){ready=true;break;}}catch{}
    await pause(250);
  }
  if(!ready)throw Error('Vite preview timeout');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1500,height:950}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(host,{waitUntil:'networkidle'});
  const pix=(x,y)=>page.evaluate(([x,y])=>Array.from(
    document.querySelector('#renderCanvas').getContext('2d').getImageData(x,y,1,1).data),[x,y]);
  const click=async(x,y)=>{
    const box=await page.locator('#overlayCanvas').boundingBox();
    await page.mouse.click(box.x+(x+.5)*box.width/w,box.y+(y+.5)*box.height/h);
  };
  await page.locator('#importFile').setInputFiles({name:'soft-sticker.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>document.querySelector('#docInfo').textContent.includes('IMAGE'));
  assert.equal(await page.locator('#selectionMode').inputValue(),'color',
    'PNG starts with precise color-only selection');
  assert.equal(await page.locator('#selectedLayerOnly').isChecked(),false,
    'PNG allows picking actual visible item without locking a layer');
  await click(6,25);
  const info=await page.locator('#selectionInfo').textContent();
  assert.match(info,/픽셀 선택/);
  const picked=Number((info.match(/[\d,]+개 픽셀/)||['0'])[0].replace(/[^0-9]/g,''));
  assert.ok(picked>10&&picked<1000,'Click must not select the entire frame: '+info);
  assert.deepEqual(await pix(121,25),[150,195,120,255]);

  await page.locator('#targetHex').fill('#AA6688');
  await page.locator('#targetHex').press('Tab');
  assert.equal(await page.locator('#targetColor').inputValue(),'#aa6688');
  assert.equal(await page.locator('#effectiveColorText').textContent(),'#AA6688');
  assert.deepEqual(await pix(6,25),[190,160,210,255],'before preview is untouched');
  await page.locator('#previewColor').click();
  assert.deepEqual(await pix(6,25),[170,102,136,255],'Preview shows exact user HEX');
  assert.deepEqual(await pix(121,25),[150,195,120,255],'Other colors are protected');
  await page.locator('#previewColor').click();
  assert.deepEqual(await pix(6,25),[190,160,210,255],'Preview is reversible without editing');
  await page.locator('#applyColor').click();
  assert.deepEqual(await pix(6,25),[170,102,136,255],'Apply commits exact chosen HEX');
  assert.deepEqual(await pix(121,25),[150,195,120,255],'Green remains untouched');
  await page.locator('#undo').click();
  assert.deepEqual(await pix(6,25),[190,160,210,255],'Undo restores original PNG');

  await click(6,25);
  await page.locator('#colorFinish').selectOption('pastel');
  await page.locator('#targetColor').fill('#CD5666');
  await page.locator('#pastelSoftnessNumber').fill('55');
  await page.locator('#pastelSoftnessNumber').press('Tab');
  const pastel=pastelizeHex('#CD5666',55);
  assert.equal(await page.locator('#effectiveColorText').textContent(),pastel);
  await page.locator('#previewColor').click();
  const expected=[parseInt(pastel.slice(1,3),16),parseInt(pastel.slice(3,5),16),parseInt(pastel.slice(5,7),16),255];
  assert.deepEqual(await pix(6,25),expected,'Pastel preview matches displayed HEX precisely');
  await page.locator('#previewColor').click();
  await page.locator('.variant-details summary').click();
  assert.ok((await page.locator('#variantPreset option').count())>=31);
  await page.locator('#variantPreset').selectOption({label:'버터옐로우 · 연두 · 크림'});
  assert.equal(await page.locator('#variantSwatches .variant-swatch').count(),3);
  assert.match(await page.locator('#variantSummary').textContent(),/HEX 그대로/);
  await page.locator('#numExposure').fill('35');
  await page.locator('#numExposure').press('Tab');
  assert.equal(await page.locator('[data-adjust="exposure"]').inputValue(),'35');
  await page.locator('[data-adjust="exposure"]').fill('10');
  assert.equal(await page.locator('#numExposure').inputValue(),'10');
  await page.locator('#resetAdjust').click();
  assert.equal(await page.locator('#numExposure').inputValue(),'0');

  // PSD one-click automatic layer choice + Photoshop composite mode.
  await page.locator('#importFile').setInputFiles({name:'frame.psd',mimeType:'application/octet-stream',buffer:Buffer.from(psd)});
  await page.waitForFunction(()=>/불러오기 완료/.test(
    document.querySelector('#importReport')?.textContent||''),null,{timeout:60000});
  assert.equal(await page.locator('#selectedLayerOnly').isChecked(),false);
  assert.equal(await page.locator('#selectionMode').inputValue(),'color');
  await click(6,25);
  await page.locator('#colorFinish').selectOption('exact');
  await page.locator('#targetColor').fill('#AABBCC');
  await page.locator('#applyColor').click();
  assert.deepEqual(await pix(6,25),[170,187,204,255],
    'Actual Photoshop merged preview must visibly update to the requested exact HEX');
  assert.deepEqual(await pix(121,25),[150,195,120,255]);
  assert.deepEqual(errors,[],'No browser JavaScript errors');
  console.log('PASS: precise PNG click, non-destructive preview, exact HEX, pastel preview, 30 presets, numeric photo edits, PSD visible recolor.');
}finally{if(browser)await browser.close();server.kill();}
