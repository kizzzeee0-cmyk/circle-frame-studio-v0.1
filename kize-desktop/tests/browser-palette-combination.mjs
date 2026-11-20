import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {readFile} from 'node:fs/promises';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {chromium} from 'playwright-core';
import {unzipSync} from 'fflate';

const w=60,h=40;
const canvas=createCanvas(w,h),ctx=canvas.getContext('2d');
const img=ctx.createImageData(w,h);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const c=y>=36?[0,0,0,0]:x<30?[211,139,167,255]:x<48?[147,195,153,255]:[141,168,217,255];
 img.data.set(c,(y*w+x)*4);
}
ctx.putImageData(img,0,0);
const file=canvas.toBuffer('image/png');
const host='http://127.0.0.1:4199/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
  '--host','127.0.0.1','--port','4199','--strictPort'],{stdio:'pipe'});
let browser;
try{
 let started=false;
 for(let i=0;i<60;i++){
   if(server.exitCode!==null)throw Error('Vite preview unexpectedly exited');
   try{if((await fetch(host)).ok){started=true;break;}}catch{}
   await pause(250);
 }
 if(!started)throw Error('Vite preview not available');
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1480,height:960},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(host,{waitUntil:'networkidle'});
 const pixel=(x,y)=>page.evaluate(([x,y])=>Array.from(
   document.querySelector('#renderCanvas').getContext('2d').getImageData(x,y,1,1).data),[x,y]);
 await page.locator('#importFile').setInputFiles({name:'multicolor-frame.png',mimeType:'image/png',buffer:file});
 await page.waitForFunction(()=>document.querySelector('#docInfo')?.textContent?.includes('IMAGE'));
 assert.equal(await page.locator('#variantOutputMode').inputValue(),'combo','PNG opens true multi-swatch combo mode');
 assert.equal(await page.locator('#variantDetails').getAttribute('open'),'','palette controls are already visible');
 assert.deepEqual(await pixel(2,2),[211,139,167,255]);
 assert.equal(await page.locator('#modePalette').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#singleEditor').isVisible(),false,'No misleading one-color picker beside palette presets');
 await page.locator('#paletteSelectAll').click();
 const selected=await page.locator('#selectionInfo').textContent();
 assert.match(selected,/2,160개 픽셀 선택/,'Ctrl+A/all must omit transparent row');
 await page.locator('#paletteClearSelection').click();
 await page.keyboard.press('Control+a');
 assert.match(await page.locator('#selectionInfo').textContent(),/2,160개 픽셀 선택/);
 await page.locator('#paletteClearSelection').click();
 await page.locator('#variantColors').fill('#F2C4CC, #CEE5B7, #C9D4F1');
 await page.locator('#variantColors').press('Control+Shift+a');
 assert.match(await page.locator('#selectionInfo').textContent(),/2,160개 픽셀 선택/,
   'Ctrl+Shift+A selects whole image even when palette HEX text has focus');
 await page.locator('#paletteClearSelection').click();
 await page.locator('#variantFinish').selectOption('exact');
 await page.locator('#paletteScope').selectOption('all');
 await page.waitForFunction(()=>document.querySelectorAll('#paletteMapping .palette-map-item').length===3);
 assert.equal(await page.locator('#paletteMapping .palette-map-item').count(),3,
  'Three original color families map to three DISTINCT preset swatches');
 const colors=[[242,196,204,255],[206,229,183,255],[201,212,241,255]];
 assert.equal(await page.locator('#paletteApply').isVisible(),true,
   'Primary Apply action stays immediately beside the recommended preset picker');
 await page.locator('#palettePreview').click();
 assert.deepEqual(await pixel(2,2),colors[0],'First original color -> first target');
 assert.deepEqual(await pixel(36,2),colors[1],'Second original color -> second target');
 assert.deepEqual(await pixel(54,2),colors[2],'Third original color -> third target');
 assert.deepEqual(await pixel(36,38),[0,0,0,0],'Transparent pixels are unchanged');
 await page.locator('#palettePreview').click();
 assert.deepEqual(await pixel(2,2),[211,139,167,255],'Preview dismiss leaves original PNG unchanged');
 await page.locator('#paletteApply').click();
 assert.deepEqual(await pixel(2,2),colors[0],'Apply changes current PNG visibly');
 assert.deepEqual(await pixel(36,2),colors[1]);
 assert.deepEqual(await pixel(54,2),colors[2]);
 await page.locator('#paletteUndo').click();
 assert.deepEqual(await pixel(2,2),[211,139,167,255],'Undo restores PNG');
 await page.locator('#paletteRedo').click();
 assert.deepEqual(await pixel(36,2),colors[1],'Redo restores combo');

 // Even if legacy mode was chosen previously, selecting a palette must
 // restore real multi-swatch mode and non-destructively auto-preview it.
 await page.locator('#variantOutputMode').selectOption('single');
 await page.locator('#variantPreset').selectOption({label:'버터옐로우 · 연두 · 크림'});
 assert.equal(await page.locator('#variantOutputMode').inputValue(),'combo');
 assert.equal(await page.locator('#paletteApply').isVisible(),true);
 await page.waitForFunction(()=>document.querySelector('#palettePreview')?.textContent==='미리보기 해제');
 assert.equal(await page.locator('#targetHex').isVisible(),false);
 assert.equal(await page.locator('#targetColor').inputValue(),'#beb5ed','Palette never changes single-color picker');
 await page.waitForFunction(()=>document.querySelectorAll('#paletteMapping .palette-map-item').length===3);
 await page.locator('#paletteZipCount').selectOption('4');
 const beforeExport=await pixel(2,2);
 const [download]=await Promise.all([
   page.waitForEvent('download',{timeout:60000}),
   page.locator('#exportVariants').click()
 ]);
 const data=new Uint8Array(await readFile(await download.path()));
 const entries=unzipSync(data);
 const names=Object.keys(entries).filter(name=>name.endsWith('.png')).sort();
 assert.deepEqual(names,['palette-01.png','palette-02.png','palette-03.png','palette-04.png']);
 const meta=JSON.parse(new TextDecoder().decode(entries['palette-mapping.json']));
 assert.equal(meta.variants.length,4);
 assert.equal(meta.variants[0].mapping.length,3);
 const result=await loadImage(Buffer.from(entries['palette-01.png']));
 assert.equal(result.width,w);assert.equal(result.height,h);
 const c=createCanvas(w,h),g=c.getContext('2d');g.drawImage(result,0,0);
 const p=(x,y)=>Array.from(g.getImageData(x,y,1,1).data);
 assert.deepEqual(p(2,2),[244,221,161,255]); // butter yellow
 assert.deepEqual(p(36,2),[198,217,154,255]); // light green
 assert.deepEqual(p(54,2),[255,241,216,255]); // cream
 assert.deepEqual(p(36,38),[0,0,0,0]);
 assert.deepEqual(await pixel(2,2),beforeExport,'ZIP export never applies to the edit canvas');
 assert.deepEqual(errors,[],'no console page exceptions');
 console.log('PASS: opaque select all, 3-color combo preview/apply/undo/redo, and 4 actual multicolor PNGs in ZIP.');
}finally{
 if(browser)await browser.close();
 server.kill();
}
