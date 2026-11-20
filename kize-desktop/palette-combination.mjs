// Role-aware palette mapping for a single PNG raster layer.
// v0.16 groups the same design color family across fill/shadow/outline tones,
// then derives darker/lighter variants from ONE target swatch instead of
// assigning every shade to an unrelated palette color.
import {hexToRGB,rgbToHex,clamp} from './engine.js';

const MAX_SAMPLE=18000;
const rgbDistance=(a,b)=>{
  const dr=a[0]-b[0],dg=a[1]-b[1],db=a[2]-b[2];
  return .55*dr*dr+dg*dg+.42*db*db;
};
const luminance=(r,g,b)=>.2126*r+.7152*g+.0722*b;
const saturation=(r,g,b)=>{
  const hi=Math.max(r,g,b),lo=Math.min(r,g,b);
  return hi<=0?0:(hi-lo)/hi;
};
const hue=(r,g,b)=>{
  r/=255;g/=255;b/=255;
  const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;
  if(d===0)return 0;
  let h=0;
  if(hi===r)h=60*(((g-b)/d)%6);
  else if(hi===g)h=60*((b-r)/d+2);
  else h=60*((r-g)/d+4);
  return (h+360)%360;
};
const hueDistance=(a,b)=>{
  const d=Math.abs(a-b)%360;
  return Math.min(d,360-d);
};
function stats(rgb){
  return {
    h:hue(...rgb),
    s:saturation(...rgb),
    l:luminance(...rgb),
    c:Math.max(...rgb)-Math.min(...rgb),
  };
}
const neutralLike=st=>st.s<.105||st.c<18;
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
function familyDistance(a,b){
  const A=stats(a),B=stats(b);
  const aNeutral=neutralLike(A),bNeutral=neutralLike(B);
  if(aNeutral&&bNeutral)return Math.abs(A.l-B.l)*1.35;
  if(aNeutral!==bNeutral)return 235+Math.abs(A.l-B.l)*.22;
  return hueDistance(A.h,B.h)*3.5+Math.abs(A.s-B.s)*115+Math.abs(A.l-B.l)*.10;
}
function sameShadeFamily(a,b){
  const A=stats(a),B=stats(b);
  if(neutralLike(A)&&neutralLike(B))return Math.abs(A.l-B.l)<=34;
  if(neutralLike(A)||neutralLike(B))return false;
  return hueDistance(A.h,B.h)<=19&&Math.abs(A.s-B.s)<=.42;
}
function buildEntries(rgba,w,h,{preserveWhiteBlack=true,mask=null}={}){
  const pixels=w*h;
  const stride=mask?1:Math.max(1,Math.floor(pixels/MAX_SAMPLE));
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
  return [...bins.values()].filter(x=>x.weight>0)
    .map(x=>{
      const rgb=x.sum.map(v=>v/x.weight);
      return {rgb,weight:x.weight,...stats(rgb)};
    })
    .sort((a,b)=>b.weight-a.weight);
}
function discoverSourceFamilies(rgba,w,h,count,options={}){
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||
      rgba.length!==w*h*4)throw Error('PNG 픽셀 크기 또는 픽셀 데이터가 잘못되었습니다.');
  const desired=clamp(Math.trunc(count),1,6);
  if(options.mask&&options.mask.length!==w*h)throw Error('색상 인식 대상 선택 영역 크기가 잘못되었습니다.');
  const entries=buildEntries(rgba,w,h,options);
  if(!entries.length)return [];
  const total=entries.reduce((sum,e)=>sum+e.weight,0);
  const centers=[];

  // First choose independent chromatic families. A darker pink shadow and
  // brighter pink fill share one family because hue is the semantic identity.
  for(const entry of entries){
    if(neutralLike(entry))continue;
    if(centers.some(c=>sameShadeFamily(entry.rgb,c)))continue;
    centers.push(entry.rgb.slice());
    if(centers.length>=desired)break;
  }

  // Neutral midtones can be real design fills. Deep neutral tones are much
  // more commonly outlines/drop-shadows, so they never consume a palette slot
  // when chromatic families already exist; they inherit the nearby fill later.
  for(const entry of entries){
    if(centers.length>=desired)break;
    if(!neutralLike(entry)||entry.l<=105||entry.l>=239)continue;
    const significant=centers.length===0||entry.weight>=total*.18;
    if(!significant)continue;
    if(centers.some(c=>sameShadeFamily(entry.rgb,c)))continue;
    centers.push(entry.rgb.slice());
  }

  // Fallback for unusual artwork. Deep neutrals are still skipped while a
  // chromatic family exists so outline pixels cannot steal a target swatch.
  for(const entry of entries){
    if(centers.length>=desired)break;
    if(neutralLike(entry)&&entry.l<=105&&centers.length>0)continue;
    if(centers.some(c=>sameShadeFamily(entry.rgb,c)))continue;
    const nearest=Math.min(...centers.map(c=>familyDistance(entry.rgb,c)),Infinity);
    if(nearest<38)continue;
    centers.push(entry.rgb.slice());
  }
  if(!centers.length)centers.push(entries[0].rgb.slice());

  for(let iter=0;iter<3;iter++){
    const groups=centers.map(()=>[]);
    for(const entry of entries){
      // Deep neutral outline/shadow samples should not pull a chromatic family
      // center away from the actual fill hue/value.
      if(neutralLike(entry)&&entry.l<=105&&centers.some(c=>!neutralLike(stats(c))))continue;
      let best=0,score=Infinity;
      for(let j=0;j<centers.length;j++){
        const d=familyDistance(entry.rgb,centers[j]);
        if(d<score){score=d;best=j;}
      }
      groups[best].push(entry);
    }
    centers.splice(0,centers.length,...groups.map((group,i)=>{
      if(!group.length)return centers[i];
      let sum=[0,0,0],weight=0;
      for(const e of group){weight+=e.weight;for(let q=0;q<3;q++)sum[q]+=e.rgb[q]*e.weight;}
      return sum.map(v=>v/Math.max(weight,1e-9));
    }));
  }

  const groups=centers.map(()=>[]);
  for(const entry of entries){
    if(neutralLike(entry)&&entry.l<=105&&centers.some(c=>!neutralLike(stats(c))))continue;
    let best=0,score=Infinity;
    for(let j=0;j<centers.length;j++){
      const d=familyDistance(entry.rgb,centers[j]);
      if(d<score){score=d;best=j;}
    }
    groups[best].push(entry);
  }
  return groups.map((group,i)=>{
    if(!group.length){
      const rgb=centers[i].map(v=>Math.round(v));
      return {rgb,weight:0,...stats(rgb)};
    }
    const anchor=[...group].sort((a,b)=>b.weight-a.weight)[0];
    const weight=group.reduce((sum,e)=>sum+e.weight,0);
    const rgb=anchor.rgb.map(v=>Math.round(v));
    return {rgb,weight,...stats(rgb)};
  }).filter(f=>f.weight>0)
    .sort((a,b)=>b.weight-a.weight);
}
export function discoverSourceColors(rgba,w,h,count,options={}){
  return discoverSourceFamilies(rgba,w,h,count,options).map(f=>f.rgb);
}
export function createPaletteMap(rgba,w,h,targetHexes,options={}){
  if(!Array.isArray(targetHexes)||targetHexes.length<2||targetHexes.length>6)
    throw Error('팔레트 조합에는 2~6개의 색상이 필요합니다.');
  const targets=targetHexes.map(paletteRgb);
  const families=discoverSourceFamilies(rgba,w,h,targets.length,options);
  if(!families.length)throw Error('바꿀 수 있는 PNG 픽셀이 없습니다. 원본 투명도와 색상을 확인해 주세요.');
  const source=families.map(f=>f.rgb);
  return {
    source,targets,families,sourceHex:source.map(c=>rgbToHex(...c)),
    targetHex:targetHexes.map(c=>c.toUpperCase()),
    unusedTargets:Math.max(0,targets.length-source.length),
    options:{
      preserveWhiteBlack:options.preserveWhiteBlack!==false,
      preserveShading:options.preserveShading===true,
      preserveRoles:options.preserveRoles!==false,
    }
  };
}
function nearestFamily(rgb,families){
  let best=0,score=Infinity;
  for(let k=0;k<families.length;k++){
    const d=familyDistance(rgb,families[k].rgb);
    if(d<score){score=d;best=k;}
  }
  return best;
}
function nearbyFamily(owner,w,h,index,maxRadius=4){
  const x=index%w,y=(index/w)|0;
  for(let r=1;r<=maxRadius;r++){
    for(let dy=-r;dy<=r;dy++){
      for(let dx=-r;dx<=r;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
        const xx=x+dx,yy=y+dy;
        if(xx<0||yy<0||xx>=w||yy>=h)continue;
        const family=owner[yy*w+xx];
        if(family>=0)return family;
      }
    }
  }
  return -1;
}
export function applyPaletteMap(rgba,w,h,map,{mask=null}={}){
  if(rgba.length!==w*h*4)throw Error('픽셀 데이터 길이가 문서 크기와 일치하지 않습니다.');
  if(mask&&mask.length!==w*h)throw Error('선택 영역의 크기가 원본 PNG와 다릅니다.');
  const out=new Uint8ClampedArray(rgba);
  const pixels=w*h;
  const families=Array.isArray(map.families)&&map.families.length
    ?map.families
    :map.source.map(rgb=>({rgb,...stats(rgb),weight:1}));
  const owner=new Int16Array(pixels);owner.fill(-1);

  // Pass 1: assign color-bearing pixels first. Neutral dark pixels are
  // resolved spatially from the nearby fill family in pass 2.
  for(let i=0;i<pixels;i++){
    if(mask&&!mask[i])continue;
    const p=i*4,r=rgba[p],g=rgba[p+1],b=rgba[p+2],a=rgba[p+3];
    if(!paletteEligible(a,r,g,b,map.options))continue;
    const s=saturation(r,g,b);
    const pixelStats=stats([r,g,b]);
    if(!neutralLike(pixelStats)){
      owner[i]=nearestFamily([r,g,b],families);
      continue;
    }
    const neutralFamilies=families
      .map((f,k)=>({f,k})).filter(x=>neutralLike(x.f));
    if(neutralFamilies.length){
      let best=neutralFamilies[0].k,score=Infinity;
      for(const item of neutralFamilies){
        const d=Math.abs(luminance(r,g,b)-item.f.l);
        if(d<score){score=d;best=item.k;}
      }
      owner[i]=best;
    }
  }

  let changed=0,eligible=0;
  for(let i=0;i<pixels;i++){
    const p=i*4,r=rgba[p],g=rgba[p+1],b=rgba[p+2],a=rgba[p+3];
    if(!paletteEligible(a,r,g,b,map.options))continue;
    const strength=mask?mask[i]/255:1;
    if(strength<=0)continue;
    eligible++;

    const pixelRgb=[r,g,b];
    const pixelStats=stats([r,g,b]);
    const pixelSat=pixelStats.s;
    const pixelLum=pixelStats.l;
    const pixelNeutral=neutralLike(pixelStats);
    let best=owner[i];

    if(best<0&&pixelNeutral&&pixelLum<218)best=nearbyFamily(owner,w,h,i,4);
    if(best<0)best=nearestFamily(pixelRgb,families);

    const family=families[best]||families[0];
    const target=map.targets[Math.min(best,map.targets.length-1)]||map.targets[0];
    const delta=pixelLum-family.l;
    let drift=0;

    if(map.options.preserveRoles!==false){
      if(map.options.preserveShading){
        drift=clamp(delta*.72,-104,82);
      }else if(delta<-12){
        drift=clamp(delta*.78,-104,0);
      }else if(delta>18){
        drift=clamp(delta*.52,0,62);
      }
      if(pixelNeutral&&pixelLum<family.l-18)
        drift=Math.min(drift,-Math.max(16,(family.l-pixelLum)*.78));
    }

    for(let k=0;k<3;k++){
      const next=clamp(Math.round(target[k]+drift),0,255);
      out[p+k]=Math.round(rgba[p+k]*(1-strength)+next*strength);
    }
    if(out[p]!==r||out[p+1]!==g||out[p+2]!==b)changed++;
  }
  return {data:out,changed,eligible};
}
