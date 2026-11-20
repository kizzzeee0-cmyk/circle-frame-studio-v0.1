// Color editing core, independent of DOM and PSD parsing. This module edits
// only the selected layer and keeps the original canvas size / alpha intact.
import {clamp,hexToRGB} from './engine.js';
const dist = (data,p,ref)=>Math.hypot(data[p]-ref[0],data[p+1]-ref[1],data[p+2]-ref[2]);
const at=(a,i)=>a[i*4+3];
export function findColorSeed(data,w,h,x,y,radius=5) {
  x=Math.floor(x);y=Math.floor(y);
  if(x<0||y<0||x>=w||y>=h)return null;
  if(at(data,y*w+x)>=8)return {x,y};
  for(let r=1;r<=radius;r++){
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;
      const xx=x+dx,yy=y+dy;
      if(xx>=0&&yy>=0&&xx<w&&yy<h&&at(data,yy*w+xx)>=8)return {x:xx,y:yy};
    }
  }
  return null;
}
export function colorSelection(data,w,h,x,y,opts={}) {
  if(w*h*4!==data.length)throw Error('레이어 픽셀 길이가 일치하지 않습니다.');
  const seed=findColorSeed(data,w,h,x,y);
  const mask=new Uint8Array(w*h);
  if(!seed)return {mask,count:0,seed:null,bounds:null,sample:null};
  const tolerance=clamp(Number(opts.tolerance??18),0,120);
  const linked=opts.connected!==false;
  const src=(seed.y*w+seed.x)*4;
  const sample=[data[src],data[src+1],data[src+2]];
  // Step 1: opaque, near-color seeds. Connectivity is restricted to this
  // color family, so neighboring unrelated motifs never leak across.
  const matches=i=>at(data,i)>=8&&dist(data,i*4,sample)<=tolerance;
  if(linked){
    const queue=new Uint32Array(w*h);
    let head=0,tail=0;const start=seed.y*w+seed.x;
    queue[tail++]=start;mask[start]=255;
    while(head<tail){
      const i=queue[head++],xx=i%w,yy=(i/w)|0;
      if(xx>0){const n=i-1;if(!mask[n]&&matches(n)){mask[n]=255;queue[tail++]=n;}}
      if(xx+1<w){const n=i+1;if(!mask[n]&&matches(n)){mask[n]=255;queue[tail++]=n;}}
      if(yy>0){const n=i-w;if(!mask[n]&&matches(n)){mask[n]=255;queue[tail++]=n;}}
      if(yy+1<h){const n=i+w;if(!mask[n]&&matches(n)){mask[n]=255;queue[tail++]=n;}}
    }
  } else for(let i=0;i<w*h;i++)if(matches(i))mask[i]=255;
  // Step 2: include one neighboring antialias pixel along each boundary.
  // Limit to 1px and nearest color family, preventing the whole backdrop from
  // becoming selected. Original alpha remains unchanged during recoloring.
  const fringe=Math.min(26,Math.max(8,tolerance*.55+8));
  const borders=[];
  for(let i=0;i<w*h;i++)if(mask[i]===255){
    const xx=i%w,yy=(i/w)|0;
    if(xx>0&&mask[i-1]===0)borders.push(i-1);
    if(xx+1<w&&mask[i+1]===0)borders.push(i+1);
    if(yy>0&&mask[i-w]===0)borders.push(i-w);
    if(yy+1<h&&mask[i+w]===0)borders.push(i+w);
  }
  for(const i of borders){
    if(mask[i]||at(data,i)===0)continue;
    const d=dist(data,i*4,sample),v=1-(d-tolerance)/fringe;
    if(v>0)mask[i]=Math.round(clamp(v,0,1)*255);
  }
  let minX=w,minY=h,maxX=-1,maxY=-1,count=0;
  for(let i=0;i<mask.length;i++)if(mask[i]){count++;const xx=i%w,yy=(i/w)|0;
    if(xx<minX)minX=xx;if(xx>maxX)maxX=xx;if(yy<minY)minY=yy;if(yy>maxY)maxY=yy;
  }
  return {mask,count,seed,bounds:count?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:null,sample};
}
export function normalizedStops(input){
  if(!Array.isArray(input)||input.length<2||input.length>8)throw Error('그라데이션 색상점은 2~8개여야 합니다.');
  return input.map(s=>{
    const color=hexToRGB(s.color||s.hex||'');
    if(!color)throw Error('잘못된 그라데이션 색상 코드');
    return {position:clamp(Number(s.position)||0,0,100),color};
  }).sort((a,b)=>a.position-b.position);
}
export function gradientAt(t,stops) {
  t=clamp(t,0,1)*100;
  if(t<=stops[0].position)return stops[0].color;
  if(t>=stops.at(-1).position)return stops.at(-1).color;
  for(let i=1;i<stops.length;i++){
    const a=stops[i-1],b=stops[i];
    if(t<=b.position){
      const weight=b.position===a.position?1:(t-a.position)/(b.position-a.position);
      return a.color.map((v,k)=>v*(1-weight)+b.color[k]*weight);
    }
  }
  return stops.at(-1).color;
}
export function paintSelection(src,w,h,selection,opt={}) {
  if(!selection?.mask||selection.mask.length!==w*h)throw Error('먼저 색상 영역을 선택해 주세요.');
  const out=new Uint8ClampedArray(src);
  const gradient=opt.mode==='gradient';
  const solid=hexToRGB(opt.color||'#9389DE');
  if(!solid)throw Error('잘못된 색상 코드');
  const stops=gradient?normalizedStops(opt.stops):null;
  const angle=((Number(opt.angle)||0)%360+360)%360;
  // 0° = top to bottom; 90° = left to right, independent of canvas ratio.
  const dx=Math.sin(angle*Math.PI/180),dy=Math.cos(angle*Math.PI/180);
  const b=selection.bounds||{x:0,y:0,w,h};
  const corners=[[0,0],[b.w,0],[0,b.h],[b.w,b.h]].map(v=>v[0]*dx+v[1]*dy);
  const min=Math.min(...corners),max=Math.max(...corners),len=Math.max(1e-9,max-min);
  const preserve=opt.preserveShading!==false;
  const sample=selection.sample||[128,128,128];
  const refLum=.2126*sample[0]+.7152*sample[1]+.0722*sample[2];
  const tintAsset=opt.tintAsset===true;
  const protectWhite=opt.protectWhite!==false;
  const strengthSetting=clamp(Number(opt.tintStrength??100),0,100)/100;
  let count=0;
  for(let i=0;i<w*h;i++){
    const strength=selection.mask[i]/255;if(strength<=0||out[i*4+3]===0)continue;
    const p=i*4,xx=i%w-b.x,yy=((i/w)|0)-b.y;
    const gradientPosition=((xx+.5)*dx+(yy+.5)*dy-min)/len;
    const target=gradient?gradientAt(gradientPosition,stops):solid;
    const luminosity=.2126*src[p]+.7152*src[p+1]+.0722*src[p+2];
    const sourceMax=Math.max(src[p],src[p+1],src[p+2]);
    const sourceMin=Math.min(src[p],src[p+1],src[p+2]);
    const saturation=sourceMax?((sourceMax-sourceMin)/sourceMax):0;
    if(tintAsset&&protectWhite&&luminosity>=236&&saturation<.125)continue;
    if(tintAsset&&protectWhite&&luminosity<=37&&saturation<.095)continue;
    // In asset tone mode, treat colored fills, midtones and layer-style
    // shadows as one hue family. Keep their relative luminance (not their old
    // RGB hue), while protecting neutral white highlights / black linework.
    const shade=preserve?clamp((luminosity-refLum)*(tintAsset ? 0.86 : 0.38),-155,155):0;
    const adjustedStrength=strength*(tintAsset?strengthSetting:1);
    const neutralWhite=tintAsset&&protectWhite&&saturation<.16&&luminosity>215
      ?clamp((236-luminosity)/21,0,1):1;
    for(let ch=0;ch<3;ch++){
      const next=clamp(target[ch]+shade,0,255);
      const mix=adjustedStrength*neutralWhite;
      out[p+ch]=Math.round(src[p+ch]*(1-mix)+next*mix);
    }
    count++;
  }
  return {data:out,count};
}
