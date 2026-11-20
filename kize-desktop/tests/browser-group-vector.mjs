import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {readArchive} from '../project-archive.mjs';
initializeCanvas(createCanvas);
const width=48,height=36;
const image=(w,h,fn)=>{const data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),4*(y*w+x));return{width:w,height:h,data};};
const merged=image(width,height,()=>[20,146,187,255]);
const backdrop=image(width,height,()=>[248,240,221,255]);
const topper=image(width,height,()=>[226,75,112,255]);
const groupMask=image(width,height,(x)=>[x<24?255:0,0,0,255]);
const parentPsd=writePsd({width,height,imageData:merged,children:[
 {name:'Lace group',mask:{left:0,top:0,right:width,bottom:height,defaultColor:0,
   imageData:groupMask},children:[
   {name:'Top pink',left:0,top:0,right:width,bottom:height,imageData:topper}
 ]},
 {name:'Backdrop',left:0,top:0,right:width,bottom:height,imageData:backdrop}
]});
const p=(x,y)=>({linked:true,points:[x,y,x,y,x,y]});
const vectorPsd=writePsd({width,height,imageData:merged,children:[
 {name:'Vector star',left:0,top:0,right:width,bottom:height,
  vectorMask:{fillStartsWithAllPixels:false,paths:[{open:false,
     operation:'combine',fillRule:'even-odd',
     knots:[p(0,0),p(23,0),p(23,35),p(0,35)]}]},
  imageData:topper},
 {name:'Backdrop',left:0,top:0,right:width,bottom:height,imageData:backdrop}
]});
const port=4202,base='http://127.0.0.1:'+port+'/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'pipe'});
let browser;
try{
 let up=false;
 for(let i=0;i<60;i++){if(server.exitCode!==null)throw Error('Vite server crashed');
  try{if((await fetch(base)).ok){up=true;break;}}catch{}
  await sleep(300);
 }
 if(!up)throw Error('Vite server unavailable');
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1480,height:940},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});
 const pixel=(x,y)=>page.evaluate(([x,y])=>Array.from(
  document.querySelector('#renderCanvas').getContext('2d').getImageData(x,y,1,1).data),[x,y]);
 const openPsd=async(name,buffer)=>{
  await page.locator('#importFile').setInputFiles({name,mimeType:'application/octet-stream',buffer:Buffer.from(buffer)});
  await page.waitForFunction(()=>/불러오기 완료/.test(document.querySelector('#importReport')?.textContent||''),null,{timeout:60000});
 };
 const exercise=async(name,data,layerName,isGroup)=>{
  await openPsd(name,data);
  await page.locator('#viewLayers').click();
  assert.deepEqual(await pixel(10,12),[226,75,112,255],
    'Simple Photoshop matte should display red object in visible half');
  assert.deepEqual(await pixel(37,12),[248,240,221,255],
    'Simple Photoshop matte should hide red layer in masked half');
  await page.locator('#viewComposite').click();
  await page.locator('.layer').filter({hasText:layerName}).click();
  await page.locator('#selectionMode').selectOption('asset');
  await page.locator('#preserveShading').uncheck();
  await page.locator('#assetTint').uncheck();
  const rect=await page.locator('#overlayCanvas').boundingBox();
  await page.mouse.click(rect.x+10.5*rect.width/width,rect.y+12.5*rect.height/height);
  await page.locator('#targetColor').fill('#9389de');
  await page.locator('#applyColor').click();
  assert.deepEqual(await pixel(10,12),[147,137,222,255]);
  assert.deepEqual(await pixel(37,12),[20,146,187,255],
    'Masked half of stored Photoshop composite must remain byte-identical');
  const [download]=await Promise.all([
   page.waitForEvent('download',{timeout:60000}),
   page.locator('#saveProject').click()
  ]);
  const project=await readFile(await download.path());
  const archive=readArchive(new Uint8Array(project));
  if(isGroup){
   assert.equal(archive.manifest.psdGroupMasks.length,1);
   assert.equal(archive.manifest.psdGroupMasks[0].maskFiles.length,1);
   assert.equal(archive.manifest.layers.find(l=>l.name.endsWith(layerName)).ancestorGroupKeys.length,1);
  }else{
   assert.ok(archive.manifest.layers.find(l=>l.name.endsWith(layerName)).maskFiles?.length);
  }
  await page.locator('#importFile').setInputFiles({name:'roundtrip.kize',
   mimeType:'application/octet-stream',buffer:project});
  await page.waitForFunction(()=>/프로젝트를 불러왔습니다/.test(document.querySelector('#status')?.textContent||''),null,{timeout:60000});
  assert.deepEqual(await pixel(10,12),[147,137,222,255],
    'Edited appearance must survive project reload');
  assert.deepEqual(await pixel(37,12),[20,146,187,255],
    'Outside of group/vector mask unchanged after reload');
 };
 await exercise('group.psd',parentPsd,'Top pink',true);
 await exercise('vector.psd',vectorPsd,'Vector star',false);
 assert.deepEqual(errors,[]);
 console.log('PASS: actual Photoshop group and Bezier vector masks visible in reconstructed preview and recolor selections; archive restores exactly.');
} finally {if(browser)await browser.close();server.kill();}
