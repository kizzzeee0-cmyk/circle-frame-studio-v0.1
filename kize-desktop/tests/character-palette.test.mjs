import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCharacterPixels,generateCharacterPalettes,tuneColor} from '../character-palette.mjs';

const make=(w,h,fn)=>{const d=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)d.set(fn(x,y),(y*w+x)*4);return d;};
test('Character reference: ignores transparency and finds at least 5 distinct HEX colors',()=>{
  const w=60,h=50;
  const colors=[
    [232,222,219,255],[95,158,211,255],[229,155,165,255],
    [55,62,73,255],[180,202,163,255],[240,222,148,255],[166,140,195,255]
  ];
  const data=make(w,h,(x,y)=>x<3||x>=w-3||y<3||y>=h-3
    ?[0,0,0,0]:colors[Math.floor((x-3)/8)%colors.length]);
  const original=Array.from(data);
  const result=analyzeCharacterPixels(data,w,h,{limit:7});
  assert.ok(result.swatches.length>=5&&result.swatches.length<=8);
  assert.ok(result.transparent>0);
  for(const swatch of result.swatches)assert.match(swatch.hex,/^#[0-9A-F]{6}$/);
  assert.deepEqual(Array.from(data),original,'analyzing never changes source pixels');
});
test('12 diverse choices preserve explicit image roles and a locked HEX',()=>{
  const swatches=[
    {hex:'#BDD7EE',role:'main',locked:true},
    {hex:'#EFC4D6',role:'sub'},
    {hex:'#FFF9F0',role:'light'},
    {hex:'#D3AA74',role:'point'},
    {hex:'#455160',role:'outline'}
  ];
  const palettes=generateCharacterPalettes(swatches);
  assert.equal(palettes.length,12);
  assert.ok(palettes.every(p=>p.colors.length===5));
  assert.ok(palettes.every(p=>p.colors[0]==='#BDD7EE'),'locked main never secretly changes');
  assert.ok(new Set(palettes.map(p=>p.colors.join(','))).size>=8,'eight visually distinct variants');
  assert.ok(palettes.every(p=>p.colors.every(v=>/^#[A-F0-9]{6}$/.test(v))));
});
test('Manual exclusions and role choices are respected',()=>{
  const source=[
    {hex:'#BBDDF2',role:'main'},
    {hex:'#F6CBD9',role:'point'},
    {hex:'#494455',role:'outline',locked:true},
    {hex:'#D3E6BB',role:'sub',excluded:true}
  ];
  const variants=generateCharacterPalettes(source);
  assert.equal(variants.length,12);
  assert.ok(variants.every(v=>v.colors[4]==='#494455'));
  assert.notDeepEqual(variants[0].colors[1],source[3].hex);
});
test('Reference hue and brightness adjustments stay valid without forcing pink/lavender',()=>{
  assert.match(tuneColor('#88B8C3',{lightness:.15,saturation:-.12}),/^#[A-F0-9]{6}$/);
  const variants=generateCharacterPalettes([{hex:'#B9CFA0',role:'main'},
    {hex:'#556B59',role:'outline'},{hex:'#D8D7CA',role:'light'}]);
  assert.ok(variants.length>=12);
});
