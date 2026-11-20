import test from 'node:test';
import assert from 'node:assert/strict';
import {maskedLayerRgba} from '../masked-preview.mjs';
import {colorSelection} from '../color-tools.mjs';
test('PSD raster mask removes hidden upper-layer pixels only in reconstruction, never source',()=>{
  const rgba=Uint8ClampedArray.from([240,30,90,255,240,30,90,255,240,30,90,255]);
  const layer={x:1,y:2,w:3,h:1,
    maskSpecs:[{x:1,y:2,w:3,h:1,defaultColor:0,density:1,pixels:Uint8Array.from([255,128,0])}]};
  const preview=maskedLayerRgba(rgba,3,1,layer,()=>null);
  assert.deepEqual([preview[3],preview[7],preview[11]],[255,128,0]);
  assert.deepEqual([rgba[3],rgba[7],rgba[11]],[255,255,255]);
});
test('reconstructed clipped layer uses base shape alpha and its mask',()=>{
  const rgba=new Uint8ClampedArray(4*4*4);
  for(let i=0;i<rgba.length;i+=4)rgba.set([130,60,230,255],i);
  const base={id:1,x:0,y:0,w:4,h:4,visible:true,canvas:{width:4,height:4},
    alphaPixels:new Uint8Array(16).fill(255),
    maskSpecs:[{x:0,y:0,w:4,h:4,defaultColor:0,density:1,pixels:new Uint8Array(16).map((_,i)=>i%4<2?255:0)}]};
  const upper={id:2,x:0,y:0,w:4,h:4,clipBaseId:1};
  const out=maskedLayerRgba(rgba,4,4,upper,id=>id===1?base:null);
  assert.equal(out[3],255);
  assert.equal(out[2*4+3],0);
});

test('connected PSD selection does not flood through invisible pixels into another exposed asset',()=>{
 const rgba=new Uint8ClampedArray(5*4);
 for(let x=0;x<5;x++)rgba.set([220,50,100,255],x*4);
 const layer={x:0,y:0,w:5,h:1,maskSpecs:[{x:0,y:0,w:5,h:1,defaultColor:0,density:1,pixels:Uint8Array.from([255,255,0,255,255])}]};
 const constrained=maskedLayerRgba(rgba,5,1,layer,()=>null);
 const selected=colorSelection(constrained,5,1,0,0,{tolerance:2,connected:true});
 assert.deepEqual(Array.from(selected.mask),[255,255,0,0,0]);
});
