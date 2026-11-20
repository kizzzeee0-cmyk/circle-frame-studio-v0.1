// Conservative raster-only reconstruction for preview.
// Does not generate Photoshop layer styles, vector paths, ICC color management
// or complex group blend modes. Unhandled features stay explicitly marked.
import {layerConstraintAlpha} from './psd-mask-core.mjs';
export function maskedLayerRgba(rgba,width,height,layer,byId){
  if(rgba.length!==width*height*4)throw Error('PSD 미리보기 픽셀 크기가 일치하지 않습니다.');
  const result=new Uint8ClampedArray(rgba);
  if(!layer.maskSpecs?.length&&!layer.groupMaskSpecs?.length&&layer.clipBaseId==null&&!layer.maskDecodeFailed)
    return result;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    if(!result[i+3])continue;
    const px=layer.x+(x+.5)*layer.w/width;
    const py=layer.y+(y+.5)*layer.h/height;
    const a=layerConstraintAlpha(layer,px,py,byId);
    result[i+3]=Math.round(result[i+3]*a/255);
  }
  return result;
}
