import test from 'node:test';
import assert from 'node:assert/strict';
import {writePsd,readPsd,getLayerImageData} from 'ag-psd';

// A real PSD roundtrip: verifies the decoder API used by KIZE can retrieve
// separate bitmap layers without flattening the document.
test('PSD binary contains independent layer bitmaps and coordinates',()=>{
  const pix=new Uint8Array([240,120,130,255,240,120,130,255,240,120,130,255,240,120,130,255]);
  const psd={width:4,height:4,children:[{
    name:'pink asset',left:1,top:1,right:3,bottom:3,
    imageData:{width:2,height:2,data:pix}
  }]};
  const bytes=writePsd(psd);
  const out=readPsd(bytes,{useRawData:true,useRawThumbnail:true});
  assert.equal(out.width,4);assert.equal(out.height,4);
  assert.equal(out.children[0].name,'pink asset');
  assert.equal(out.children[0].left,1);
  const decoded=getLayerImageData(out.children[0]);
  assert.equal(decoded.width,2);assert.equal(decoded.height,2);
  assert.equal(decoded.data[0],240);assert.equal(decoded.data[1],120);assert.equal(decoded.data[3],255);
});
