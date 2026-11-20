// PSD mask-aware SELECTION constraints (not a Photoshop effect renderer).
// Original layer masks stay intact. Editable pixels are limited by decoded
// bitmap/user mask(s) and a basic clipping-base alpha matte.
// Unsupported active masks fail closed, never silently color hidden regions.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const MASK_SCHEMA=1;
export function normalizeMaskData(input,mask,layer){
  if(!mask||mask.disabled)return null;
  if(!input?.data||!input.width||!input.height||input.width*input.height>40_000_000)
    throw Error('PSD 마스크의 실제 픽셀을 디코딩할 수 없습니다.');
  const n=input.width*input.height;
  if(input.data.length!==n*4)throw Error('PSD 마스크 이미지의 픽셀 길이가 잘못되었습니다.');
  const pixels=new Uint8Array(n);
  const source=input.data;
  for(let i=0;i<n;i++){
    const v=source[i*4];
    pixels[i]=source instanceof Uint16Array?Math.round(v*255/65535):
      source instanceof Float32Array?Math.round(clamp(v,0,1)*255):
      clamp(Math.round(v),0,255);
  }
  const left=(Number(mask.left)||0)+(mask.positionRelativeToLayer?(Number(layer.left)||0):0);
  const top=(Number(mask.top)||0)+(mask.positionRelativeToLayer?(Number(layer.top)||0):0);
  const d=mask.userMaskDensity??mask.vectorMaskDensity??1;
  const density=clamp(d>1?d/100:d,0,1);
  return {
    schema:MASK_SCHEMA,x:left,y:top,w:input.width,h:input.height,
    defaultColor:mask.defaultColor===255?255:0,
    density,feather:Number(mask.userMaskFeather??mask.vectorMaskFeather??0)||0,
    pixels
  };
}
export function maskOpacity(spec,docX,docY){
  if(!spec)return 255;
  const x=Math.floor(docX-spec.x),y=Math.floor(docY-spec.y);
  const raw=x<0||y<0||x>=spec.w||y>=spec.h
    ?spec.defaultColor:spec.pixels[y*spec.w+x];
  // Photoshop density makes black mask pixels less concealing; white stays white.
  return Math.round(255-(255-raw)*clamp(spec.density??1,0,1));
}
function pixelAlpha(layer,docX,docY){
  if(!layer?.canvas||layer.w<=0||layer.h<=0)return 0;
  const sx=Math.floor((docX-layer.x)*layer.canvas.width/layer.w);
  const sy=Math.floor((docY-layer.y)*layer.canvas.height/layer.h);
  if(sx<0||sy<0||sx>=layer.canvas.width||sy>=layer.canvas.height)return 0;
  if(layer.alphaPixels){
    const a=layer.alphaPixels[sy*layer.canvas.width+sx];
    return a??0;
  }
  // Browser editor can provide its cached bitmap alpha. No Canvas operations
  // are performed within this pure module.
  return 0;
}
export function layerConstraintAlpha(layer,docX,docY,byId){
  if(layer.maskDecodeFailed||layer.unsupportedVectorMask||layer.unsupportedGroupMask||layer.clippingUnresolved)
    throw Error('PSD의 마스크가 지원되지 않아 정확한 영역을 선택할 수 없습니다. 원본 외관을 보호하기 위해 편집을 차단했습니다.');
  let m=255;
  for(const spec of layer.maskSpecs||[]){
    if(!spec)continue;
    m=Math.round(m*maskOpacity(spec,docX,docY)/255);
    if(m===0)return 0;
  }
  for(const spec of layer.groupMaskSpecs||[]){
    if(!spec)continue;
    m=Math.round(m*maskOpacity(spec,docX,docY)/255);
    if(m===0)return 0;
  }
  if(layer.clipBaseId!==undefined&&layer.clipBaseId!==null){
    const base=byId(layer.clipBaseId);
    if(!base||!base.visible||base.maskDecodeFailed||base.unsupportedVectorMask||base.unsupportedGroupMask)
      throw Error('PSD 클리핑 기준 레이어를 확인할 수 없어 원본을 보호하기 위해 편집을 차단했습니다.');
    let baseAlpha=pixelAlpha(base,docX,docY);
    for(const spec of [...(base.maskSpecs||[]),...(base.groupMaskSpecs||[])])
      baseAlpha=Math.round(baseAlpha*maskOpacity(spec,docX,docY)/255);
    m=Math.round(m*baseAlpha/255);
  }else if(layer.clipBaseKey&&!layer.clipBaseId){
    throw Error('PSD 클리핑 기준 레이어가 누락되어 정확한 영역을 선택할 수 없습니다.');
  }
  return clamp(m,0,255);
}
export function constrainSelection(mask,w,h,layer,byId){
  if(mask.length!==w*h)throw Error('선택 마스크의 크기가 일치하지 않습니다.');
  const result=new Uint8Array(mask.length);
  let count=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;
    if(!mask[i])continue;
    const px=layer.x+(x+.5)*layer.w/w,py=layer.y+(y+.5)*layer.h/h;
    const a=layerConstraintAlpha(layer,px,py,byId);
    const next=Math.round(mask[i]*a/255);
    result[i]=next;
    if(next)count++;
  }
  return {mask:result,count};
}
