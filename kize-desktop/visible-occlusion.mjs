// Conservative pixel visibility guard for edits made over Photoshop's saved
// composite. A lower layer must never repaint an upper visible layer.
// This is an alpha occlusion safety mask, NOT a Photoshop blending renderer.
import {layerConstraintAlpha} from './psd-mask-core.mjs';

export function layerPixelAtDocument(layer,docX,docY){
  if(!layer||!layer.canvas||!(layer.w>0)||!(layer.h>0))return null;
  const cx=layer.x+layer.w/2,cy=layer.y+layer.h/2;
  const theta=(Number(layer.rotation)||0)*Math.PI/180;
  const dx=docX-cx,dy=docY-cy;
  let lx=dx*Math.cos(theta)+dy*Math.sin(theta);
  let ly=-dx*Math.sin(theta)+dy*Math.cos(theta);
  if(layer.flipH)lx=-lx;
  if(layer.flipV)ly=-ly;
  const x=Math.floor((lx/layer.w+.5)*layer.canvas.width);
  const y=Math.floor((ly/layer.h+.5)*layer.canvas.height);
  return x<0||y<0||x>=layer.canvas.width||y>=layer.canvas.height?null:{x,y};
}
export function sourcePixelToDocument(layer,x,y,width,height){
  const theta=(Number(layer.rotation)||0)*Math.PI/180;
  const dx=((x+.5)/width-.5)*layer.w*(layer.flipH?-1:1);
  const dy=((y+.5)/height-.5)*layer.h*(layer.flipV?-1:1);
  return {x:layer.x+layer.w/2+dx*Math.cos(theta)-dy*Math.sin(theta),
    y:layer.y+layer.h/2+dx*Math.sin(theta)+dy*Math.cos(theta)};
}
export function pointIsOccluded(layer,docX,docY,allLayers,getAlpha){
  const position=allLayers.indexOf(layer);
  if(position<0)return true; // Unknown layer must not patch the saved composite.
  const byId=id=>allLayers.find(l=>l.id===id);
  for(let i=position+1;i<allLayers.length;i++){
    const upper=allLayers[i];
    if(!upper.visible||!(upper.opacity>0)||!upper.canvas)continue;
    const pixel=layerPixelAtDocument(upper,docX,docY);
    if(!pixel)continue;
    const alpha=getAlpha(upper,pixel.x,pixel.y);
    if(alpha<=0)continue;
    // For unsupported masks, conservatively assume visible pixels may cover
    // this location. No accidental repaint of another Photoshop asset.
    try{
      if(layerConstraintAlpha(upper,docX,docY,byId)>0)return true;
    }catch{return true;}
  }
  return false;
}
export function protectOccludedPixels(mask,w,h,layer,allLayers,getAlpha){
  if(mask.length!==w*h)throw Error('가려짐 검사 선택 마스크의 크기가 잘못되었습니다.');
  const result=new Uint8Array(mask);
  if(allLayers.indexOf(layer)===allLayers.length-1)return result;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;
    if(!result[i])continue;
    const pt=sourcePixelToDocument(layer,x,y,w,h);
    if(pointIsOccluded(layer,pt.x,pt.y,allLayers,getAlpha))result[i]=0;
  }
  return result;
}
