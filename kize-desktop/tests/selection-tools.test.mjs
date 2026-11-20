import test from 'node:test';
import assert from 'node:assert/strict';
import {growShrinkMask,maskBounds,selectAssetRegion,unionRegionParts} from '../selection-tools.mjs';
import {paintSelection} from '../color-tools.mjs';

const rgba=(w,h,fn)=>{const b=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=4*(y*w+x),a=fn(x,y);b.set(a,i);}return b;};
test('growing a PNG mask expands by a controlled pixel distance with a smooth diagonal edge',()=>{
  const w=11,h=11,src=new Uint8Array(w*h);
  for(let y=4;y<=6;y++)for(let x=4;x<=6;x++)src[y*w+x]=255;
  const grown=growShrinkMask(src,w,h,2);
  assert.equal(grown[5*w+5],255);
  assert.ok(grown[3*w+5]>0);
  assert.ok(grown[2*w+2]===0);
  const meta=maskBounds(grown,w,h);assert.ok(meta.count>9);
  assert.equal(grown[0],0);
  assert.deepEqual(Array.from(src).filter(x=>x>0).length,9,'original selection must remain intact');
});
test('shrinking a PNG selection removes ragged fringe without blurring document pixels',()=>{
  const w=12,h=12,mask=new Uint8Array(w*h);
  for(let y=2;y<=9;y++)for(let x=2;x<=9;x++)mask[y*w+x]=255;
  const shrunken=growShrinkMask(mask,w,h,-2);
  assert.equal(shrunken[5*w+5],255);
  assert.equal(shrunken[2*w+2],0);
  assert.equal(shrunken[3*w+3],0);
  assert.ok(maskBounds(shrunken,w,h).count<maskBounds(mask,w,h).count);
});
test('asset select treats shadow, white highlight and fill as one attached transparent PSD asset',()=>{
  const w=14,h=7;
  const data=rgba(w,h,(x,y)=>{
    if(y>=1&&y<=5&&x>=1&&x<=5){
      if(x===1)return [35,42,48,255];
      if(y===2&&x===4)return [255,255,255,255];
      return [170,200,70,255];
    }
    if(y>=1&&y<=5&&x>=9&&x<=12)return [170,200,70,255];
    return [0,0,0,0];
  });
  const a=selectAssetRegion(data,w,h,2,3);
  assert.equal(a.mask[2*w+4],255,'inner white highlight included in connected asset selection');
  assert.equal(a.mask[3*w+1],255,'dark outline selected as part of asset');
  assert.equal(a.mask[3*w+10],0,'separated second asset remains unselected');
  const b=selectAssetRegion(data,w,h,10,3);
  assert.equal(b.mask[3*w+10],255);
  const union=unionRegionParts([a,b],w,h);
  assert.ok(union.count>a.count);
});
test('whole-asset recoloring changes fills and shadows coherently but retains white and near-black strokes',()=>{
  const src=rgba(5,1,x=>[
    [170,200,70,255],
    [106,133,45,255],
    [255,255,255,255],
    [5,5,5,255],
    [0,0,0,0]
  ][x]);
  const selection={mask:Uint8Array.from([255,255,255,255,0]),bounds:{x:0,y:0,w:4,h:1},sample:[170,200,70]};
  const result=paintSelection(src,5,1,selection,{mode:'solid',color:'#9389DE',tintAsset:true,protectWhite:true,preserveShading:true});
  assert.ok(result.data[2]>result.data[0]&&result.data[2]>result.data[1],'fill changed from yellow-green to violet hue');
  assert.ok(result.data[6]>result.data[4],'shadow changed to same violet hue');
  assert.ok(result.data[4]<result.data[0],'shadow remains darker than main fill');
  assert.deepEqual(Array.from(result.data.slice(8,12)),[255,255,255,255]);
  assert.deepEqual(Array.from(result.data.slice(12,16)),[5,5,5,255]);
  assert.deepEqual(Array.from(result.data.slice(16,20)),[0,0,0,0]);
});
