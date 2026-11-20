import {spawn} from 'node:child_process';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {setTimeout as delay} from 'node:timers/promises';

// End-to-end test in real Edge Chromium: a PSD must decode inside the real
// bundled Web Worker, then appear in the actual KIZE layer list and canvas.
// This catches Canvas initialization failures that Node-only unit tests missed.
initializeCanvas(createCanvas);
const colorData=(w,h,r,g,b)=>{
  const data=new Uint8Array(w*h*4);
  for(let i=0;i<data.length;i+=4){data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;}
  return {width:w,height:h,data};
};
const fixture=writePsd({width:48,height:48,children:[
  {name:'Purple asset',left:4,top:4,right:24,bottom:24,imageData:colorData(20,20,150,130,220)},
  {name:'Background',left:0,top:0,right:48,bottom:48,imageData:colorData(48,48,245,242,249)}
]});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4178','--strictPort'],{stdio:'pipe'});
let browser;
try {
  let ready=false;
  for(let attempt=0;attempt<40;attempt++) {
    if(server.exitCode!==null)throw Error('Vite preview exited: '+server.exitCode);
    try {const response=await fetch('http://127.0.0.1:4178/');if(response.ok){ready=true;break;}}catch{}
    await delay(500);
  }
  if(!ready)throw Error('Vite preview did not start');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('http://127.0.0.1:4178/',{waitUntil:'networkidle'});
  await page.locator('#importFile').setInputFiles({
    name:'two-layers.psd',mimeType:'application/octet-stream',buffer:Buffer.from(fixture)
  });
  await page.waitForFunction(()=>{
    const label=document.querySelector('#importReport');
    return label && (!label.hidden) && (/불러오기 완료/.test(label.textContent)||/열기 실패/.test(label.textContent));
  },null,{timeout:60000});
  const result=await page.evaluate(()=>({
    report:document.querySelector('#importReport')?.textContent,
    count:document.querySelector('#layerCount')?.textContent,
    names:[...document.querySelectorAll('#layerList .layer strong')].map(e=>e.textContent),
    canvas:document.querySelector('#renderCanvas')?.toDataURL()?.length,
    errors:[...document.querySelectorAll('.import-report[data-type="error"]')].map(e=>e.textContent),
  }));
  if(result.errors.length||!result.report?.includes('불러오기 완료')||
    result.count!=='2'||!result.names.includes('Background')||!result.names.includes('Purple asset')||
    (result.canvas||0)<200) {
    throw Error('PSD import failed in Edge UI: '+JSON.stringify({result,errors}));
  }
  if(errors.length)throw Error('UI JavaScript errors: '+errors.join(' | '));
  console.log('PASS: Edge Web Worker loaded 2-layer PSD using initialized Canvas and rendered preview.');
  console.log('PASS: '+result.report.split('\n')[0]);
} finally {
  if(browser)await browser.close();
  server.kill();
}
