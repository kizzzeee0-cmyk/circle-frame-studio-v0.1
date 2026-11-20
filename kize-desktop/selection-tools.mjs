// Raster selection operations. Explicit boundaries: all operations are limited
// to the active bitmap layer and never invent a semantic AI object mask.
// Color and connected-alpha selections can be combined via Shift-click.
import {clamp} from './engine.js';
import {colorSelection} from './color-tools.mjs';
const OPAQUE=8;
const lum=(r,g,b)=>(.2126*r+.7152*g+.0722*b)/255;
const sat=(r,g,b)=>{const hi=Math.max(r,g,b),lo=Math.min(r,g,b);return hi?((hi-lo)/hi):0;};
export function maskBounds(mask,w,h) {
  let x0=w,y0=h,x1=-1,y1=-1,count=0;
  for(let i=0;i<mask.length;i++){
    if(mask[i]===0)continue;
    const x=i%w,y=(i/w)|0;count++;
    if(x<x0)x0=x;if(y<y0)y0=y;if(x>x1)x1=x;if(y>y1)y1=y;
  }
  return {count,bounds:count?{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1}:null};
}
export function selectAssetRegion(data,w,h,x,y,{tolerance=18}={}){
  // PSD isolated transparent layers are accurately delineated by alpha.
  // With a flattened opaque PNG, use a conservative hue/saturation mask
  // instead of flooding the entire canvas. Complex assets may need Shift-click.
  const sx=Math.floor(x),sy=Math.floor(y),start=sy*w+sx;
  if(sx<0||sy<0||sx>=w||sy>=h||data[start*4+3]<OPAQUE)
    return {mask:new Uint8Array(w*h),count:0,bounds:null,sample:null,seed:null,mode:'asset'};
  let alphaGaps=0;
  for(let i=0;i<w*h;i+=Math.max(1,Math.floor((w*h)/4500)))if(data[i*4+3]<OPAQUE)alphaGaps++;
  // A few transparent pixels along PNG edges should not qualify as isolated PSD.
  const separated=alphaGaps>30;
  const p=start*4,sample=[data[p],data[p+1],data[p+2]];
  const seedLum=lum(...sample),seedSat=sat(...sample);
  const allowed=i=>{
    const p=i*4;if(data[p+3]<OPAQUE)return false;
    if(separated)return true;
    const r=data[p],g=data[p+1],b=data[p+2];
    const L=lum(r,g,b),S=sat(r,g,b);
    // Do not absorb a white or neutral background into a colored object.
    if(L>.90&&S<.16)return false;
    const dot=r*sample[0]+g*sample[1]+b*sample[2];
    const norm=Math.hypot(r,g,b)*Math.hypot(...sample);
    const similarity=norm===0?0:dot/norm;
    const toleranceNormalized=clamp(Number(tolerance)||18,0,100)/100;
    return similarity>.91-toleranceNormalized*.1 &&
      Math.abs(L-seedLum)<.46+toleranceNormalized*.25 &&
      (seedSat>.11?S>.08:S<.38);
  };
  // Opaque PNG: conservative connected foreground. Photoshop layer with alpha:
  // connected nontransparent component incl white in mask, but tint preserves it.
  const q=new Uint32Array(w*h),mask=new Uint8Array(w*h);
  let head=0,tail=0;q[tail++]=start;mask[start]=255;
  while(head<tail){
    const i=q[head++],xx=i%w,yy=(i/w)|0;
    const test=n=>{if(!mask[n]&&allowed(n)){mask[n]=255;q[tail++]=n;}};
    if(xx>0)test(i-1);if(xx+1<w)test(i+1);
    if(yy>0)test(i-w);if(yy+1<h)test(i+w);
  }
  const stats=maskBounds(mask,w,h);
  return {...stats,mask,sample,seed:{x:sx,y:sy},mode:'asset',estimated:!separated};
}
function distances(binary,w,h,toSelected){
  const inf=1e9,diag=Math.SQRT2;
  const d=new Float32Array(w*h);
  for(let i=0;i<d.length;i++)d[i]=(binary[i]===toSelected)?0:inf;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;
    if(x)d[i]=Math.min(d[i],d[i-1]+1);
    if(y){d[i]=Math.min(d[i],d[i-w]+1);
      if(x)d[i]=Math.min(d[i],d[i-w-1]+diag);
      if(x+1<w)d[i]=Math.min(d[i],d[i-w+1]+diag);
    }
  }
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){
    const i=y*w+x;
    if(x+1<w)d[i]=Math.min(d[i],d[i+1]+1);
    if(y+1<h){d[i]=Math.min(d[i],d[i+w]+1);
      if(x)d[i]=Math.min(d[i],d[i+w-1]+diag);
      if(x+1<w)d[i]=Math.min(d[i],d[i+w+1]+diag);
    }
  }
  return d;
}
export function growShrinkMask(mask,w,h,amount){
  const radius=clamp(Math.trunc(Number(amount)||0),-12,12);
  if(!radius)return new Uint8Array(mask);
  if(mask.length!==w*h)throw Error('선택 마스크 크기 불일치');
  const stats=maskBounds(mask,w,h);
  if(!stats.bounds)return new Uint8Array(mask);
  const margin=Math.abs(radius)+3,b=stats.bounds;
  const left=Math.max(0,b.x-margin),top=Math.max(0,b.y-margin);
  const right=Math.min(w,b.x+b.w+margin),bottom=Math.min(h,b.y+b.h+margin);
  const cw=right-left,ch=bottom-top;
  // One unselected pixel of virtual padding outside canvas edges matters:
  // shrinking an object touching the canvas border must erode that edge too.
  const pw=cw+2,ph=ch+2;
  const binary=new Uint8Array(pw*ph);
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)
    binary[(y+1)*pw+x+1]=mask[(top+y)*w+left+x]>=128?1:0;
  const target=radius>0?1:0;
  const dist=distances(binary,pw,ph,target);
  const out=new Uint8Array(mask.length);
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
    const i=(y+1)*pw+x+1,idx=(top+y)*w+left+x;
    if(radius>0){
      if(binary[i])out[idx]=mask[idx]||255;
      else out[idx]=Math.round(255*clamp(radius+.65-dist[i],0,1));
    }else{
      if(!binary[i])continue;
      out[idx]=Math.round(mask[idx]*clamp(dist[i]-Math.abs(radius),0,1));
    }
  }
  return out;
}
export function unionRegionParts(parts,w,h){
  const output=new Uint8Array(w*h);
  for(const part of parts){
    if(part.mask.length!==w*h)throw Error('선택 영역 크기가 다릅니다.');
    for(let i=0;i<output.length;i++)if(part.mask[i]>output[i])output[i]=part.mask[i];
  }
  const stats=maskBounds(output,w,h);
  return {mask:output,...stats};
}
