import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {unzipSync} from 'fflate';

initializeCanvas(createCanvas);
const w=24,h=24;
function rgba(width,height,fn){
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)
  data.set(fn(x,y),4*(y*width+x));
 return {width,height,data};
}
const bg=rgba(w,h,()=>[238,239,244,255]);
const foreground=rgba(8,8,()=>[189,152,62,255]);
const merged=rgba(w,h,(x,y)=>x>=4&&x<12&&y>=4&&y<12
 ?[189,152,62,255]:[238,239,244,255]);
const psd=writePsd({width:w,height:h,imageData:merged,children:[
 {name:'Editable shape',left:4,top:4,right:12,bottom:12,imageData:foreground},
 {name:'Backdrop',left:0,top:0,right:w,bottom:h,imageData:bg}
]});
const host='http://127.0.0.1:4196/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
 '--host','127.0.0.1','--port','4196','--strictPort'],{stdio:'pipe'});
let browser;
try{
 let ready=false;
 for(let i=0;i<60;i++){
   if(server.exitCode!==null)throw Error('Vite exited');
   try{if((await fetch(host)).ok){ready=true;break;}}catch{}
   await pause(250);
 }
 if(!ready)throw Error('Preview server unavailable');
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1420,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto(host,{waitUntil:'networkidle'});
 await page.locator('#importFile').setInputFiles({name:'palette.psd',
   mimeType:'application/octet-stream',buffer:Buffer.from(psd)});
 await page.waitForFunction(()=>/불러오기 완료/.test(
   document.querySelector('#importReport')?.textContent||''),null,{timeout:60000});
 await page.locator('#zoomActual').click();
 assert.equal(await page.locator('#zoomLabel').textContent(),'100%');
 // PSD composite's original appearance stays unmodified by batch extraction.
 const pixel=async(x,y)=>page.evaluate(([x,y])=>
   Array.from(document.querySelector('#renderCanvas').getContext('2d').getImageData(x,y,1,1).data),[x,y]);
 const before=await pixel(6,6);
 await page.locator('.layer').filter({hasText:'Editable shape'}).click();
 await page.locator('#assetTint').uncheck();
 const box=await page.locator('#overlayCanvas').boundingBox();
 await page.mouse.click(box.x+6.5*box.width/w,box.y+6.5*box.height/h);
 assert.match(await page.locator('#selectionInfo').textContent(),/영역/);
 await page.locator('#modePalette').click();
 assert.equal(await page.locator('#variantOutputMode').inputValue(),'single','PSD retains advanced per-color ZIP mode');
 await page.locator('#variantColors').fill('#AA0000, #0000AA');
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:60000}),
   page.locator('#exportVariants').click()]);
 const data=new Uint8Array(await readFile(await download.path()));
 const entries=unzipSync(data),names=Object.keys(entries).filter(s=>s.endsWith('.png'));
 assert.equal(names.length,2,'two distinct original-resolution PNGs');
 const pixels=[];
 for(const name of names){
   const img=await loadImage(Buffer.from(entries[name]));
   assert.equal(img.width,w);assert.equal(img.height,h);
   const c=createCanvas(w,h),cx=c.getContext('2d');cx.drawImage(img,0,0);
   const color=Array.from(cx.getImageData(6,6,1,1).data);
   const backdrop=Array.from(cx.getImageData(20,20,1,1).data);
   assert.deepEqual(backdrop,[238,239,244,255],'unchosen PSD pixels are byte-exact');
   pixels.push(color);
 }
 assert.ok(pixels.some(c=>c[0]===170&&c[1]===0&&c[2]===0));
 assert.ok(pixels.some(c=>c[0]===0&&c[1]===0&&c[2]===170));
 await page.locator('#viewComposite').click();
 assert.deepEqual(await pixel(6,6),before,'batch variants never mutate working document');
 assert.deepEqual(errors,[],'no browser JS error');
 console.log('PASS: 100% preview and two exact-pixel color variant PNGs in ZIP.');
}finally{if(browser)await browser.close();server.kill();}
