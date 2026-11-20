import test from 'node:test';
import assert from 'node:assert/strict';
import {FORMAT,createArchive,readArchive,validateManifest} from '../project-archive.mjs';

const png=Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+B9S0AAAAASUVORK5CYII=',
  'base64'
));
const meta=()=>({
  format:FORMAT,width:200,height:120,name:'banner.psd',edited:true,
  previewMode:'composite',composite:'reference/psd-merged.png',
  layers:[{
    id:9,name:'Portrait / Girl',x:20,y:10,w:150,h:90,
    opacity:.8,visible:true,blend:'source-over',
    adjust:{exposure:22,contrast:-7},
    bitmap:'layers/0000.png',photoBitmap:'photos/0000.png'
  }]
});
test('editable project keeps PSD merged reference, layer metadata and original replacement photo as separate byte arrays',()=>{
  const bytes=createArchive(meta(),{
    'layers/0000.png':png,'photos/0000.png':png,'reference/psd-merged.png':png
  });
  assert.ok(bytes.length<2000);
  const {manifest,images}=readArchive(bytes);
  assert.equal(manifest.format,FORMAT);
  assert.equal(manifest.layers[0].id,9);
  assert.equal(manifest.layers[0].adjust.exposure,22);
  assert.equal(manifest.layers[0].photoBitmap,'photos/0000.png');
  assert.equal(manifest.composite,'reference/psd-merged.png');
  assert.deepEqual(images['layers/0000.png'],png);
  assert.deepEqual(images['photos/0000.png'],png);
  assert.deepEqual(images[manifest.composite],png);
});
test('invalid or incomplete project fails clearly instead of silently dropping a layer',()=>{
  assert.throws(()=>readArchive(Uint8Array.from([1,2,3])),/범위/);
  const m=meta();
  assert.throws(()=>createArchive(m,{'layers/0000.png':png}),/누락/);
  const weird=meta();weird.layers[0].bitmap='../outside.png';
  assert.throws(()=>validateManifest(weird),/메타데이터/);
  const tooLarge=meta();tooLarge.width=99999;
  assert.throws(()=>validateManifest(tooLarge),/규격/);
});
test('photo replacement and its adjustment metadata survive validation without baking the photo into the base image',()=>{
  const m=validateManifest(meta());
  assert.equal(m.layers[0].adjust.contrast,-7);
  assert.ok(m.layers[0].photoBitmap!==m.layers[0].bitmap);
  assert.equal(m.layers[0].opacity,.8);
});
