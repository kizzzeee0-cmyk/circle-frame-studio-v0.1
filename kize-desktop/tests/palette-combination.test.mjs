import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaletteMap,applyPaletteMap,discoverSourceColors} from '../palette-combination.mjs';

const png=(w,h,fn)=>{
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),(y*w+x)*4);
 return data;
};
const pixel=(p,w,x,y)=>Array.from(p.slice((y*w+x)*4,(y*w+x)*4+4));
test('one 3-color palette changes three distinct PNG design areas simultaneously',()=>{
 const w=40,h=20;
 const source=png(w,h,(x,y)=>y===19?[0,0,0,0]:x<24?[200,140,170,255]:x<35?[120,185,140,255]:[130,150,220,255]);
 const targets=['#EBC1CC','#C5E1AE','#D6C7F1'];
 const map=createPaletteMap(source,w,h,targets);
 const output=applyPaletteMap(source,w,h,map);
 assert.equal(map.source.length,3);
 assert.deepEqual(pixel(output.data,w,2,2),[235,193,204,255]);
 assert.deepEqual(pixel(output.data,w,30,2),[197,225,174,255]);
 assert.deepEqual(pixel(output.data,w,38,2),[214,199,241,255]);
 assert.deepEqual(pixel(output.data,w,20,19),[0,0,0,0]);
 assert.equal(output.changed,19*40);
 assert.deepEqual(Array.from(source.slice(0,4)),[200,140,170,255]);
});
test('PNG alpha and original canvas size remain exact with antialiased pixels',()=>{
 const w=3,h=1;
 const source=png(w,h,x=>x===0?[180,115,145,90]:x===1?[120,192,160,255]:[0,0,0,0]);
 const map=createPaletteMap(source,w,h,['#F1B7CA','#B6DCCB']);
 const out=applyPaletteMap(source,w,h,map);
 assert.equal(out.data.length,source.length);
 for(let i=0;i<w;i++)assert.equal(out.data[i*4+3],source[i*4+3]);
 assert.deepEqual(pixel(out.data,w,2,0),[0,0,0,0]);
 assert.notDeepEqual(pixel(out.data,w,0,0),pixel(source,w,0,0));
});
test('protected white highlights and near-black linework stay untouched',()=>{
 const w=12,h=1;
 const source=png(w,h,x=>x<4?[255,255,255,255]:x<8?[8,8,8,255]:[190,150,170,255]);
 const map=createPaletteMap(source,w,h,['#AABBCC','#DDEEFF'],{preserveWhiteBlack:true});
 const out=applyPaletteMap(source,w,h,map).data;
 assert.deepEqual(pixel(out,w,1,0),[255,255,255,255]);
 assert.deepEqual(pixel(out,w,5,0),[8,8,8,255]);
 assert.deepEqual(pixel(out,w,10,0),[170,187,204,255]);
});
test('selected-only palette affects chosen portion, not other PNG colors',()=>{
 const w=30,h=1;
 const source=png(w,h,x=>x<15?[230,175,180,255]:[145,189,225,255]);
 const mask=Uint8Array.from({length:w},(_,x)=>x<15?255:0);
 const map=createPaletteMap(source,w,h,['#E7CFB8','#B6D9E0'],{mask});
 assert.equal(map.source.length,1);
 const out=applyPaletteMap(source,w,h,map,{mask}).data;
 assert.deepEqual(pixel(out,w,5,0),[231,207,184,255]);
 assert.deepEqual(pixel(out,w,20,0),[145,189,225,255]);
});
test('when only one source color exists, do not invent 3 unrelated elements',()=>{
 const source=png(10,10,()=>[195,170,210,255]);
 const map=createPaletteMap(source,10,10,['#AABBCC','#DDEEFF','#CCAABB']);
 assert.equal(map.source.length,1);
 assert.equal(map.unusedTargets,2);
});
test('bad color palettes and malformed selections fail explicitly',()=>{
 const source=png(3,1,()=>[192,160,130,255]);
 assert.throws(()=>createPaletteMap(source,3,1,['#ABCDEF']),/2~6/);
 assert.throws(()=>createPaletteMap(source,3,1,['#ABCDEF','#123']),/형식/);
 const map=createPaletteMap(source,3,1,['#ABCDEF','#C0EAE4']);
 assert.throws(()=>applyPaletteMap(source,3,1,map,{mask:new Uint8Array(2)}),/크기/);
});


test('same-hue fill, shadow and dark outline stay one semantic family',()=>{
 const w=14,h=10;
 const source=png(w,h,(x,y)=>{
   if(x===0||y===0||x===w-1||y===h-1)return [82,77,88,255]; // neutral dark outline
   if(y>=7)return [176,112,139,255]; // darker pink shadow
   return [224,158,184,255]; // main pink fill
 });
 const map=createPaletteMap(source,w,h,['#9ED4F2','#F2D58B','#CFC3F5'],{preserveRoles:true});
 assert.equal(map.source.length,1,'outline/shadow must not steal extra palette slots');
 const out=applyPaletteMap(source,w,h,map).data;
 const main=pixel(out,w,5,4),shadow=pixel(out,w,5,8),outline=pixel(out,w,0,5);
 assert.deepEqual(main,[158,212,242,255],'dominant fill lands on the chosen target swatch');
 const lum=p=>.2126*p[0]+.7152*p[1]+.0722*p[2];
 assert.ok(lum(shadow)<lum(main)-18,'shadow remains darker than its fill');
 assert.ok(lum(outline)<lum(shadow)-12,'outline remains the deepest tone of the same family');
 assert.notDeepEqual(shadow,[242,213,139,255],'shadow must not become the second unrelated palette color');
 assert.notDeepEqual(outline,[207,195,245,255],'outline must not become the third unrelated palette color');
});

test('role-aware mapping preserves alpha and derives antialiased edge tones',()=>{
 const w=5,h=1;
 const source=png(w,h,x=>[
   [90,86,95,120],
   [170,110,135,200],
   [224,158,184,255],
   [180,120,145,255],
   [255,255,255,255],
 ][x]);
 const map=createPaletteMap(source,w,h,['#9ED4F2','#F1C9D9'],{preserveWhiteBlack:true,preserveRoles:true});
 const out=applyPaletteMap(source,w,h,map).data;
 for(let x=0;x<w;x++)assert.equal(out[x*4+3],source[x*4+3]);
 assert.deepEqual(pixel(out,w,4,0),[255,255,255,255]);
 const main=pixel(out,w,2,0),edge=pixel(out,w,0,0);
 const lum=p=>.2126*p[0]+.7152*p[1]+.0722*p[2];
 assert.ok(lum(edge)<lum(main),'dark antialias/outline tone stays darker without changing alpha');
});


test('broad neutral fill remains an independent palette family while thin outlines do not',()=>{
 const w=30,h=20;
 const source=png(w,h,(x,y)=>{
   if(x<17)return [88,84,94,255]; // broad charcoal design fill with real interior
   if(x===17)return [74,72,79,255]; // its darker edge
   return [225,158,184,255]; // separate pink design family
 });
 const targets=['#8CCAF0','#F4C6D6','#D9D0F4'];
 const map=createPaletteMap(source,w,h,targets,{preserveRoles:true});
 assert.equal(map.source.length,2,'a broad charcoal fill must keep its own palette slot');
 const out=applyPaletteMap(source,w,h,map).data;
 const left=pixel(out,w,8,10),right=pixel(out,w,24,10);
 assert.deepEqual(left,[140,202,240,255]);
 assert.deepEqual(right,[244,198,214,255]);
 assert.notDeepEqual(left,right);
});
