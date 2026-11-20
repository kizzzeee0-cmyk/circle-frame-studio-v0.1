import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {readArchive} from '../project-archive.mjs';

initializeCanvas(createCanvas);
const block=(w,h,fn)=>{const data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),4*(y*w+x));return{width:w,height:h,data};};
const w=36,h=30,merged=block(w,h,()=>[30,140,180,255]);
const fg=block(16,12,()=>[230,70,110,255]),bg=block(w,h,()=>[248,242,224,255]);
const mask=block(16,12,(x,y)=>[x<8?255:0,0,0,255]);
const masked=writePsd({width:w,height:h,imageData:merged,children:[
 {name:'Masked flower',left:4,top:5,right:20,bottom:17,imageData:fg,
  mask:{left:4,top:5,right:20,bottom:17,defaultColor:0,imageData:mask}},
 {name:'Background',left:0,top:0,right:w,bottom:h,imageData:bg}
]});
const clipped=writePsd({width:w,height:h,imageData:merged,children:[
 {name:'Clipped color',left:4,top:5,right:20,bottom:17,clipping:true,imageData:fg},
 {name:'Base shape',left:4,top:5,right:20,bottom:17,
  imageData:block(16,12,(x)=>[255,255,255,x<8?255:0])},
 {name:'Background',left:0,top:0,right:w,bottom:h,imageData:bg}
]});
const host='http://127.0.0.1:4195/';
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4195','--strictPort'],{stdio:'pipe'});
let browser;
try{
 let ready=false;
 for(let t=0;t<60;t++){if(child.exitCode!==null)throw Error('Vite failed');try{if((await fetch(host)).ok){ready=true;break;}}catch{}await pause(250);}
 if(!ready)throw Error('Vite did not launch');
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1480,height:920},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(host,{waitUntil:'networkidle'});
 const pix=async(x,y)=>page.evaluate(([x,y])=>Array.from(document.querySelector('#renderCanvas').getContext('2d').getImageData(x,y,1,1).data),[x,y]);
 const open=async(name,bytes)=>{
   await page.locator('#importFile').setInputFiles({name,mimeType:'application/octet-stream',buffer:Buffer.from(bytes)});
   await page.waitForFunction(()=>/불러오기 완료/.test(document.querySelector('#importReport')?.textContent||''),null,{timeout:60000});
 };
 const selectAndPaint=async(layerName)=>{
   await page.locator('.layer').filter({hasText:layerName}).click();
   await page.locator('#selectionMode').selectOption('asset');
   await page.locator('#preserveShading').uncheck();
   await page.locator('#assetTint').uncheck();
   const box=await page.locator('#overlayCanvas').boundingBox();
   await page.mouse.click(box.x+7.5*box.width/w,box.y+9.5*box.height/h);
   assert.ok(Number.parseInt((await page.locator('#selectionInfo').textContent()).replace(/[^0-9]/g,''))>0);
   await page.locator('#targetColor').fill('#9955dd');
   await page.locator('#applyColor').click();
   assert.deepEqual(await pix(7,9),[153,85,221,255],layerName+' unmasked part must recolor');
   assert.deepEqual(await pix(16,9),[30,140,180,255],layerName+' masked/clipped part must remain byte-identical');
   assert.deepEqual(await pix(26,20),[30,140,180,255],'Background unchanged');
 };
 await open('masked.psd',masked);
 await selectAndPaint('Masked flower');
 await page.locator('#undo').click();
 assert.deepEqual(await pix(7,9),[30,140,180,255]);
 await page.locator('#redo').click();
 assert.deepEqual(await pix(7,9),[153,85,221,255]);
 const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.locator('#saveProject').click()]);
 const bytes=await readFile(await dl.path());
 const {manifest}=readArchive(new Uint8Array(bytes));
 const layer=manifest.layers.find(l=>l.name.includes('Masked flower'));
 assert.equal(layer.maskFiles.length,1,'PSD user mask is saved independently in KIZE project');
 await page.locator('#importFile').setInputFiles({name:'masked.kize',mimeType:'application/octet-stream',buffer:bytes});
 await page.waitForFunction(()=>/프로젝트를 불러왔습니다/.test(document.querySelector('#status')?.textContent||''),null,{timeout:60000});
 assert.deepEqual(await pix(7,9),[153,85,221,255]);
 assert.deepEqual(await pix(16,9),[30,140,180,255]);
 await open('clipped.psd',clipped);
 await selectAndPaint('Clipped color');
 assert.deepEqual(errors,[],'Browser JS error');
 console.log('PASS: actual PSD mask and clipping protect invisible pixel edits, undo/redo, KIZE archive and reload.');
}finally{if(browser)await browser.close();child.kill();}
