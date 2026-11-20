import test from 'node:test';
import assert from 'node:assert/strict';
import {maskedLayerRgba} from '../masked-preview.mjs';
test('PSD raster mask removes hidden upper-layer pixels only in reconstruction, never source',()=>{
  const rgba=Uint8ClampedArray.from([240,30,90,255,240,30,90,255,240,30,90,255]);
  const layer={x:1,y:2,w:3,h:1,
    maskSpecs:[{x:1,y:2,w:3,h:1,defaultColor:0,density:1,pixels:Uint8Array.from([255,128,0])}]};
  const preview=maskedLayerRgba(rgba,3,1,layer,()=>null);
  assert.deepEqual([preview[3],preview[7],preview[11]],[255,128,0]);
  assert.deepEqual([rgba[3],rgba[7],rgba[11]],[255,255,255]);
});
test('reconstructed clipped layer uses base shape alpha and its mask',()=>{
  const rgba=new Uint8ClampedArray(4*4);
  for(let i=0;i<rgba.length;i+=4)rgba.set([130,60,230,255],i);
  const base={id:1,x:0,y:0,w:4,h:4,visible:true,canvas:{width:4,height:4},
    alphaPixels:new Uint8Array(16).fill(255),
    maskSpecs:[{x:0,y:0,w:4,h:4,defaultColor:0,density:1,pixels:new Uint8Array(16).map((_,i)=>i%4<2?255:0)}]};
  const upper={id:2,x:0,y:0,w:4,h:4,clipBaseId:1};
  const out=maskedLayerRgba(rgba,4,4,upper,id=>id===1?base:null);
  assert.equal(out[3],255);
  assert.equal(out[2*4+3],0);
});
