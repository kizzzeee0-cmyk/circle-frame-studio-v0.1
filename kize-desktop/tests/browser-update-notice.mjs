import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {chromium} from 'playwright-core';

const host='http://127.0.0.1:4197/';
const repo='kizzzeee0-cmyk/circle-frame-studio-v0.1';
const version='0.16.0';
const tag='kize-v'+version;
const name='KIZE-DESIGN-TOOL-v'+version+'-Windows.zip';
const download='https://github.com/'+repo+'/releases/download/'+tag+'/'+name;
const feed=[{
  tag_name:tag,name:'KIZE DESIGN TOOL v'+version,body:'색상 편집 속도와 정확도를 개선했습니다.',
  draft:false,prerelease:false,assets:[{name,state:'uploaded',browser_download_url:download}]
}];
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
  '--host','127.0.0.1','--port','4197','--strictPort'],{stdio:'pipe'});
let browser;
try{
  let ready=false;
  for(let i=0;i<60;i++){
    if(server.exitCode!==null)throw Error('Vite preview exited');
    try{if((await fetch(host)).ok){ready=true;break;}}catch{}
    await pause(250);
  }
  if(!ready)throw Error('Could not start preview server');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1420,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/https:\/\/api\.github\.com\/repos\/kizzzeee0-cmyk\/circle-frame-studio-v0\.1\/releases\?/,route=>
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(feed)}));
  await page.addInitScript(()=>{
    window.__kizeOpenedUrls=[];
    window.open=(href)=>{window.__kizeOpenedUrls.push(href);return null;};
  });
  await page.goto(host,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#checkUpdate')?.textContent==='업데이트 보기');
  assert.equal(await page.locator('#updateBadge').isVisible(),true,'one-time NEW cue');
  assert.equal(await page.locator('#updateDetails').isVisible(),false,'no intrusive auto-opening');
  await page.locator('#checkUpdate').click();
  assert.equal(await page.locator('#updateBadge').isVisible(),false,'NEW vanishes once acknowledged');
  assert.equal(await page.locator('#updateDetails').isVisible(),true);
  assert.match(await page.locator('#updateNotes').textContent(),/편집 속도/);
  await page.locator('#downloadUpdate').click();
  const opened=await page.evaluate(()=>window.__kizeOpenedUrls);
  assert.deepEqual(opened,[download],'download is user initiated and GitHub hosted');
  await page.locator('#dismissUpdate').click();
  assert.equal(await page.locator('#updateDetails').isVisible(),false);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#checkUpdate')?.textContent==='업데이트 보기');
  assert.equal(await page.locator('#updateBadge').isVisible(),false,
    'acknowledged version never repeats its highlight');
  assert.equal(await page.locator('#updateDetails').isVisible(),false);
  assert.deepEqual(errors,[],'No UI errors');
  console.log('PASS: quiet KIZE NEW badge, review-on-click, GitHub ZIP URL and single acknowledgment.');
}finally{
  if(browser)await browser.close();
  server.kill();
}
