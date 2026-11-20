import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {PSD_LIMITS,fileSizeAllowed} from '../psd-loader.js';

test('the file-size gate allows 600 MiB PSDs and keeps an explicit upper bound',()=>{
  assert.ok(PSD_LIMITS.fileBytes >= 600*1024*1024);
  assert.equal(fileSizeAllowed(600*1024*1024),true);
  assert.equal(fileSizeAllowed(700*1024*1024),true);
  assert.equal(fileSizeAllowed(700*1024*1024+1),false);
  assert.equal(fileSizeAllowed(-1),false);
});
test('real UI uses an isolated worker so PSD decoding does not block mouse navigation',()=>{
  const editor=readFileSync(new URL('../editor.js',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../psd.worker.js',import.meta.url),'utf8');
  assert.match(editor,/new Worker\(new URL\('\.\/psd\.worker\.js'/);
  assert.match(editor,/postMessage\(\{type:'open-psd',buffer:raw\},\[raw\]\)/);
  assert.match(worker,/importPsdPixels\(/);
  assert.match(worker,/self\.postMessage\(\{type:'complete',result\}/);
});
test('mouse wheel zoom and middle-button drag panning are both registered',()=>{
  const editor=readFileSync(new URL('../editor.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(editor,/stage\.addEventListener\('wheel'/);
  assert.match(editor,/zoomAtPointer\(zoom\*factor,e\.clientX,e\.clientY\)/);
  assert.match(editor,/e\.button===1/);
  assert.match(editor,/panX=middlePan\.panX\+e\.clientX-middlePan\.startX/);
  assert.match(editor,/panY=middlePan\.panY\+e\.clientY-middlePan\.startY/);
  assert.match(editor,/window\.addEventListener\('pointermove'/);
  assert.match(editor,/if\(!documentModel\|\|e\.button!==0\|\|middlePan\|\|spacePan\)return/);
  assert.match(css,/\.stage\{[^}]*display:block/);
  assert.match(css,/\.stage-sizer\{[^}]*width:max-content/);
});
