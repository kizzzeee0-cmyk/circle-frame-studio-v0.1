// Palette-combination mapping for a single PNG raster layer.
// Each SOURCE color family receives a DIFFERENT destination swatch from the
// selected palette. This is deliberately not the legacy one-color-per-PNG export.
// All transparent pixels, source alpha and document dimensions stay unchanged.
import {hexToRGB,rgbToHex,clamp} from './engine.js';

const MAX_SAMPLE=18000;
const distance=(a,b)=>{
  const dr=a[0]-b[0],dg=a[1]-b[1],db=a[2]-b[2];
  // Approximate visual distance, favoring green discrimination.
  return .55*dr*dr+dg*dg+.42*db*db;
};
function protectedNeutral(r,g,b){
  const hi=Math.max(r,g,b),lo=Math.min(r,g,b);
  return hi-lo<15&&(hi>=247||hi<=24);
}
export function paletteEligible(alpha,r,g,b,{preserveWhiteBlack=true}={}){
  if(alpha<8)return false;
  return !preserveWhiteBlack||!protectedNeutral(r,g,b);
}
function paletteRgb(hex){
  const rgb=hexToRGB(hex);
  if(!rgb)throw Error('팔레트 색상은 #RRGGBB 형식이어야 합니다: '+hex);
  return rgb;
}
export function discoverSourceColors(rgba,w,h,count,{preserveWhiteBlack=true,mask=null}={}){
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||
      rgba.length!==w*h*4)throw Error('PNG 픽셀 크기 또는 픽셀 데이터가 잘못되었습니다.');
  const desired=clamp(Math.trunc(count),1,6);
  const pixels=w*h;
  if(mask&&mask.length!==pixels)throw Error('색상 인식 대상 선택 영역 크기가 잘못되었습니다.');
  const stride=Math.max(1,Math.floor(pixels/MAX_SAMPLE));
  const bins=new Map();
  for(let i=0;i<pixels;i+=stride){
    if(mask&&!mask[i])continue;
    const p=i*4,r=rgba[p],g=rgba[p+1],b=rgba[p+2],a=rgba[p+3];
    if(!paletteEligible(a,r,g,b,{preserveWhiteBlack}))continue;
    const key=((r>>4)<<8)|((g>>4)<<4)|(b>>4);
    let cell=bins.get(key);
    if(!cell){cell={sum:[0,0,0],weight:0};bins.set(key,cell);}
    const weight=a/255;
    cell.weight+=weight;
    cell.sum[0]+=r*weight;cell.sum[1]+=g*weight;cell.sum[2]+=b*weight;
  }
  const entries=[...bins.values()].filter(x=>x.weight>0)
    .map(x=>({rgb:x.sum.map(v=>v/x.weight),weight:x.weight}))
    .sort((a,b)=>b.weight-a.weight);
  if(!entries.length)return [];
  let centers=[entries[0].rgb.slice()];
  while(centers.length<desired){
    let best=null,score=0;
    for(const cell of entries){
      const nearest=Math.min(...centers.map(c=>distance(cell.rgb,c)));
      // Don't invent extra 'colors' from antialias steps or weak noise.
      if(nearest<22*22)continue;
      const value=cell.weight*Math.sqrt(nearest);
      if(value>score){score=value;best=cell;}
    }
    if(!best)break;
    centers.push(best.rgb.slice());
  }
  for(let iter=0;iter<5;iter++){
    const acc=centers.map(()=>({sum:[0,0,0],weight:0}));
    for(const cell of entries){
      let k=0,d=Infinity;
      for(let j=0;j<centers.length;j++){
        const nd=distance(cell.rgb,centers[j]);
        if(nd<d){d=nd;k=j;}
      }
      const a=acc[k];a.weight+=cell.weight;
      for(let q=0;q<3;q++)a.sum[q]+=cell.rgb[q]*cell.weight;
    }
    centers=centers.map((c,i)=>acc[i].weight
      ?acc[i].sum.map(v=>v/acc[i].weight):c);
  }
  // Biggest source area => first chosen target swatch, in stable order.
  const totals=centers.map(()=>0);
  for(const cell of entries){
    let k=0,d=Infinity;
    for(let j=0;j<centers.length;j++){
      const nd=distance(cell.rgb,centers[j]);if(nd<d){d=nd;k=j;}
    }
    totals[k]+=cell.weight;
  }
  return centers.map((color,i)=>({rgb:color,weight:totals[i]}))
    .sort((a,b)=>b.weight-a.weight)
    .map(item=>item.rgb.map(v=>Math.round(v)));
}
export function createPaletteMap(rgba,w,h,targetHexes,options={}){
  if(!Array.isArray(targetHexes)||targetHexes.length<2||targetHexes.length>6)
    throw Error('팔레트 조합에는 2~6개의 색상이 필요합니다.');
  const targets=targetHexes.map(paletteRgb);
  const source=discoverSourceColors(rgba,w,h,targets.length,options);
  if(!source.length)throw Error('바꿀 수 있는 PNG 픽셀이 없습니다. 원본 투명도와 색상을 확인해 주세요.');
  return {
    source,targets,sourceHex:source.map(c=>rgbToHex(...c)),
    targetHex:targetHexes.map(c=>c.toUpperCase()),
    unusedTargets:Math.max(0,targets.length-source.length),
    options:{preserveWhiteBlack:options.preserveWhiteBlack!==false,
      preserveShading:options.preserveShading===true}
  };
}
export function applyPaletteMap(rgba,w,h,map,{mask=null}={}){
  if(rgba.length!==w*h*4)throw Error('픽셀 데이터 길이가 문서 크기와 일치하지 않습니다.');
  if(mask&&mask.length!==w*h)throw Error('선택 영역의 크기가 원본 PNG와 다릅니다.');
  const out=new Uint8ClampedArray(rgba);
  let changed=0,eligible=0;
  for(let i=0;i<w*h;i++){
    const p=i*4,r=rgba[p],g=rgba[p+1],b=rgba[p+2],a=rgba[p+3];
    if(!paletteEligible(a,r,g,b,map.options))continue;
    const strength=mask?mask[i]/255:1;
    if(strength<=0)continue;
    eligible++;
    let best=0,score=Infinity;
    for(let k=0;k<map.source.length;k++){
      const center=map.source[k];
      const dr=r-center[0],dg=g-center[1],db=b-center[2];
      const d=.55*dr*dr+dg*dg+.42*db*db;
      if(d<score){score=d;best=k;}
    }
    const source=map.source[best],target=map.targets[best];
    const drift=map.options.preserveShading
      ?clamp((.2126*(r-source[0])+.7152*(g-source[1])+.0722*(b-source[2]))*.58,-28,28):0;
    for(let k=0;k<3;k++){
      const next=clamp(Math.round(target[k]+drift),0,255);
      out[p+k]=Math.round(rgba[p+k]*(1-strength)+next*strength);
    }
    if(out[p]!==r||out[p+1]!==g||out[p+2]!==b)changed++;
    // Keep original PNG alpha bit-for-bit. No resampling or blur.
  }
  return {data:out,changed,eligible};
}
