// Photoshop appearance-preserving raster recolor.
// The source Photoshop flattened composite is NEVER re-composited from individual
// layers. A selected layer's mask is mapped onto that saved composite and only
// pixels under the mask are changed. All other RGBA bytes remain untouched.
// This is a narrow color-editing alternative, not a Photoshop mask/effects engine.
import {paintSelection} from './color-tools.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const APPEARANCE_VERSION=1;
function transformedPoint(layer,sw,sh,px,py){
  const cx=Number(layer.x)+Number(layer.w)/2,cy=Number(layer.y)+Number(layer.h)/2;
  const angle=(Number(layer.rotation)||0)*Math.PI/180;
  const lx=(px/sw-.5)*Number(layer.w)*(layer.flipH?-1:1);
  const ly=(py/sh-.5)*Number(layer.h)*(layer.flipV?-1:1);
  return {x:cx+lx*Math.cos(angle)-ly*Math.sin(angle),
    y:cy+lx*Math.sin(angle)+ly*Math.cos(angle)};
}
export function transformedSelectionRect(layer,selection,documentWidth,documentHeight){
  if(!selection?.bounds||selection.w<1||selection.h<1||layer.w<=0||layer.h<=0)return null;
  const {x,y,w,h}=selection.bounds;
  const corners=[
    transformedPoint(layer,selection.w,selection.h,x,y),
    transformedPoint(layer,selection.w,selection.h,x+w,y),
    transformedPoint(layer,selection.w,selection.h,x,y+h),
    transformedPoint(layer,selection.w,selection.h,x+w,y+h)
  ];
  const left=clamp(Math.floor(Math.min(...corners.map(p=>p.x))-1),0,documentWidth);
  const top=clamp(Math.floor(Math.min(...corners.map(p=>p.y))-1),0,documentHeight);
  const right=clamp(Math.ceil(Math.max(...corners.map(p=>p.x))+1),0,documentWidth);
  const bottom=clamp(Math.ceil(Math.max(...corners.map(p=>p.y))+1),0,documentHeight);
  return right<=left||bottom<=top?null:{x:left,y:top,w:right-left,h:bottom-top};
}
export function maskToDocumentCrop(layer,selection,rect){
  const output=new Uint8Array(rect.w*rect.h);
  const theta=(Number(layer.rotation)||0)*Math.PI/180;
  const co=Math.cos(theta),si=Math.sin(theta);
  const cx=Number(layer.x)+Number(layer.w)/2,cy=Number(layer.y)+Number(layer.h)/2;
  const sx=selection.w/Number(layer.w),sy=selection.h/Number(layer.h);
  let count=0,x0=rect.w,y0=rect.h,x1=-1,y1=-1;
  for(let y=0;y<rect.h;y++){
    const dy=rect.y+y+.5-cy;
    for(let x=0;x<rect.w;x++){
      const dx=rect.x+x+.5-cx;
      let lx=dx*co+dy*si,ly=-dx*si+dy*co;
      if(layer.flipH)lx=-lx;if(layer.flipV)ly=-ly;
      const ix=Math.floor((lx+Number(layer.w)/2)*sx);
      const iy=Math.floor((ly+Number(layer.h)/2)*sy);
      if(ix<0||iy<0||ix>=selection.w||iy>=selection.h)continue;
      const alpha=selection.mask[iy*selection.w+ix];
      if(!alpha)continue;
      const index=y*rect.w+x;
      output[index]=alpha;count++;
      if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
    }
  }
  return {mask:output,count,bounds:count?{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1}:null};
}
export function overlayPriorPatches(source,rect,patches=[]){
  const result=new Uint8ClampedArray(source);
  for(const patch of patches){
    const aX=Math.max(rect.x,patch.x),aY=Math.max(rect.y,patch.y);
    const bX=Math.min(rect.x+rect.w,patch.x+patch.w);
    const bY=Math.min(rect.y+rect.h,patch.y+patch.h);
    if(aX>=bX||aY>=bY)continue;
    const pdata=patch.data;
    if(!pdata||pdata.length!==patch.w*patch.h*4)throw Error('저장된 PSD 편집 패치가 손상되었습니다.');
    for(let y=aY;y<bY;y++){
      const from=((y-patch.y)*patch.w+(aX-patch.x))*4;
      const to=((y-rect.y)*rect.w+(aX-rect.x))*4;
      result.set(pdata.subarray(from,from+(bX-aX)*4),to);
    }
  }
  return result;
}
export function makeAppearancePatch(layer,selection,docW,docH,referenceCrop,priorPatches,opts){
  const rect=transformedSelectionRect(layer,selection,docW,docH);
  if(!rect)return null;
  if(referenceCrop.length!==rect.w*rect.h*4)throw Error('원본 PSD 픽셀 영역의 크기가 잘못되었습니다.');
  const base=overlayPriorPatches(referenceCrop,rect,priorPatches);
  const mapped=maskToDocumentCrop(layer,selection,rect);
  if(!mapped.count)return null;
  // Compute reference luminance from actual visible Photoshop pixels, not from
  // a raw PSD layer (which might lack styles, clipping or adjustment layers).
  // Never combine fractional x/y before flattening. Doing so can carry the
  // half-pixel into the next row and sample the *background* instead of the
  // selected object, making a recolored asset unexpectedly very dark.
  const sampleX=Math.floor(mapped.bounds.x+(mapped.bounds.w-1)/2);
  const sampleY=Math.floor(mapped.bounds.y+(mapped.bounds.h-1)/2);
  let sx=sampleY*rect.w+sampleX;
  if(!mapped.mask[sx]||base[sx*4+3]===0){
    const fallback=mapped.mask.findIndex((alpha,i)=>alpha>0&&base[i*4+3]>0);
    if(fallback>=0)sx=fallback;
  }
  const sample=[base[sx*4],base[sx*4+1],base[sx*4+2]];
  const painted=paintSelection(base,rect.w,rect.h,{
    mask:mapped.mask,bounds:mapped.bounds,sample
  },opts);
  // Restoring reference alpha is essential: no false halo around transparent
  // PSD frames or double alpha compositing of semitransparent Photoshop layers.
  const data=new Uint8ClampedArray(painted.data);
  for(let i=0;i<rect.w*rect.h;i++)data[i*4+3]=base[i*4+3];
  return {...rect,data,layerId:layer.id,count:painted.count};
}
