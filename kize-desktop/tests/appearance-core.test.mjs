import test from 'node:test';
import assert from 'node:assert/strict';
import {transformedSelectionRect,maskToDocumentCrop,overlayPriorPatches,makeAppearancePatch} from '../appearance-core.mjs';
import {createArchive,readArchive,FORMAT} from '../project-archive.mjs';

function rgba(w,h,fn) {
  const data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),4*(y*w+x));
  return data;
}
function crop(doc,dw,rect){
  const data=new Uint8ClampedArray(rect.w*rect.h*4);
  for(let y=0;y<rect.h;y++)data.set(doc.subarray(((y+rect.y)*dw+rect.x)*4,((y+rect.y)*dw+rect.x+rect.w)*4),y*rect.w*4);
  return data;
}
function applyPatches(base,dw,patches){
  const data=new Uint8ClampedArray(base);
  for(const p of patches)for(let y=0;y<p.h;y++)
    data.set(p.data.subarray(y*p.w*4,(y+1)*p.w*4),((y+p.y)*dw+p.x)*4);
  return data;
}
const layer={id:5,x:2,y:2,w:2,h:2,rotation:0,flipH:false,flipV:false};
const selected={w:2,h:2,mask:Uint8Array.from([255,255,255,255]),
  bounds:{x:0,y:0,w:2,h:2},sample:[220,60,80]};
test('only selected pixels change on Photoshop merged pixels with very different PSD raw layer color',()=>{
  const dw=8,dh=6;
  const merged=rgba(dw,dh,(x,y)=>[15+x*7,70+y*13,120, (x===3&&y===3)?125:255]);
  const rect=transformedSelectionRect(layer,selected,dw,dh);
  const patch=makeAppearancePatch(layer,selected,dw,dh,crop(merged,dw,rect),[],{
    mode:'solid',color:'#C070E0',preserveShading:false
  });
  assert.ok(patch);
  const result=applyPatches(merged,dw,[patch]);
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
    const off=(y*dw+x)*4;
    if(x>=2&&x<4&&y>=2&&y<4){
      assert.deepEqual(Array.from(result.slice(off,off+3)),[192,112,224]);
    }else{
      assert.deepEqual(Array.from(result.slice(off,off+4)),Array.from(merged.slice(off,off+4)),
        'Untouched Photoshop composite pixel must be byte-identical at '+x+','+y);
    }
    assert.equal(result[off+3],merged[off+3],'Alpha must be unchanged');
  }
});
test('overlapping recolors respect operation order and allow true undo by removing last patch',()=>{
  const dw=8,dh=6;
  const source=rgba(dw,dh,()=>[40,150,190,255]);
  const rect=transformedSelectionRect(layer,selected,dw,dh);
  const patch1=makeAppearancePatch(layer,selected,dw,dh,crop(source,dw,rect),[],{
    mode:'solid',color:'#FF0000',preserveShading:false
  });
  const patch2=makeAppearancePatch(layer,selected,dw,dh,crop(source,dw,rect),[patch1],{
    mode:'solid',color:'#00FF00',preserveShading:false
  });
  const once=applyPatches(source,dw,[patch1]);
  const twice=applyPatches(source,dw,[patch1,patch2]);
  const pixel=(r,x=2,y=2)=>Array.from(r.slice((y*dw+x)*4,(y*dw+x)*4+3));
  assert.deepEqual(pixel(once),[255,0,0]);
  assert.deepEqual(pixel(twice),[0,255,0]);
  assert.deepEqual(pixel(applyPatches(source,dw,[patch1])),[255,0,0]);
});
test('rotated or flipped layer mask maps to document coordinates without changing other pixels',()=>{
  const rotated={id:2,x:3,y:2,w:4,h:3,rotation:90,flipH:true,flipV:false};
  const part={w:4,h:3,mask:new Uint8Array(12).fill(255),bounds:{x:0,y:0,w:4,h:3}};
  const rect=transformedSelectionRect(rotated,part,10,10);
  assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=10&&rect.y+rect.h<=10);
  const mask=maskToDocumentCrop(rotated,part,rect);
  assert.ok(mask.count>=9&&mask.count<=18);
  assert.ok(mask.count<rect.w*rect.h);
});
test('KIZE project can round-trip original merged reference and exact appearance patch metadata',()=>{
  const tiny=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+B9S0AAAAASUVORK5CYII=','base64'));
  const manifest={format:FORMAT,width:8,height:6,composite:'reference/psd-merged.png',appearanceSafe:true,
    previewMode:'appearance',appearancePatches:[{x:2,y:2,w:2,h:2,layerId:5,bitmap:'appearance/0000.png'}],
    layers:[{id:5,name:'Sticker',x:2,y:2,w:2,h:2,bitmap:'layers/0000.png'}]};
  const bytes=createArchive(manifest,{
    'reference/psd-merged.png':tiny,'appearance/0000.png':tiny,'layers/0000.png':tiny
  });
  const data=readArchive(bytes);
  assert.equal(data.manifest.appearancePatches.length,1);
  assert.equal(data.manifest.appearancePatches[0].layerId,5);
  assert.equal(data.manifest.previewMode,'appearance');
  assert.deepEqual(data.images['appearance/0000.png'],tiny);
  assert.throws(()=>createArchive({...manifest,appearancePatches:[{x:7,y:5,w:2,h:2,bitmap:'appearance/0000.png'}]},{
    'reference/psd-merged.png':tiny,'appearance/0000.png':tiny,'layers/0000.png':tiny
  }),/좌표|크기/);
});
