import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {setTimeout as sleep} from 'node:timers/promises';
initializeCanvas(createCanvas);
const create=(w,h,fn)=>{
  const data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),4*(y*w+x));
  return {width:w,height:h,data};
};
const w=160,h=130;
const sticker=create(w,h,(x,y)=>{
  if(y<10||y>=46)return [0,0,0,0];
  let a=0;
  if(x>=10&&x<46)a=1;
  if(x>=90&&x<126)a=1;
  if(!a)return [0,0,0,0];
  if(y===24&&x>=24&&x<=30)return [255,255,255,255];
  if(x===10||x===90)return [5,5,5,255];
  if(y===11)return [96,122,50,255];
  return [170,200,70,255];
});
const badge=create(45,35,()=>[75,130,230,255]);
const bg=create(w,h,()=>[248,245,235,255]);
const composited=create(w,h,(x,y)=>{
  const stickerPos=(y*w+x)*4;
  if(sticker.data[stickerPos+3])return Array.from(sticker.data.slice(stickerPos,stickerPos+4));
  if(x>=65&&x<110&&y>=65&&y<100)return [75,130,230,255];
  return [248,245,235,255];
});
const fixture=writePsd({width:w,height:h,imageData:composited,children:[
  {name:'Stickers',left:0,top:0,right:w,bottom:h,imageData:sticker},
  {name:'Badge',left:65,top:65,right:110,bottom:100,imageData:badge},
  {name:'Background',left:0,top:0,right:w,bottom:h,imageData:bg}
]});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4181','--strictPort'],{stdio:'pipe'});
let browser;
try{
  let ready=false;
  for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error('Vite preview server crashed');
    try{if((await fetch('http://127.0.0.1:4181/')).ok){ready=true;break;}}catch{}
    await sleep(250);
  }
  if(!ready)throw Error('Vite preview did not start');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1490,height:940}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4181/',{waitUntil:'networkidle'});
  await page.locator('#importFile').setInputFiles({name:'two-stickers.psd',mimeType:'application/octet-stream',buffer:Buffer.from(fixture)});
  await page.waitForFunction(()=>/불러오기 완료/.test(document.querySelector('#importReport')?.textContent||''),null,{timeout:60000});
  assert.equal(await page.locator('#layerCount').textContent(),'3');
  assert.equal(await page.locator('#selectionMode').inputValue(),'asset');
  await page.locator('.layer').filter({hasText:'Stickers'}).click();
  const artwork=()=>page.locator('#overlayCanvas').boundingBox();
  async function clickAt(x,y,modifiers=[]){
    const r=await artwork(),cx=r.x+x*r.width/w,cy=r.y+y*r.height/h;
    for(const m of modifiers)await page.keyboard.down(m);
    await page.mouse.click(cx,cy);
    for(const m of modifiers)await page.keyboard.up(m);
  }
  const pixel=(x,y)=>page.evaluate(([x,y])=>Array.from(
    document.querySelector('#renderCanvas').getContext('2d').getImageData(x,y,1,1).data),[x,y]);
  await clickAt(18,24);
  assert.match(await page.locator('#selectionPartsCount').textContent(),/1개/);
  await clickAt(104,24,['Shift']);
  assert.match(await page.locator('#selectionPartsCount').textContent(),/2개/);
  const selectedBefore=await page.locator('#selectionInfo').textContent();
  await page.locator('#maskAdjust').fill('2');
  const selectedAfter=await page.locator('#selectionInfo').textContent();
  assert.notEqual(selectedAfter,selectedBefore,'Mask expand should visibly change selected pixel count');
  await page.locator('#maskAdjust').fill('0');
  await page.locator('#targetColor').fill('#9389de');
  assert.equal(await page.locator('#assetTint').isChecked(),true);
  assert.equal(await page.locator('#protectWhite').isChecked(),true);
  await page.locator('#applyColor').click();
  const one=await pixel(18,24),two=await pixel(104,24);
  assert.ok(one[2]>one[0] && two[2]>two[0],
    'Both disconnected assets should become purple in a single apply: '+JSON.stringify({one,two}));
  assert.deepEqual(await pixel(26,24),[255,255,255,255],'White highlight must survive recolor');
  assert.deepEqual(await pixel(10,24),[5,5,5,255],'Dark outline must remain');
  assert.deepEqual(await pixel(60,24),[248,245,235,255],'Other background region must be unchanged');
  assert.deepEqual(await pixel(80,80),[75,130,230,255],'Other PSD layer must remain unchanged');
  await page.locator('#undo').click();
  assert.deepEqual(await pixel(18,24),[170,200,70,255],'One undo restores original left asset');
  assert.deepEqual(await pixel(104,24),[170,200,70,255],'One undo restores original right asset');

  // Shift-select across independent PSD layers after unlocking top-layer targeting.
  await page.locator('#selectedLayerOnly').uncheck();
  await clickAt(18,24);
  await clickAt(80,80,['Shift']);
  assert.match(await page.locator('#selectionPartsCount').textContent(),/2개 레이어/);
  await page.locator('#applyColor').click();
  assert.ok((await pixel(18,24))[2]>(await pixel(18,24))[0]);
  assert.ok((await pixel(80,80))[0]>75,'Second layer recolored too');
  await page.locator('#undo').click();
  assert.deepEqual(await pixel(18,24),[170,200,70,255]);
  assert.deepEqual(await pixel(80,80),[75,130,230,255]);

  // Artboard can travel freely beyond center and return with one click.
  const before=await page.locator('#canvasHolder').boundingBox();
  const cx=before.x+before.width/2,cy=before.y+before.height/2;
  await page.mouse.move(cx,cy);
  await page.mouse.down({button:'middle'});
  await page.mouse.move(cx+280,cy+175,{steps:6});
  await page.mouse.up({button:'middle'});
  const moved=await page.locator('#canvasHolder').boundingBox();
  assert.ok(moved.x-before.x>320&&moved.y-before.y>180,
    'Middle drag must allow broad movement beyond center: '+JSON.stringify({before,moved}));
  await page.locator('#panReset').click();
  const reset=await page.locator('#canvasHolder').boundingBox();
  assert.ok(Math.abs(reset.x-before.x)<2&&Math.abs(reset.y-before.y)<2,
    'Pan reset restores the original view');
  assert.deepEqual(errors,[],'Browser JS must not throw');
  console.log('PASS: Shift-click multi-region/multi-layer tint + single undo + white and outline protection.');
  console.log('PASS: Smooth mask grow and unrestricted middle button pan with reset.');
} finally {
  if(browser)await browser.close();
  server.kill();
}
