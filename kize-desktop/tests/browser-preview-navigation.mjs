import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {setTimeout as delay} from 'node:timers/promises';

initializeCanvas(createCanvas);
const pixel=(w,h,r,g,b)=>{
  const data=new Uint8Array(w*h*4);
  for(let i=0;i<data.length;i+=4){data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;}
  return {width:w,height:h,data};
};
// The document's Photoshop-saved composite is deliberately DIFFERENT from
// its individual layers, to catch accidental re-compositing of complex PSDs.
const width=900,height=900;
const imageData=pixel(width,height,19,183,153);
const fixture=writePsd({width,height,imageData,children:[
  {name:'Sticker',left:120,top:80,right:430,bottom:300,imageData:pixel(310,220,228,145,186)},
  {name:'Background',left:0,top:0,right:width,bottom:height,imageData:pixel(width,height,245,238,218)}
]});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4179','--strictPort'],{stdio:'pipe'});
let browser;
try{
  let ready=false;
  for(let i=0;i<50;i++){
    if(server.exitCode!==null)throw Error('Vite preview server quit: '+server.exitCode);
    try{if((await fetch('http://127.0.0.1:4179/')).ok){ready=true;break;}}catch{}
    await delay(350);
  }
  if(!ready)throw Error('Vite preview did not start');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1180,height:790}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4179/',{waitUntil:'networkidle'});
  await page.locator('#importFile').setInputFiles({name:'illustrator-style.psd',mimeType:'application/octet-stream',buffer:Buffer.from(fixture)});
  await page.waitForFunction(()=>!document.querySelector('#importReport')?.hidden && /불러오기 완료|열기 실패/.test(document.querySelector('#importReport').textContent),null,{timeout:60000});
  const initial=await page.evaluate(()=>{
    const c=document.querySelector('#renderCanvas'),ctx=c.getContext('2d');
    const d=ctx.getImageData(600,600,1,1).data;
    const holder=document.querySelector('#canvasHolder').getBoundingClientRect();
    const stage=document.querySelector('#stage').getBoundingClientRect();
    return {modeComposite:document.querySelector('#viewComposite').classList.contains('selected'),r:d[0],g:d[1],b:d[2],alpha:d[3],
      holderTop:holder.top,stageTop:stage.top,holderBottom:holder.bottom,stageBottom:stage.bottom,
      report:document.querySelector('#importReport').textContent};
  });
  assert.match(initial.report,/불러오기 완료/,'PSD import must succeed');
  assert.ok(initial.modeComposite,'Photoshop composite preview must be the default when available');
  assert.deepEqual([initial.r,initial.g,initial.b,initial.alpha],[19,183,153,255],
    'Default preview must be Photoshop merged raster, not lossy layer recomposition');
  assert.ok(initial.holderTop>=initial.stageTop-2 && initial.holderBottom<=initial.stageBottom+2,
    'Artwork must be visible and centered when smaller than the stage');

  // The application must not render an unreachable upper/left half at zoom.
  for(let i=0;i<9;i++)await page.locator('#zoomIn').click();
  const geometry=await page.evaluate(()=>{
    const stage=document.querySelector('#stage');
    stage.scrollTop=0;stage.scrollLeft=0;
    const h=document.querySelector('#canvasHolder').getBoundingClientRect();
    const st=stage.getBoundingClientRect();
    return {scrollHeight:stage.scrollHeight,scrollWidth:stage.scrollWidth,
      clientHeight:stage.clientHeight,clientWidth:stage.clientWidth,
      topDelta:h.top-st.top,leftDelta:h.left-st.left};
  });
  assert.ok(geometry.scrollHeight>geometry.clientHeight+100 && geometry.scrollWidth>geometry.clientWidth+100,
    'Zoomed artboard must be actually scrollable');
  assert.ok(geometry.topDelta>=-2 && geometry.topDelta<=70,
    'Top edge of oversized artboard must be reachable at scrollTop=0: '+JSON.stringify(geometry));
  assert.ok(geometry.leftDelta>=-2 && geometry.leftDelta<=70,
    'Left edge of oversized artboard must be reachable at scrollLeft=0: '+JSON.stringify(geometry));

  await page.evaluate(()=>{
    const st=document.querySelector('#stage');
    st.scrollTop=240;st.scrollLeft=230;
  });
  const area=await page.locator('#stage').boundingBox();
  const mx=area.x+area.width/2,my=area.y+area.height/2;
  await page.mouse.move(mx,my);
  await page.mouse.down({button:'middle'});
  await page.mouse.move(mx+75,my+60,{steps:5});
  await page.mouse.up({button:'middle'});
  const panned=await page.evaluate(()=>({x:document.querySelector('#stage').scrollLeft,y:document.querySelector('#stage').scrollTop}));
  assert.ok(panned.x<230 && panned.y<240,'Middle mouse pan must move view both horizontally and vertically');

  const zoomBefore=Number((await page.locator('#zoomLabel').textContent()).replace('%',''));
  await page.mouse.move(mx,my);await page.mouse.wheel(0,-240);
  await page.waitForTimeout(250);
  const zoomAfter=Number((await page.locator('#zoomLabel').textContent()).replace('%',''));
  assert.ok(zoomAfter>zoomBefore,'Wheel up must zoom in without pressing Ctrl');
  await page.locator('#viewLayers').click();
  assert.ok(await page.locator('#viewLayers').evaluate(el=>el.classList.contains('selected')),'Layers view should be selectable');
  await page.locator('#viewComposite').click();
  assert.ok(await page.locator('#viewComposite').evaluate(el=>el.classList.contains('selected')),'Original view should restore');
  assert.deepEqual(errors,[],'No browser errors expected');
  console.log('PASS: Photoshop merged preview retains exact fixture pixels.');
  console.log('PASS: Top/left artboard edges are reachable, wheel zoom and middle-drag pan work.');
}finally{
  if(browser)await browser.close();
  server.kill();
}
