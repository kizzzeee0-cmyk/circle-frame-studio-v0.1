import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {chromium} from 'playwright-core';

const origin='http://127.0.0.1:4203';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
 '--host','127.0.0.1','--port','4203','--strictPort'],{stdio:'pipe'});
let browser;
try{
 let started=false;
 for(let i=0;i<60;i++){
   try{if((await fetch(origin+'/circle.html')).ok){started=true;break;}}catch{}
   await pause(250);
 }
 if(!started)throw Error('Unified desktop app preview unavailable');
 for(const url of ['/index.html','/circle.html','/tools/pattern/index.html',
   '/tools/pattern/app.js','/tools/pattern/patterns.js']){
   const res=await fetch(origin+url);
   assert.equal(res.status,200,url+' is bundled OFFLINE');
 }
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1560,height:960}});
 const errors=[];page.on('pageerror',e=>errors.push('['+page.url()+'] '+e.message));
 await page.addInitScript(()=>{
   localStorage.setItem('kize-shared-palettes-v1',JSON.stringify([{
     id:'test-shared',name:'테스트 블루 파스텔',
     colors:['#BBDDF2','#F6CBD9','#FFFDFB','#DCEFFC','#56515B']
   }]));
 });
 await page.goto(origin+'/tools/pattern/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#previewCanvas')?.width>0&&!!window.PatternEngine,
   null,{timeout:60000});
 assert.equal(await page.locator('#kize-unified-nav a.current').textContent(),'큐트 패턴');
 assert.equal(await page.locator('iframe').count(),0,'real code integrated without iframe');
 await page.locator('#kize-shared-palette').selectOption({label:'테스트 블루 파스텔'});
 await page.locator('#kize-unified-nav .kize-nav-share button').click();
 assert.match(await page.locator('#toast').textContent(),/KIZE 공통 팔레트/,
   'Pattern Studio current layer changed by shared palette');
 // Transfer the actual original-resolution Pattern PNG into the KIZE editor.
 await page.locator('#exportW').fill('96');
 await page.locator('#exportH').fill('96');
 await page.locator('#sendKizeEditor').click();
 await page.waitForFunction(()=>document.querySelector('#docInfo')?.textContent?.includes('96×96px'),
   null,{timeout:60000});
 assert.match(await page.locator('#sourceName').textContent(),/cute-pattern-96x96/,
   'Pattern export arrived in the KIZE editor as full-res PNG, not iframe');
 assert.equal(await page.locator('#kize-unified-nav a.current').textContent(),'색상·에셋 편집');
 // Transfer the KIZE canvas to the Circle media library without PNG resampling.
 await page.locator('#sendToCircle').click();
 await page.waitForFunction(()=>document.querySelector('#root')?.children.length>0,
   null,{timeout:60000});
 await page.waitForFunction(()=>{
   try{
     const raw=localStorage.getItem('circle-frame-studio-project-v040');
     const project=JSON.parse(raw||'{}');
     return project.mediaLayers?.some(l=>l.name?.includes('cute-pattern-96x96'))??false;
   }catch{return false;}
 },null,{timeout:60000});
 assert.equal(await page.locator('#kize-unified-nav a.current').textContent(),'원형 프레임');
 assert.equal(await page.locator('iframe').count(),0,'Circle React renderer is native offline');
 await page.locator('#kize-shared-palette').selectOption({label:'테스트 블루 파스텔'});
 await page.locator('#kize-unified-nav .kize-nav-share button').click();
 await page.waitForFunction(()=>{
   const raw=localStorage.getItem('circle-frame-studio-project-v040');
   if(!raw)return false;
   try{
     const p=JSON.parse(raw);
     return p.layers?.some(l=>l.design?.color==='#BBDDF2')??false;
   }catch{return false;}
 },null,{timeout:60000});
 await page.locator('#kize-unified-nav a[data-tool="editor"]').click();
 await page.waitForFunction(()=>document.querySelector('#colorPanel')!==null,null,{timeout:30000});
 assert.equal(await page.locator('#kize-unified-nav a.current').textContent(),'색상·에셋 편집');
 assert.equal(await page.locator('iframe').count(),0);
 assert.deepEqual(errors,[],'The three included real tools load without browser errors');
 console.log('PASS: all three real offline tools, same-window switcher, shared palette changes Pattern and Circle projects.');
}finally{if(browser)await browser.close();server.kill();}
