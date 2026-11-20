// Pure, testable pixel operations. All edits preserve dimensions and alpha.
export const clamp = (v,min=0,max=255)=>Math.max(min,Math.min(max,v));
export const hexToRGB = h => /^#[a-f\d]{6}$/i.test(h) ? [1,3,5].map(p=>parseInt(h.slice(p,p+2),16)) : null;
export const rgbToHex = (r,g,b) => '#'+[r,g,b].map(n=>Math.round(clamp(n)).toString(16).padStart(2,'0')).join('').toUpperCase();
export function regionMask(data,w,h,x,y,tolerance=24,connected=true) {
  const mask=new Uint8Array(w*h);
  if(x<0||x>=w||y<0||y>=h)return mask;
  const p=(y*w+x)*4;
  if(data[p+3]===0)return mask;
  const target=[data[p],data[p+1],data[p+2]];
  const matches=i=>data[i*4+3]>0 && Math.hypot(data[i*4]-target[0],data[i*4+1]-target[1],data[i*4+2]-target[2])<=tolerance;
  if(!connected){for(let i=0;i<w*h;i++)if(matches(i))mask[i]=1;return mask;}
  const q=new Int32Array(w*h);
  let a=0,b=0;const seed=y*w+x;q[b++]=seed;mask[seed]=1;
  while(a<b){const i=q[a++],xx=i%w,yy=(i/w)|0;
    for(const n of [xx>0?i-1:-1,xx<w-1?i+1:-1,yy>0?i-w:-1,yy<h-1?i+w:-1]){
      if(n>=0&&!mask[n]&&matches(n)){mask[n]=1;q[b++]=n;}
    }
  }
  return mask;
}
export function recolorPixels(data,w,h,mask,toHex) {
  const rgb=hexToRGB(toHex);
  if(!rgb)throw Error('유효한 색상이 아닙니다.');
  let r=0,g=0,b=0,n=0;const out=new Uint8ClampedArray(data);
  for(let i=0;i<w*h;i++)if(mask[i]&&data[i*4+3]){r+=data[i*4];g+=data[i*4+1];b+=data[i*4+2];n++;}
  if(!n)return {data:out,count:0};
  r/=n;g/=n;b/=n;
  for(let i=0;i<w*h;i++)if(mask[i]&&data[i*4+3]){
    const p=i*4;
    // Preserve local variation and exact source alpha; never blur/resample.
    out[p]=clamp(rgb[0]+data[p]-r);
    out[p+1]=clamp(rgb[1]+data[p+1]-g);
    out[p+2]=clamp(rgb[2]+data[p+2]-b);
  }
  return {data:out,count:n};
}
export function photoAdjust(data,options={}) {
  const out=new Uint8ClampedArray(data);
  const exposure=Math.pow(2,(Number(options.exposure)||0)/100);
  const contrast=(Number(options.contrast)||0)/100;
  const sat=1+(Number(options.saturation)||0)/100;
  const warmth=(Number(options.warmth)||0)*0.5;
  const highlights=(Number(options.highlights)||0)/100;
  const shadows=(Number(options.shadows)||0)/100;
  for(let i=0;i<out.length;i+=4){
    const rgb=[out[i],out[i+1],out[i+2]].map(v=>clamp(v*exposure));
    for(let c=0;c<3;c++){
      let v=rgb[c];
      v=clamp((v-128)*(1+contrast)+128);
      v=clamp(v + shadows*(1-v/255)*45 + highlights*(v/255)*45);
      rgb[c]=v;
    }
    const lum=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
    out[i]=clamp(lum+(rgb[0]-lum)*sat+warmth);
    out[i+1]=clamp(lum+(rgb[1]-lum)*sat);
    out[i+2]=clamp(lum+(rgb[2]-lum)*sat-warmth);
  }
  return out;
}
export function clampToCanvas(x,y,w,h,docw,doch){
  return {x:Math.min(docw-w,Math.max(0,x)),y:Math.min(doch-h,Math.max(0,y))};
}
