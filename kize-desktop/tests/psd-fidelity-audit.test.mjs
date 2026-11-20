import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPhotoshopLayer,summarizePsdCompatibility} from '../psd-compatibility.mjs';
import {compareRgba,publicFidelityReport} from '../fidelity-audit.mjs';

test('Photoshop clipping, masks, effects, special blending and group masks are classified, never called fully supported',()=>{
  const layer={
    id:8,name:'Heart',opacity:.8,blendMode:'multiply',
    clipping:true,mask:{disabled:false},vectorMask:{},
    effects:{stroke:[{enabled:true}],dropShadow:[{enabled:false}]},
    text:{text:'KIZE'},placedLayer:{},adjustment:{type:'curves'}
  };
  const meta=inspectPhotoshopLayer(layer,[{name:'Decor',key:'root/1',blendMode:'pass through',masked:true}]);
  assert.equal(meta.complexity,'caution');
  assert.equal(meta.mask,true);assert.equal(meta.vectorMask,true);assert.equal(meta.clipping,true);
  assert.equal(meta.advancedBlend,true);
  assert.equal(meta.groupEffects,true);
  assert.deepEqual(meta.effects,['stroke'],'disabled effects must not be classified as active');
  assert.deepEqual(meta.groupPath,['Decor']);
  assert.deepEqual(meta.groupKeys,['root/1']);
  assert.ok(meta.issues.some(x=>x.includes('레이어 효과')));
  assert.ok(meta.issues.some(x=>x.includes('클리핑')));
  assert.ok(meta.issues.some(x=>x.includes('그룹')));
});
test('PSD compatibility reports preserve group identity even when groups share name',()=>{
  const a=inspectPhotoshopLayer({name:'Layer' },[{name:'Graphics',key:'root/0'}]);
  const b=inspectPhotoshopLayer({name:'Layer',vectorMask:{disabled:true}},[{name:'Graphics',key:'root/2'}]);
  const summary=summarizePsdCompatibility([{compatibility:a},{compatibility:b}],{compositeAvailable:true,skippedCount:3});
  assert.equal(summary.counts.groups,2);
  assert.equal(summary.counts.skipped,3);
  assert.equal(summary.counts.caution,0);
  assert.equal(summary.counts.vectorMask,0,'disabled vector mask does not claim active');
  assert.ok(summary.observations.some(x=>x.includes('제외')));
});
test('RGBA comparator ignores arbitrary RGB hidden under fully transparent pixels',()=>{
  const a=Uint8ClampedArray.from([220,80,20,0,0,0,0,255]);
  const b=Uint8ClampedArray.from([0,255,255,0,0,0,0,255]);
  const d=compareRgba(a,b,2,1,{threshold:0});
  assert.equal(d.mismatched,0);
  assert.equal(d.matchPercent,100);
  assert.equal(d.heatmap[3],0);
});
test('RGBA comparator catches visible color and opacity changes and produces accurate red heatmap',()=>{
  const before=Uint8ClampedArray.from([20,40,60,255, 255,255,255,255, 0,0,0,0, 30,40,50,255]);
  const after=Uint8ClampedArray.from([20,40,60,255, 80,50,20,255, 0,0,0,255, 30,40,50,255]);
  const d=compareRgba(before,after,2,2,{threshold:12});
  assert.equal(d.mismatched,2);
  assert.equal(d.changedPercent,50);
  assert.equal(d.matchPercent,50);
  assert.equal(d.alphaMismatch,1);
  assert.equal(d.heatmap[4],255);
  assert.equal(d.heatmap[0+3],0);
  assert.ok(d.heatmap[4+3]>=115);
  assert.equal(d.verdict,'different');
  const json=publicFidelityReport(d,{name:'sample.psd',width:2,height:2,layers:[{name:'A',type:'image',visible:true,opacity:1}]});
  assert.equal(json.schema,'kize-psd-fidelity-1');
  assert.equal(json.changedPercent,50);
  assert.ok(!Object.hasOwn(json,'heatmap'),'diagnostic JSON should omit huge binary buffers');
  assert.equal(json.layers.length,1);
});
