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
