// Strict offline palette parser for multi-swatch PNG previews.
export function parseVariantColors(input,{max=6}={}){
  const parts=String(input??'').split(/[\s,;]+/).map(s=>s.trim()).filter(Boolean);
  if(parts.length<2||parts.length>max)
    throw Error('색상별 시안은 2~'+max+'개의 HEX 색상을 입력해 주세요.');
  const colors=[];
  for(const p of parts){
    if(!/^#[0-9a-fA-F]{6}$/.test(p))
      throw Error('시안 색상은 #RRGGBB 형식이어야 합니다: '+p);
    const color=p.toUpperCase();
    if(!colors.includes(color))colors.push(color);
  }
  if(colors.length<2)throw Error('서로 다른 색상을 2개 이상 입력해 주세요.');
  return colors;
}
export function variantFileName(baseName,color,index){
  const safe=String(baseName||'KIZE').replace(/\.[^.]+$/,'')
    .replace(/[\\/:*?"<>|]+/g,'-').slice(0,80)||'KIZE';
  return safe+'-color-'+String(index+1).padStart(2,'0')+'-'+color.slice(1)+'.png';
}
