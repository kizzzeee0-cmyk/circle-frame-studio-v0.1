import test from 'node:test';
import assert from 'node:assert/strict';
import {regionMask,recolorPixels,photoAdjust,hexToRGB,rgbToHex,clampToCanvas} from '../engine.js';
test('hex round trip',()=>{assert.deepEqual(hexToRGB('#e58fa9'),[229,143,169]);assert.equal(rgbToHex(229,143,169),'#E58FA9');});
test('selects connected region without touching separated same-color asset',()=>{
  const pixels=new Uint8ClampedArray([
    255,0,0,255,255,0,0,255,0,0,0,0,255,0,0,255,
    255,0,0,255,255,0,0,255,0,0,0,0,255,0,0,255]);
  const m=regionMask(pixels,4,2,0,0,0,true);
  assert.deepEqual(Array.from(m),[1,1,0,0,1,1,0,0]);
  const all=regionMask(pixels,4,2,0,0,0,false);
  assert.deepEqual(Array.from(all),[1,1,0,1,1,1,0,1]);
});
test('recolor preserves unselected pixels and exact alpha',()=>{
  const pixels=new Uint8ClampedArray([100,100,100,75,50,60,70,200]);
  const out=recolorPixels(pixels,2,1,Uint8Array.from([1,0]),'#FF0000');
  assert.equal(out.count,1);assert.equal(out.data[0],255);assert.equal(out.data[1],0);assert.equal(out.data[3],75);
  assert.deepEqual(Array.from(out.data.slice(4)),[50,60,70,200]);
  assert.deepEqual(Array.from(pixels),[100,100,100,75,50,60,70,200]);
});
test('photo adjustments preserve alpha, lengths and input',()=>{
  const original=new Uint8ClampedArray([65,95,135,127,12,56,78,255]);
  const out=photoAdjust(original,{exposure:25,contrast:10,saturation:5,warmth:-8,shadows:12});
  assert.equal(out.length,original.length);assert.equal(out[3],127);assert.equal(out[7],255);
  assert.deepEqual(Array.from(original),[65,95,135,127,12,56,78,255]);
});
test('clamp to available canvas bounds',()=>{assert.deepEqual(clampToCanvas(90,-3,20,30,100,100),{x:80,y:0});});
test('zero tolerance ignores transparent pixels',()=>{
  const px=new Uint8ClampedArray([1,2,3,0,1,2,3,255]);
  assert.deepEqual(Array.from(regionMask(px,2,1,1,0,0,true)),[0,1]);
});
