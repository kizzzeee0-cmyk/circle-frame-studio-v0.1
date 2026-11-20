import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMaskData,maskOpacity,layerConstraintAlpha,constrainSelection} from '../psd-mask-core.mjs';
function image(w,h,fn){
  const data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set([fn(x,y),0,0,255],4*(y*w+x));
  return {width:w,height:h,data};
}
test('PSD mask coordinates independent from layer bounds, defaultColor restricts outside, density works',()=>{
  const source={left:12,top:20};
  const spec=normalizeMaskData(image(2,2,(x,y)=>x===0?255:0),
    {left:16,top:22,right:18,bottom:24,defaultColor:0,userMaskDensity:1},source);
  assert.equal(spec.x,16);assert.equal(spec.y,22);
  assert.equal(maskOpacity(spec,16.5,22.5),255);
  assert.equal(maskOpacity(spec,17.5,22.5),0);
  assert.equal(maskOpacity(spec,18.5,22.5),0);
  const relative=normalizeMaskData(image(1,1,()=>0),
    {left:4,top:3,positionRelativeToLayer:true,defaultColor:255,userMaskDensity:.5},source);
  assert.equal(relative.x,16);assert.equal(relative.y,23);
  assert.equal(maskOpacity(relative,16.5,23.5),128);
  assert.equal(maskOpacity(relative,21,25),255);
});
test('effective selection clamps Photoshop bitmap mask and feathered edges without changing original',()=>{
  const maskSpec=normalizeMaskData(image(4,1,x=>[255,127,0,255][x]),
    {left:2,top:1,defaultColor:0},{left:2,top:1});
  const layer={id:1,x:2,y:1,w:4,h:1,maskSpecs:[maskSpec]};
  const selection=new Uint8Array([255,255,255,255]);
  const result=constrainSelection(selection,4,1,layer,()=>null);
  assert.deepEqual(Array.from(result.mask),[255,127,0,255]);
  assert.equal(result.count,3);
  assert.deepEqual(Array.from(selection),[255,255,255,255],'source mask is immutable');
});
test('clipping alpha of base PSD layer prevents selecting otherwise visible upper-layer pixels',()=>{
  const base={id:2,x:0,y:0,w:4,h:1,visible:true,
    canvas:{width:4,height:1},alphaPixels:Uint8Array.from([255,0,128,255])};
  const upper={id:3,x:0,y:0,w:4,h:1,visible:true,clipBaseId:2};
  const result=constrainSelection(new Uint8Array(4).fill(255),4,1,upper,
    id=>id===2?base:null);
  assert.deepEqual(Array.from(result.mask),[255,0,128,255]);
  assert.equal(result.count,3);
  assert.equal(layerConstraintAlpha(upper,1.5,.5,()=>base),0);
});
test('unsupported vector/user masks and missing clipping bases fail closed',()=>{
  const invalid={id:3,x:0,y:0,w:2,h:1,maskDecodeFailed:true};
  assert.throws(()=>constrainSelection(new Uint8Array(2).fill(255),2,1,invalid,()=>null),/차단/);
  invalid.maskDecodeFailed=false;invalid.unsupportedVectorMask=true;
  assert.throws(()=>layerConstraintAlpha(invalid,.5,.5,()=>null),/차단/);
  invalid.unsupportedVectorMask=false;invalid.clipBaseId=200;
  assert.throws(()=>layerConstraintAlpha(invalid,.5,.5,()=>null),/클리핑/);
});

test('children of masked Photoshop groups are not recolored without a decoded group mask',()=>{
 const child={id:10,x:0,y:0,w:2,h:1,unsupportedGroupMask:true};
 assert.throws(()=>constrainSelection(Uint8Array.from([255,255]),2,1,child,()=>null),/차단/);
});
