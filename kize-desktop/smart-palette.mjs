// Palette-aware color rotation: preserve each asset subcolor's hue offset,
// local saturation and value instead of painting all subparts one flat RGB.
const clip=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function rgbToHsv(r,g,b){
  r/=255;g/=255;b/=255;
  const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo;
  let h=0;
  if(d>0){
    if(hi===r)h=60*(((g-b)/d)%6);
    else if(hi===g)h=60*((b-r)/d+2);
    else h=60*((r-g)/d+4);
  }
  return {h:(h+360)%360,s:hi===0?0:d/hi,v:hi};
}
export function hsvToRgb(h,s,v){
  h=((h%360)+360)%360;s=clip(s);v=clip(v);
  const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
  let a,b,d;
  if(h<60)[a,b,d]=[c,x,0];else if(h<120)[a,b,d]=[x,c,0];
  else if(h<180)[a,b,d]=[0,c,x];else if(h<240)[a,b,d]=[0,x,c];
  else if(h<300)[a,b,d]=[x,0,c];else [a,b,d]=[c,0,x];
  return [Math.round((a+m)*255),Math.round((b+m)*255),Math.round((d+m)*255)];
}
export function rotateAssetPalette(rgb,anchorRgb,targetRgb,{preserveShading=true,protectNeutrals=true}={}){
  const src=rgbToHsv(...rgb),anchor=rgbToHsv(...anchorRgb),target=rgbToHsv(...targetRgb);
  if(src.s<.085&&protectNeutrals)return rgb.slice();
  const hue=(src.h+target.h-anchor.h+360)%360;
  // Target color controls palette family; existing color relationships,
  // shadows and highlights remain differentiated.
  const scale=target.s/Math.max(anchor.s,.16);
  const saturation=clip(src.s*scale);
  const value=preserveShading?clip(src.v+(target.v-anchor.v)*.22):target.v;
  return hsvToRgb(hue,saturation,value);
}
