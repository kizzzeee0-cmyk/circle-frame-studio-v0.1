import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {createCanvas} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';

const url='http://127.0.0.1:4202';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
 '--host','127.0.0.1','--port','4202','--strictPort'],{stdio:'pipe'});
let browser;
const fixture=(w,h)=>{
 const c=createCanvas(w,h),ctx=c.getContext('2d'),d=ctx.createImageData(w,h);
 const rgb=[[189,216,234,255],[233,191,209,255],[173,199,153,255],
 [58,74,90,255],[243,225,164,255],[174,150,201,255],[242,232,219,255]];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   d.data.set((x<2||y<2||x>=w-2||y>=h-2)?[0,0,0,0]:
     rgb[Math.floor((x-2)/8)%rgb.length],(y*w+x)*4);
 }
 ctx.putImageData(d,0,0);return c.toBuffer('image/png');
};
try{
 let ready=false;
 for(let i=0;i<60;i++){
   try{if((await fetch(url+'/index.html')).ok){ready=true;break;}}catch{}
   await pause(250);
 }
 if(!ready)throw Error('Vite preview not ready');
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1510,height:980}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/index.html',{waitUntil:'networkidle'});
 await page.locator('#importFile').setInputFiles({name:'outline.png',mimeType:'image/png',buffer:fixture(60,50)});
 await page.waitForFunction(()=>document.querySelector('#docInfo')?.textContent?.includes('IMAGE'));
 await page.locator('#paletteSelectAll').click();
 assert.match(await page.locator('#selectionInfo').textContent(),/픽셀 선택/);
 const rgba=(id,x,y)=>page.evaluate(([id,x,y])=>Array.from(
  document.getElementById(id).getContext('2d').getImageData(x,y,1,1).data),[id,x,y]);
 // No 33%-opacity violet fill anywhere INSIDE the selection. Outline only.
 assert.equal((await rgba('overlayCanvas',12,20))[3],0,
  'A full selection must never tint the interior of the original colors');
 assert.ok((await rgba('overlayCanvas',2,20))[3]>0,'selection has a thin visible edge');
 const artBefore=await rgba('renderCanvas',12,20);
 await page.locator('#variantColors').fill('#C5DFF2,#F6C9D8,#D6E6BD,#526777,#F8E2B8');
 await page.locator('#palettePreview').click();
 assert.equal((await rgba('overlayCanvas',2,20))[3],0,'preview hides every selection contour');
 assert.match(await page.locator('#selectionInfo').textContent(),/픽셀 선택/,
  'temporary preview never discards the selected regions');
 await page.locator('#palettePreview').click();
 assert.ok((await rgba('overlayCanvas',2,20))[3]>0,'closing preview restores the previous selection');
 await page.locator('#showSelectionOutline').uncheck();
 assert.equal((await rgba('overlayCanvas',2,20))[3],0);
 await page.locator('#showSelectionOutline').check();

 // Loading a reference MUST NOT replace/alter current document.
 await page.locator('#characterAnalyzer summary').click();
 const nameBefore=await page.locator('#sourceName').textContent();
 await page.locator('#charPhotoInput').setInputFiles({name:'ref.png',mimeType:'image/png',buffer:fixture(60,50)});
 await page.waitForFunction(()=>document.querySelectorAll('#charPaletteSuggestions .char-palette-item').length===12);
 assert.equal(await page.locator('#charExtractedColors .char-swatch').count(),7);
 assert.equal(await page.locator('#sourceName').textContent(),nameBefore);
 assert.deepEqual(await rgba('renderCanvas',12,20),artBefore,
  'reference photo analysis must not edit the loaded design');
 await page.locator('#charPaletteSuggestions .char-palette-item').nth(1).click();
 await page.waitForFunction(()=>document.querySelector('#palettePreview')?.textContent==='미리보기 해제');
 assert.equal(await page.locator('#variantOutputMode').inputValue(),'combo');
 assert.equal(await page.locator('#paletteApply').isVisible(),true);
 await page.locator('#paletteApply').click();
 assert.notDeepEqual(await rgba('renderCanvas',12,20),artBefore,'actual multi-color palette applied');
 await page.locator('#charRemove').click();
 assert.equal(await page.locator('#charReference').isVisible(),false);
 await page.locator('#modeSingle').click();
 assert.equal(await page.locator('#targetHex').isVisible(),true,
  'after palette apply individual color editing remains accessible');
 assert.deepEqual(errors,[],'no JS page errors');
 console.log('PASS: exact color canvas, cyan-only outline, stateful preview, photo palettes and post-apply editing.');
}finally{if(browser)await browser.close();server.kill();}
