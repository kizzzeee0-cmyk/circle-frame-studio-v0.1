import test from 'node:test';
import assert from 'node:assert/strict';
import {colorSelection,paintSelection,normalizedStops,gradientAt} from '../color-tools.mjs';

function pixels(w,h,fn){
  const a=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=(y*w+x)*4,rgba=fn(x,y);
    for(let ch=0;ch<4;ch++)a[p+ch]=rgba[ch];
  }
  return a;
}
test('a connected color family excludes an adjacent unrelated color and isolated same-colored island',()=>{
  const w=9,h=5;
  const img=pixels(w,h,(x,y)=>{
    if(x===4)return [0,0,255,255];
    if(x>=6)return [240,60,80,255];
    return [240,60,80,255];
  });
  const selection=colorSelection(img,w,h,1,1,{tolerance:8,connected:true});
  assert.equal(selection.count,20);
  assert.equal(selection.mask[1*w+1],255);
  assert.equal(selection.mask[1*w+7],0,'same-colored island separated by blue should not select');
  assert.equal(selection.mask[1*w+4],0,'blue should not select');
  const all=colorSelection(img,w,h,1,1,{tolerance:8,connected:false});
  assert.equal(all.mask[1*w+7],255,'non-connected mode includes similar colors elsewhere in same layer');
});
test('a color tolerance is local to the selected hue family',()=>{
  const px=pixels(4,1,x=>x===0?[200,90,110,255]:x===1?[201,94,108,255]:x===2?[0,255,0,255]:[210,80,100,0]);
  const s=colorSelection(px,4,1,0,0,{tolerance:8,connected:false});
  assert.equal(s.mask[0],255);assert.equal(s.mask[1],255);
  assert.equal(s.mask[2],0);assert.equal(s.mask[3],0,'transparent pixels are ignored');
});
test('solid recolor preserves alpha and never modifies unselected pixels',()=>{
  const rgba=new Uint8ClampedArray([255,0,0,80,10,20,30,230]);
  const s={mask:Uint8Array.from([255,0]),sample:[255,0,0],bounds:{x:0,y:0,w:1,h:1}};
  const result=paintSelection(rgba,2,1,s,{mode:'solid',color:'#55CCAA',preserveShading:false});
  assert.deepEqual(Array.from(result.data),[85,204,170,80,10,20,30,230]);
  assert.deepEqual(Array.from(rgba),[255,0,0,80,10,20,30,230]);
});
test('gradient stop colors, ratios, positions and angle are editable',()=>{
  const stops=normalizedStops([
    {color:'#0000FF',position:100},
    {color:'#00FF00',position:25},
    {color:'#FF0000',position:0}
  ]);
  assert.deepEqual(stops.map(s=>s.position),[0,25,100]);
  assert.deepEqual(gradientAt(0,stops).map(Math.round),[255,0,0]);
  assert.deepEqual(gradientAt(.25,stops).map(Math.round),[0,255,0]);
  assert.deepEqual(gradientAt(1,stops).map(Math.round),[0,0,255]);
  const src=pixels(5,2,()=>[200,180,160,255]);
  const mask=new Uint8Array(10).fill(255);
  const layer={mask,sample:[200,180,160],bounds:{x:0,y:0,w:5,h:2}};
  const horizontal=paintSelection(src,5,2,layer,{
    mode:'gradient',angle:90,
    stops:[{color:'#FF0000',position:0},{color:'#0000FF',position:100}],preserveShading:false
  }).data;
  assert.ok(horizontal[0]>horizontal[16],'left edge red channel exceeds right');
  assert.ok(horizontal[2]<horizontal[18],'right edge blue channel exceeds left');
  const vertical=paintSelection(src,5,2,layer,{
    mode:'gradient',angle:0,
    stops:[{color:'#FF0000',position:0},{color:'#0000FF',position:100}],preserveShading:false
  }).data;
  assert.ok(vertical[0]>vertical[5*4],'top should be more red');
});
test('antialias fringe colors blend without changing source transparency',()=>{
  const px=pixels(3,1,x=>x===0?[180,60,100,255]:x===1?[195,75,115,127]:[250,250,250,255]);
  const selection=colorSelection(px,3,1,0,0,{connected:true,tolerance:8});
  assert.equal(selection.mask[0],255);
  assert.ok(selection.mask[1]>0&&selection.mask[1]<255);
  assert.equal(selection.mask[2],0);
  const out=paintSelection(px,3,1,selection,{color:'#0000FF',preserveShading:false}).data;
  assert.equal(out[3],255);assert.equal(out[7],127);
  assert.deepEqual(Array.from(out.slice(8)),[250,250,250,255]);
});
