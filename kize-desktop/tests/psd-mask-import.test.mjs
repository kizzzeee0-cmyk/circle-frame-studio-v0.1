import test from 'node:test';
import assert from 'node:assert/strict';
import {writePsd,initializeCanvas} from 'ag-psd';
import {createCanvas} from '@napi-rs/canvas';
import {importPsdPixels} from '../psd-loader.js';

initializeCanvas(createCanvas);
const bitmap=(w,h,fn)=>{
 const data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),4*(y*w+x));
 return {width:w,height:h,data};
};
test('real PSD bitmap mask is decoded into independently positioned editable selection matte',()=>{
 const w=20,h=12;
 const psd=writePsd({width:w,height:h,
   imageData:bitmap(w,h,()=>[40,30,200,255]),
   children:[{
     name:'Masked heart',left:3,top:3,right:11,bottom:9,
     imageData:bitmap(8,6,()=>[230,70,110,255]),
     mask:{top:3,left:3,right:11,bottom:9,defaultColor:0,
       imageData:bitmap(8,6,(x,y)=>[x<4?255:0,0,0,255])}
   },{
     name:'Background',left:0,top:0,right:w,bottom:h,
     imageData:bitmap(w,h,()=>[255,255,255,255])
   }]
 });
 const decoded=importPsdPixels(psd);
 const layer=decoded.layers.find(x=>x.name==='Masked heart');
 assert.ok(layer,'masked layer must be imported');
 assert.equal(layer.maskDecodeFailed,false);
 assert.equal(layer.maskSpecs.length,1);
 assert.equal(layer.maskSpecs[0].x,3);
 assert.equal(layer.maskSpecs[0].y,3);
 assert.equal(layer.maskSpecs[0].w,8);
 assert.equal(layer.maskSpecs[0].h,6);
 assert.equal(layer.maskSpecs[0].pixels[0],255);
 assert.equal(layer.maskSpecs[0].pixels[7],0);
 assert.equal(decoded.composite.data[2],200,'Photoshop-stored composite is preserved');
});
test('clipping PSD layer maps to an unmoved base below in same sibling group',()=>{
 const w=20,h=12;
 const file=writePsd({width:w,height:h,imageData:bitmap(w,h,()=>[255,255,255,255]),
 children:[
   {name:'Clipped color',left:0,top:0,right:12,bottom:10,clipping:true,
     imageData:bitmap(12,10,()=>[230,0,0,255])},
   {name:'Base sticker',left:2,top:2,right:10,bottom:8,
     imageData:bitmap(8,6,()=>[255,255,255,255])},
   {name:'Background',left:0,top:0,right:w,bottom:h,
     imageData:bitmap(w,h,()=>[255,255,255,255])},
 ]});
 const info=importPsdPixels(file);
 const clipped=info.layers.find(l=>l.name==='Clipped color');
 const base=info.layers.find(l=>l.name==='Base sticker');
 assert.equal(clipped.clippingBaseKey,base.sourceKey);
 assert.equal(clipped.clippingUnresolved,false);
 assert.equal(clipped.compatibility.clipping,true);
});

const point=(x,y)=>({linked:true,points:[x,y,x,y,x,y]});
test('real PSD vector mask path survives write/read and becomes a safe pixel matte',()=>{
  const w=24,h=20;
  const vectorMask={fillStartsWithAllPixels:false,paths:[{
    open:false,operation:'combine',fillRule:'even-odd',
    knots:[point(3,2),point(13,2),point(13,12),point(3,12)]
  }]};
  const file=writePsd({width:w,height:h,
    imageData:bitmap(w,h,()=>[245,240,230,255]),
    children:[{name:'Vector flower',left:0,top:0,right:w,bottom:h,vectorMask,
      imageData:bitmap(w,h,()=>[180,100,220,255])}]});
  const parsed=importPsdPixels(file,{createCanvas});
  const layer=parsed.layers[0];
  assert.equal(layer.unsupportedVectorMask,false);
  assert.equal(layer.maskDecodeFailed,false);
  assert.ok(layer.maskSpecs.length>0);
  const spec=layer.maskSpecs.at(-1);
  assert.equal(spec.pixels[7*w+8],255);
  assert.equal(spec.pixels[17*w+8],0);
});
test('PSD parent group bitmap mask is decoded once and shared by all child layers',()=>{
  const w=24,h=20;
  const file=writePsd({width:w,height:h,
    imageData:bitmap(w,h,()=>[245,240,230,255]),
    children:[{
      name:'Masked group',children:[
        {name:'Heart',left:0,top:0,right:w,bottom:h,
         imageData:bitmap(w,h,()=>[230,120,120,255])},
        {name:'Star',left:0,top:0,right:w,bottom:h,
         imageData:bitmap(w,h,()=>[120,120,230,255])}
      ],
      mask:{left:0,top:0,right:w,bottom:h,defaultColor:0,
        imageData:bitmap(w,h,(x)=>[x<12?255:0,0,0,255])}
    }]});
  const parsed=importPsdPixels(file,{createCanvas});
  const group=parsed.groupMasks.find(g=>g.name==='Masked group');
  assert.ok(group,'Group mask metadata returned');
  assert.equal(group.failed,false,'Group mask should decode');
  assert.equal(group.maskSpecs.length,1,'Mask decoded only once for the group');
  assert.equal(group.maskSpecs[0].pixels[7*w+2],255);
  assert.equal(group.maskSpecs[0].pixels[7*w+20],0);
  for(const child of parsed.layers){
    assert.equal(child.unsupportedGroupMask,false);
    assert.deepEqual(child.ancestorGroupKeys,[group.key]);
  }
});
