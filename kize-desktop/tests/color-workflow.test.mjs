import test from 'node:test';
import assert from 'node:assert/strict';
import {pastelizeHex,effectiveColor,paintPolicy,defaultImportSelection} from '../color-workflow.mjs';
import {PALETTE_PRESETS,paletteByLabel} from '../palette-presets.mjs';
import {colorSelection,paintSelection} from '../color-tools.mjs';

const rgb=(w,h,at)=>{
  const a=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)a.set(at(x,y),(y*w+x)*4);
  return a;
};
test('chosen HEX remains exact by default (no invisible hue rotation or shading)',()=>{
  const opts=paintPolicy({color:'#dd4488',finish:'exact',tintAsset:true,protectWhite:true,preserveShading:true},'asset');
  assert.equal(opts.color,'#DD4488');
  assert.equal(opts.preserveShading,false);
  assert.equal(opts.smartPalette,false);
  const source=rgb(3,1,(x)=>x===0?[95,180,120,255]:x===1?[255,255,255,255]:[8,8,8,255]);
  const selected={mask:Uint8Array.of(255,255,255),bounds:{x:0,y:0,w:3,h:1},sample:[95,180,120]};
  const output=paintSelection(source,3,1,selected,opts).data;
  assert.deepEqual(Array.from(output.slice(0,4)),[221,68,136,255]);
  assert.deepEqual(Array.from(output.slice(4,8)),[255,255,255,255]);
  assert.deepEqual(Array.from(output.slice(8,12)),[8,8,8,255]);
});
test('pastel softening is explicit, monotonic and can preserve exact when zero',()=>{
  assert.equal(pastelizeHex('#CC6688',0),'#CC6688');
  assert.equal(pastelizeHex('#CC6688',50),'#E6B3C4');
  assert.equal(effectiveColor('#9cafd2','exact',85),'#9CAFD2');
  assert.equal(effectiveColor('#9cafd2','pastel',0),'#9CAFD2');
  assert.notEqual(effectiveColor('#9cafd2','pastel',60),'#9CAFD2');
  assert.throws(()=>pastelizeHex('NOTHEX',50),/HEX/);
});
test('PSD style modes are opt-in; batch color exact behaves as direct apply',()=>{
  const opts=paintPolicy({color:'#c8bad4',finish:'exact',tintAsset:false},'color');
  assert.equal(opts.color,'#C8BAD4');
  assert.equal(opts.tintAsset,false);
  assert.equal(opts.preserveShading,false);
  const gradient=paintPolicy({color:'#AABBCC',mode:'gradient',
    stops:[{color:'#cc6688',position:0},{color:'#AACCDD',position:100}],
    finish:'pastel',softness:50},'color');
  assert.equal(gradient.mode,'gradient');
  assert.equal(gradient.stops[0].color,'#E6B3C4');
  assert.equal(gradient.stops[1].color,'#D5E6EE');
});
test('color-only selection on a connected four-color border does not absorb whole PNG',()=>{
  const w=12,h=12;
  const data=rgb(w,h,(x,y)=>{
    if(x===0||y===0)return [198,166,209,255];
    if(x===w-1||y===h-1)return [172,205,154,255];
    if(x>2&&x<9&&y>2&&y<9)return [0,0,0,0];
    return [235,201,173,255];
  });
  const selection=colorSelection(data,w,h,0,1,{tolerance:10,connected:true});
  assert.ok(selection.count>0);
  assert.ok(selection.count<w*h/2,'Selecting lavender should not select all colored border');
  assert.equal(selection.mask[0],255);
  assert.equal(selection.mask[5*w+11],0,'Green edge is not selected');
  assert.equal(defaultImportSelection('IMAGE'),'color');
  assert.equal(defaultImportSelection('PSD'),'color');
});
test('palette library includes diverse curated pastel combinations, all valid',()=>{
  assert.ok(PALETTE_PRESETS.length>=30);
  const groups=new Set(PALETTE_PRESETS.map(p=>p.group));
  assert.ok(groups.size>=4);
  for(const p of PALETTE_PRESETS){
    assert.ok(p.colors.length>=2&&p.colors.length<=6);
    assert.ok(p.colors.every(c=>/^#[0-9A-Fa-f]{6}$/.test(c)));
    assert.equal(paletteByLabel(p.label),p);
  }
  assert.equal(paletteByLabel('없는 팔레트'),null);
});
