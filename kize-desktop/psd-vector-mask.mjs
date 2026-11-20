// Rasterize the supported, ordinary CLOSED Photoshop Bezier vector masks.
// This is a pixel matte for safe selection/preview, NOT an editable vector
// path and not a Photoshop-accurate path boolean/feather rendering engine.
// Unsupported operations fail CLOSED: do not recolor invisible pixels.
import {MASK_SCHEMA} from './psd-mask-core.mjs';

const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
function pathSupported(path){
  return path&&path.open===false&&Array.isArray(path.knots)&&
    path.knots.length>=2&&path.knots.length<=3000&&
    (path.operation==null||path.operation==='combine')&&
    (path.fillRule==='even-odd'||path.fillRule==='non-zero')&&
    path.knots.every(k=>Array.isArray(k.points)&&k.points.length===6&&k.points.every(finite));
}
export function vectorMaskSupported(mask,width,height){
  return Boolean(mask&&!mask.disable&&!mask.disabled&&mask.invert!==true&&
    mask.fillStartsWithAllPixels!==true&&
    Number.isInteger(width)&&Number.isInteger(height)&&
    width>0&&height>0&&width*height<=8_000_000&&
    Array.isArray(mask.paths)&&mask.paths.length>0&&mask.paths.length<=40&&
    mask.paths.every(pathSupported));
}
export function rasterizeVectorMask(mask,width,height,createCanvas){
  if(!vectorMaskSupported(mask,width,height))
    throw Error('벡터 마스크가 열린 경로·역전·복잡한 패스 연산 또는 대용량 형태여서 안전하게 편집할 수 없습니다.');
  if(typeof createCanvas!=='function')throw Error('벡터 마스크를 렌더링할 Canvas 2D 기능이 없습니다.');
  const canvas=createCanvas(width,height);
  const ctx=canvas?.getContext?.('2d',{willReadFrequently:true});
  if(!ctx)throw Error('벡터 마스크 Canvas 2D를 사용할 수 없습니다.');
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#ffffff';
  // BezierKnot.points = [preceding handle x,y, anchor x,y, following
  // handle x,y]. ag-psd returns coordinates in document PIXELS.
  for(const path of mask.paths){
    const knots=path.knots,first=knots[0];
    ctx.beginPath();ctx.moveTo(first.points[2],first.points[3]);
    for(let j=1;j<=knots.length;j++){
      const previous=knots[j-1],next=knots[j%knots.length];
      ctx.bezierCurveTo(previous.points[4],previous.points[5],
        next.points[0],next.points[1],next.points[2],next.points[3]);
    }
    ctx.closePath();
    ctx.fill(path.fillRule==='even-odd'?'evenodd':'nonzero');
  }
  const rgba=ctx.getImageData(0,0,width,height).data;
  const pixels=new Uint8Array(width*height);
  for(let i=0;i<pixels.length;i++)pixels[i]=rgba[i*4+3];
  return {
    schema:MASK_SCHEMA,kind:'vector',x:0,y:0,w:width,h:height,
    defaultColor:0,density:1,feather:0,pixels,
  };
}
