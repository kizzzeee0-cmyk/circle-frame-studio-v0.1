import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {readArchive} from '../project-archive.mjs';

initializeCanvas(createCanvas);
function rgba(w,h,color){
 const b=new Uint8Array(w*h*4);
 for(let i=0;i<b.length;i+=4)b.set(color,i);
 return {width:w,height:h,data:b};
}
const w=72,h=60;
const merged=rgba(w,h,[190,155,219,255]); // Deliberately unlike raw layer stack.
const leaf=rgba(26,24,[244,80,105,255]);
const bg=rgba(w,h,[248,243,225,255]);
const psd=writePsd({width:w,height:h,imageData:merged,children:[
 {name:'Cute assets',blendMode:'pass through',children:[
  {name:'Pink star',left:12,top:10,right:38,bottom:34,imageData:leaf}
 ]},
 {name:'Background',left:0,top:0,right:w,bottom:h,imageData:bg}
]});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4193','--strictPort'],{stdio:'pipe'});
let browser;
try{
 let ready=false;
 for(let i=0;i<55;i++){
   if(server.exitCode!==null)throw Error('Vite failed');
   try{if((await fetch('http://127.0.0.1:4193/')).ok){ready=true;break;}}catch{}
   await pause(350);
 }
 if(!ready)throw Error('Vite preview timeout');
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1490,height:940},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4193/',{waitUntil:'networkidle'});
 await page.locator('#importFile').setInputFiles({name:'diagnose.psd',mimeType:'application/octet-stream',buffer:Buffer.from(psd)});
 await page.waitForFunction(()=>/불러오기 완료/.test(document.querySelector('#importReport')?.textContent||''),null,{timeout:60000});
 const current=async(x,y)=>page.evaluate(([x,y])=>Array.from(
   document.querySelector('#renderCanvas').getContext('2d').getImageData(x,y,1,1).data),[x,y]);
 assert.deepEqual(await current(20,20),[190,155,219,255],'Original PSD appearance must remain intact');
 assert.equal(await page.locator('.psd-group-row').count(),1);
 assert.match(await page.locator('#psdCompatSummary').textContent(),/그룹/);
 assert.equal(await page.locator('#layerCount').textContent(),'2');
 await page.locator('.psd-group-row').click();
 assert.equal(await page.locator('.layer').count(),1,'Collapse hides group children but does not delete them');
 await page.locator('.psd-group-row').click();
 assert.equal(await page.locator('.layer').count(),2,'Expand restores original layer');
 await page.locator('.layer').filter({hasText:'Pink star'}).click();
 assert.match(await page.locator('#layerCompatibility').textContent(),/PSD 원본 정보/);

 await page.locator('#psdFidelityPanel').evaluate(e=>e.open=true);
 await page.locator('#runFidelityAudit').click();
 const metric=await page.locator('#fidelityMetrics').textContent();
 assert.match(metric,/다른 픽셀/);
 assert.equal(await page.locator('#fidelityHeatmap').isVisible(),true);
 const [reportDownload]=await Promise.all([
   page.waitForEvent('download',{timeout:30000}),
   page.locator('#downloadFidelityReport').click()
 ]);
 const report=JSON.parse((await readFile(await reportDownload.path())).toString('utf8'));
 assert.ok(report.changedPercent>20,'Intentional mismatched PSD should detect significant deviation');
 assert.equal(report.compatibility.counts.groups,1);
 assert.equal(report.layers.length,2);
 assert.equal(report.layers.some(l=>l.compatibility?.groupPath?.includes('Cute assets')),true);
 assert.deepEqual(await current(20,20),[190,155,219,255],
   'Fidelity inspection must not edit original composited canvas');
 await page.locator('#viewLayers').click();
 page.once('dialog',d=>d.dismiss());
 await page.locator('#exportPng').click();
 assert.match(await page.locator('#status').textContent(),/취소/,
   'Approximate PSD export requires an explicit acknowledgement');
 page.once('dialog',d=>d.accept());
 const [pngDownload]=await Promise.all([
   page.waitForEvent('download',{timeout:30000}),
   page.locator('#exportPng').click()
 ]);
 const out=await readFile(await pngDownload.path());
 assert.deepEqual(Array.from(out.subarray(0,8)),[137,80,78,71,13,10,26,10],
   'Explicitly confirmed export remains valid PNG');
 const [projectDownload]=await Promise.all([
   page.waitForEvent('download',{timeout:30000}),
   page.locator('#saveProject').click()
 ]);
 const project=readArchive(new Uint8Array(await readFile(await projectDownload.path())));
 assert.equal(project.manifest.psdCompatibilityReport.counts.groups,1);
 assert.equal(project.manifest.layers.find(l=>l.name.endsWith('Pink star')).compatibility.groupPath[0],'Cute assets');
 assert.deepEqual(errors,[],'No browser uncaught exceptions');
 console.log('PASS: PSD groups, nested layer metadata, deviation heatmap, report export, protected PNG and KIZE metadata persistence.');
}finally{if(browser)await browser.close();server.kill();}
