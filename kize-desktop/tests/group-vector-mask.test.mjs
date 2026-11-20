import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {rasterizeVectorMask,vectorMaskSupported} from '../psd-vector-mask.mjs';
import {layerConstraintAlpha} from '../psd-mask-core.mjs';
function point(x,y){return {linked:true,points:[x,y,x,y,x,y]};}
const square={fillStartsWithAllPixels:false,paths:[{
  open:false,fillRule:'even-odd',operation:'combine',
  knots:[point(3,2),point(11,2),point(11,10),point(3,10)]
}]};
test('real Photoshop Bezier pixel-coordinate vector mask rasterizes precisely for selection',()=>{
  assert.equal(vectorMaskSupported(square,16,16),true);
  const mask=rasterizeVectorMask(square,16,16,createCanvas);
  assert.equal(mask.pixels[6*16+6],255);
  assert.equal(mask.pixels[0],0);
  assert.equal(mask.pixels[12*16+6],0);
  const layer={x:0,y:0,w:16,h:16,maskSpecs:[mask]};
  assert.equal(layerConstraintAlpha(layer,6.5,6.5,()=>null),255);
  assert.equal(layerConstraintAlpha(layer,12.5,6.5,()=>null),0);
});
test('open paths, unsupported boolean operations and inverted masks fail closed',()=>{
  for(const variant of [
    {...square,paths:[{...square.paths[0],open:true}]},
    {...square,paths:[{...square.paths[0],operation:'subtract'}]},
    {...square,invert:true},
    {...square,fillStartsWithAllPixels:true},
    {...square,paths:[{...square.paths[0],knots:[]}]}
  ]){
    assert.equal(vectorMaskSupported(variant,16,16),false);
    assert.throws(()=>rasterizeVectorMask(variant,16,16,createCanvas),/안전하게 편집/);
  }
});
test('layer selection constrains own mask, two nested group masks, including clipping base',()=>{
  const ones=(w,h,cols)=>({x:0,y:0,w,h,density:1,defaultColor:0,
    pixels:Uint8Array.from(Array.from({length:w*h},(_,i)=>cols(i%w,Math.floor(i/w))))});
  const groupA=ones(4,1,x=>x>=1?255:0);
  const groupB=ones(4,1,x=>x<=2?255:0);
  const base={id:1,x:0,y:0,w:4,h:1,visible:true,
    canvas:{width:4,height:1},alphaPixels:Uint8Array.from([255,255,255,255])};
  const child={id:2,x:0,y:0,w:4,h:1,clipBaseId:1,
    groupMaskSpecs:[groupA,groupB]};
  assert.deepEqual([0,1,2,3].map(x=>layerConstraintAlpha(child,x+.5,.5,id=>id===1?base:null)),
    [0,255,255,0]);
});

test('clipped Photoshop layer does not square the alpha of its shared parent group mask',()=>{
  const group={x:0,y:0,w:2,h:1,density:1,defaultColor:0,
    pixels:Uint8Array.from([128,255])};
  const base={id:91,visible:true,x:0,y:0,w:2,h:1,canvas:{width:2,height:1},
    alphaPixels:Uint8Array.from([255,255]),groupMaskSpecs:[group]};
  const child={id:92,x:0,y:0,w:2,h:1,clipBaseId:91,groupMaskSpecs:[group]};
  assert.equal(layerConstraintAlpha(child,.5,.5,id=>id===91?base:null),128);
  assert.equal(layerConstraintAlpha(child,1.5,.5,id=>id===91?base:null),255);
});
