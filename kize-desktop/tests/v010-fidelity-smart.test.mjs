import test from 'node:test';
import assert from 'node:assert/strict';
import {layerPixelAtDocument,sourcePixelToDocument,pointIsOccluded,protectOccludedPixels} from '../visible-occlusion.mjs';
import {growShrinkMask,maskBounds} from '../selection-tools.mjs';
import {layerConstraintAlpha,constrainSelection} from '../psd-mask-core.mjs';
import {maskedLayerRgba} from '../masked-preview.mjs';
import {rotateAssetPalette,rgbToHsv} from '../smart-palette.mjs';
import {parseVariantColors,variantFileName} from '../palette-variants.mjs';

const layer=(id,w,h,alpha,extra={})=>({
  id,name:'test '+id,x:0,y:0,w,h,visible:true,opacity:1,
  canvas:{width:w,height:h},alphaPixels:Uint8Array.from(alpha),...extra
});
const getAlpha=(l,x,y)=>l.alphaPixels[y*l.canvas.width+x]??0;
test('upper visible PSD pixels never get recolored through selected lower layer',()=>{
  const lower=layer(1,4,1,[255,255,255,255]);
  const upper=layer(2,4,1,[0,255,128,0]);
  const selection=new Uint8Array(4).fill(255);
  const kept=protectOccludedPixels(selection,4,1,lower,[lower,upper],getAlpha);
  assert.deepEqual(Array.from(kept),[255,0,0,255]);
  assert.deepEqual(Array.from(selection),[255,255,255,255]);
  assert.equal(pointIsOccluded(lower,1.5,.5,[lower,upper],getAlpha),true);
  assert.equal(pointIsOccluded(lower,.5,.5,[lower,upper],getAlpha),false);
});
test('occlusion follows rotation and flips, not a raw bounding box',()=>{
  const lower=layer(1,3,1,[255,255,255]);
  const upper=layer(2,3,1,[255,0,0],{rotation:180});
  assert.deepEqual(Array.from(protectOccludedPixels(new Uint8Array(3).fill(255),
    3,1,lower,[lower,upper],getAlpha)),[255,255,0]);
  const center=sourcePixelToDocument(lower,0,0,3,1);
  assert.deepEqual(layerPixelAtDocument(lower,center.x,center.y),{x:0,y:0});
});
test('unknown PSD mask is fail-closed in approximate preview and upper occlusion',()=>{
  const lower=layer(1,1,1,[255]);
  const unknown=layer(2,1,1,[255],{unsupportedGroupMask:true});
  assert.equal(pointIsOccluded(lower,.5,.5,[lower,unknown],getAlpha),true);
  assert.throws(()=>maskedLayerRgba(Uint8ClampedArray.from([20,40,60,255]),
    1,1,unknown,()=>null),/표시할 수 없습니다/);
});
test('rotated clipped base alpha maps document coordinates precisely',()=>{
  const base=layer(2,2,1,[255,0],{rotation:180});
  const upper=layer(3,2,1,[255,255],{clipBaseId:2});
  assert.equal(layerConstraintAlpha(upper,.5,.5,id=>id===2?base:null),0);
  assert.equal(layerConstraintAlpha(upper,1.5,.5,id=>id===2?base:null),255);
});
test('selection only multiplies soft PSD alpha once',()=>{
  const mask={x:0,y:0,w:1,h:1,pixels:Uint8Array.of(127),defaultColor:0,density:1};
  const target=layer(1,1,1,[255],{maskSpecs:[mask]});
  const result=constrainSelection(Uint8Array.of(255),1,1,target,()=>null);
  assert.equal(result.mask[0],127);
});
test('full canvas selection erodes against virtual outside boundary',()=>{
  const mask=new Uint8Array(5*5).fill(255);
  const smaller=growShrinkMask(mask,5,5,-1);
  assert.equal(smaller[0],0);
  assert.equal(smaller[2*5+2],255);
  assert.ok(maskBounds(smaller,5,5).count<25);
});
test('smart recolor preserves distinct hues and neutral whites',()=>{
  const sample=[170,200,70],pink=[225,92,151],target=[130,95,215];
  const a=rotateAssetPalette(sample,sample,target);
  const b=rotateAssetPalette(pink,sample,target);
  assert.ok(Math.abs(rgbToHsv(...a).h-rgbToHsv(...b).h)>20);
  assert.deepEqual(rotateAssetPalette([255,255,255],sample,target),[255,255,255]);
  assert.deepEqual(rotateAssetPalette([20,20,20],sample,target),[20,20,20]);
});
test('batch variant colors are validated and deterministic',()=>{
  assert.deepEqual(parseVariantColors('#abcdef, #123456, #ABCDEF'),['#ABCDEF','#123456']);
  assert.throws(()=>parseVariantColors('#123456,invalid'),/형식/);
  assert.throws(()=>parseVariantColors('#123456,#123456'),/서로 다른/);
  assert.equal(variantFileName('design.psd','#ABCDEF',0),'design-color-01-ABCDEF.png');
});
