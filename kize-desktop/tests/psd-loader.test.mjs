import test from 'node:test';
import assert from 'node:assert/strict';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {inspectPsdHeader,importPsdPixels} from '../psd-loader.js';

initializeCanvas(createCanvas);
const solid = (w,h,r,g,b) => {
  const pixels=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<pixels.length;i+=4){pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=255;}
  return {width:w,height:h,data:pixels};
};
const fixture = () => writePsd({
  width:5,height:4,
  children:[
    {name:'top pink',left:0,top:0,right:2,bottom:2,imageData:solid(2,2,240,120,130)},
    {name:'bottom blue',left:2,top:1,right:5,bottom:4,imageData:solid(3,3,20,50,210)}
  ]
});
test('reads real binary PSD into separate pixel layers without losing bounds',()=>{
  const f=fixture(),r=importPsdPixels(f);
  assert.equal(r.header.width,5);assert.equal(r.header.height,4);
  assert.equal(r.header.bits,8);assert.equal(r.layerTotal,2);
  assert.equal(r.layers.length,2);
  assert.equal(r.layers[0].name,'top pink');
  assert.equal(r.layers[0].bitmap.width,2);
  assert.deepEqual([r.layers[1].x,r.layers[1].y,r.layers[1].w,r.layers[1].h],[2,1,3,3]);
  assert.equal(r.layers[1].bitmap.data[2],210);
});
test('recognizes 8-, 16-, 32-bit depth and PSB header signature',()=>{
  const bytes=new Uint8Array(fixture());
  const dv=new DataView(bytes.buffer);
  assert.equal(inspectPsdHeader(bytes).bits,8);
  dv.setUint16(22,16);assert.equal(inspectPsdHeader(bytes).bits,16);
  dv.setUint16(22,32);assert.equal(inspectPsdHeader(bytes).bits,32);
  dv.setUint16(4,2);assert.equal(inspectPsdHeader(bytes).version,2);
});
test('clear error messages for malformed PSD and unsupported color mode',()=>{
  assert.throws(()=>inspectPsdHeader(new Uint8Array([1,2,3])),/짧습니다/);
  const bytes=new Uint8Array(fixture());
  const dv=new DataView(bytes.buffer);
  dv.setUint16(24,9);
  assert.throws(()=>inspectPsdHeader(bytes),/지원하지 않습니다/);
});
test('large file limitations prevent allocating malicious PSD canvas',()=>{
  const bytes=new Uint8Array(fixture()),v=new DataView(bytes.buffer);
  v.setUint32(18,50000);
  assert.throws(()=>importPsdPixels(bytes),/너무 큽니다/);
});
