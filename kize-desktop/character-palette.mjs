import {hexToRGB,rgbToHex,clamp} from './engine.js';

const toHex=a=>rgbToHex(a[0],a[1],a[2]);
const luma=c=>(c[0]*.2126+c[1]*.7152+c[2]*.0722)/255;
const chroma=c=>(Math.max(...c)-Math.min(...c))/255;
const distance=(a,b)=>Math.hypot((a[0]-b[0])*.78,(a[1]-b[1]),(a[2]-b[2])*.67);
function mix(a,b,f){const aa=Array.isArray(a)?a:hexToRGB(a),bb=Array.isArray(b)?b:hexToRGB(b);return toHex(aa.map((v,i)=>clamp(Math.round(v+(bb[i]-v)*f))));}
function rgbToHsl(hex){
  const c=hexToRGB(hex).map(x=>x/255),hi=Math.max(...c),lo=Math.min(...c),d=hi-lo;
  let h=0,s=0;const l=(hi+lo)/2;
  if(d){s=d/(1-Math.abs(2*l-1));
    switch(hi){case c[0]:h=((c[1]-c[2])/d)%6;break;
      case c[1]:h=(c[2]-c[0])/d+2;break;
      default:h=(c[0]-c[1])/d+4;}
    h=(h*60+360)%360;}
  return [h,s,l];
}
function hslToHex(h,s,l){
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
  const a=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return toHex(a.map(v=>Math.round((v+m)*255)));
}
export function tuneColor(hex,{lightness=0,saturation=0,hue=0}={}){
  const [h,s,l]=rgbToHsl(hex);
  return hslToHex((h+hue+360)%360,clamp(s+saturation,0,1),clamp(l+lightness,0,1));
}
export function analyzeCharacterPixels(data,w,h,{limit=7}={}){
  if(!data||data.length!==w*h*4||w<2||h<2)throw Error('사진 색상 데이터 크기가 잘못되었습니다.');
  // Downsampling is for ANALYSIS ONLY. Source bitmap remains untouched.
  const step=Math.max(1,Math.floor(Math.sqrt(w*h/32000)));
  const edge=new Map();
  for(let x=0;x<w;x+=Math.max(1,Math.floor(w/40))){
    for(const y of [0,h-1]){
      const p=(y*w+x)*4;if(data[p+3]>230){
        const key=[data[p]>>5,data[p+1]>>5,data[p+2]>>5].join(':');
        edge.set(key,(edge.get(key)||0)+1);
      }
    }
  }
  const background=[...edge.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const edgeDominant=Boolean(background&&edge.get(background)>=30);
  const bins=new Map();
  let valid=0,ignored=0,alpha=0;
  for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
    const p=(y*w+x)*4,a=data[p+3];
    if(a<48){alpha++;continue;}
    const rgb=[data[p],data[p+1],data[p+2]];
    const key=rgb.map(n=>n>>4).join(':');
    const bgKey=rgb.map(n=>n>>5).join(':');
    const centrality=1+.55*(1-Math.abs(x/w-.5)*2)*(1-Math.abs(y/h-.5)*2);
    if(edgeDominant&&bgKey===background&&(x<w*.2||x>w*.8||y<h*.2||y>h*.8)){ignored++;continue;}
    let item=bins.get(key);
    if(!item){item={color:[0,0,0],n:0};bins.set(key,item);}
    item.n+=centrality*a/255;
    for(let k=0;k<3;k++)item.color[k]+=rgb[k]*centrality*a/255;
    valid++;
  }
  const items=[...bins.values()].filter(t=>t.n>=2).map(t=>({
    rgb:t.color.map(v=>v/t.n),weight:t.n
  })).sort((a,b)=>b.weight-a.weight);
  if(!items.length)throw Error('캐릭터에서 분석할 색상 픽셀이 없어요.');
  const count=clamp(Math.round(limit),5,8);
  const chosen=[items[0]];
  while(chosen.length<count){
    let best=null,score=0;
    for(const entry of items){
      const d=Math.min(...chosen.map(c=>distance(entry.rgb,c.rgb)));
      if(d<27)continue;
      const v=Math.sqrt(entry.weight)*Math.min(95,d)*(1+chroma(entry.rgb)*.48);
      if(v>score){score=v;best=entry;}
    }
    if(!best)break;
    chosen.push(best);
  }
  // Include both a light and dark source color when distinctly present.
  for(const pick of [
    items.filter(c=>luma(c.rgb)>.7).sort((a,b)=>b.weight-a.weight)[0],
    items.filter(c=>luma(c.rgb)<.38).sort((a,b)=>b.weight-a.weight)[0]
  ]){
    if(!pick||chosen.some(c=>distance(c.rgb,pick.rgb)<30))continue;
    if(chosen.length<count)chosen.push(pick);
    else chosen[chosen.length-1]=pick;
  }
  const swatches=chosen.slice(0,count).map((item,i)=>({
    hex:toHex(item.rgb),source:'image',weight:Math.round(item.weight),
    role:i===0?'main':i===1?'sub':i===2?'point':'auto',
    locked:false,excluded:false
  }));
  return {swatches,inspected:valid,ignoredBackground:ignored,transparent:alpha,
    note:edgeDominant&&ignored
      ?'사진 가장자리의 반복 배경색을 일부 제외했어요. 캐릭터 영역이 맞는지 색상을 확인해 주세요.'
      :'원본의 투명 영역을 제외하고 실제 이미지의 대표색을 추출했어요.'};
}
export const PHOTO_CATEGORIES=[
  '캐릭터 원본색','부드러운 파스텔','밝고 포근한','귀엽고 통통 튀는',
  '깔끔하고 심플한','화이트 비중 높게','명확한 색상 대비','차분하고 은은하게',
  '눈동자색 중심 (수동 지정 가능)','밝은 배경 중심','머리색 중심 (수동 지정 가능)',
  '의상색 중심 (수동 지정 가능)'
];
export function generateCharacterPalettes(swatches,{
  pastel=45,brightness=0,saturation=0,whiteRatio=55,contrast=20,accent=45
}={}){
  const active=swatches.filter(s=>!s.excluded&&hexToRGB(s.hex));
  if(!active.length)throw Error('팔레트를 만들려면 사용할 색상이 적어도 한 가지 필요해요.');
  const role=(r,fallback)=>active.find(s=>s.role===r)?.hex||fallback;
  const source=active.map(s=>s.hex);
  const base=role('main',source[0]),sub=role('sub',source[1]||source[0]);
  const point=role('point',source.slice().sort((a,b)=>chroma(hexToRGB(b))-chroma(hexToRGB(a)))[0]);
  const light=role('light',source.slice().sort((a,b)=>luma(hexToRGB(b))-luma(hexToRGB(a)))[0]);
  const dark=role('outline',source.slice().sort((a,b)=>luma(hexToRGB(a))-luma(hexToRGB(b)))[0]);
  const whiten=clamp((whiteRatio-25)/100,.05,.69);
  const soften=clamp(pastel/100,0,.85);
  const tint=(color,amount=0)=>mix(color,'#FFFFFF',clamp(soften*.55+brightness/220+amount,0,.9));
  const sat=c=>tuneColor(c,{saturation:saturation/330,lightness:brightness/350});
  const bright=c=>mix(c,'#FFFFFF',whiten);
  const outline=()=>mix(dark,'#344553',.5);
  const opts=[
    [base,sub,bright(light),point,outline()],
    [tint(base),tint(sub),bright(light),tint(point,-.13),outline()],
    [tint(base,.16),bright(sub),bright(light),tint(point),outline()],
    [tint(base),tint(sub,-.12),bright(light),sat(point),outline()],
    [base,bright(sub),bright(light),sat(point),outline()],
    [bright(base),tint(sub,.12),'#FFFDFB',point,outline()],
    [tint(base,-.08),tint(sub,-.08),bright(light),sat(point),mix(dark,'#17202A',contrast/150)],
    [tint(base,.24),tint(sub,.24),bright(light),tint(point,.18),outline()],
    [base,sub,bright(light),role('eyes',point),mix(dark,'#17202A',.3)],
    [bright(base),bright(sub),bright(light),point,outline()],
    [role('hair',light),tint(base),bright(sub),point,outline()],
    [role('clothes',sub),tint(base),bright(light),point,outline()]
  ];
  return opts.map((arr,i)=>{
    let colors=arr.map((c,j)=>j===3
      ?tuneColor(c,{saturation:accent/420+ saturation/450,lightness:-accent/950+brightness/350})
      :sat(c));
    const roles=['main','sub','light','point','outline'];
    // Locked colors are exact constants across every generated category,
    // unlike auto-generated tints. User-provided color remains editable
    // until intentionally locked in the UI.
    for(const item of active){
      const position=roles.indexOf(item.role);
      if(item.locked&&position>=0)colors[position]=item.hex.toUpperCase();
    }
    // Ensure visibly distinct dark linework, light negative space and accent.
    if(colors[4]===colors[2])colors[4]=outline();
    return {name:PHOTO_CATEGORIES[i],colors,roles,
      source:'character',category:PHOTO_CATEGORIES[i],id:'photo-'+(i+1)};
  });
}
