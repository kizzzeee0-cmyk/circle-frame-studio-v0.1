// Extract conservative Photoshop feature metadata without rasterizing or
// pretending that HTML Canvas reproduces Photoshop layer styles.
const FX_KEYS=['dropShadow','innerShadow','outerGlow','innerGlow','bevel','solidFill','satin','stroke','gradientOverlay','patternOverlay'];
const SPECIAL_BLENDS=new Set(['pass through','dissolve','color dodge','color burn','linear burn','linear dodge','vivid light','linear light','pin light','hard mix','hue','saturation','color','luminosity','subtract','divide']);
const pretty={dropShadow:'드롭 섀도',innerShadow:'내부 그림자',outerGlow:'외부 광선',
  innerGlow:'내부 광선',bevel:'베벨',solidFill:'컬러 오버레이',
  satin:'새틴',stroke:'획',gradientOverlay:'그라데이션 오버레이',
  patternOverlay:'패턴 오버레이'};
const hasActualEffect=value=>Array.isArray(value)?value.some(v=>v&&v.enabled!==false):!!value&&(value.enabled!==false);
export function inspectPhotoshopLayer(layer,groups=[]){
  const effects=layer?.effects||{};
  const activeEffects=FX_KEYS.filter(k=>hasActualEffect(effects[k]));
  if(layer?.objectBasedEffectsLayerInfo&&!activeEffects.length)activeEffects.push('customEffects');
  const mask=!!layer?.mask&&!layer.mask.disabled;
  const vector=!!layer?.vectorMask&&!layer.vectorMask.disabled;
  const clip=!!layer?.clipping;
  const adjustment=!!layer?.adjustment;
  const smart=!!layer?.placedLayer;
  const text=!!layer?.text;
  const fill=!!layer?.vectorFill;
  const blend=String(layer?.blendMode||'normal');
  const advancedBlend=blend!=='normal'&&blend!=='source-over';
  const groupEffects=groups.some(g=>g.blendMode&&g.blendMode!=='pass through'&&g.blendMode!=='normal');
  const issues=[];
  if(mask)issues.push('픽셀 마스크');
  if(vector)issues.push('벡터 마스크');
  if(clip)issues.push('클리핑');
  if(activeEffects.length)issues.push('레이어 효과 '+activeEffects.map(k=>pretty[k]||'기타').join('·'));
  if(advancedBlend)issues.push('혼합 모드 '+blend);
  if(groupEffects)issues.push('그룹 혼합');
  if(adjustment)issues.push('조정 레이어');
  if(smart)issues.push('스마트 오브젝트');
  if(text)issues.push('텍스트');
  if(fill)issues.push('벡터 채우기');
  const complexity=issues.length?'caution':'basic';
  // "basic" still means only simple pixels; do not promise Photoshop fidelity.
  return {
    sourceId:Number.isFinite(layer?.id)?layer.id:null,
    groupPath:groups.map(g=>String(g.name||'그룹')),
    groupDepth:groups.length,
    blendMode:blend,
    opacity:layer?.opacity??1,
    clipping:clip,
    mask,vectorMask:vector,
    adjustments:adjustment,
    effects:activeEffects,
    text,smartObject:smart,vectorFill:fill,
    advancedBlend,groupEffects,
    complexity,issues,
    guidance:issues.length
      ?'레이어 재구성 정확도 제한 · Photoshop 원본 합성 보존 색상 편집 권장'
      :'원시 픽셀 재구성 가능 · 원본과 비교 후 내보내기',
  };
}
export function summarizePsdCompatibility(layers,{compositeAvailable=false,skippedCount=0}={}){
  const counts={total:layers.length,basic:0,caution:0,mask:0,vectorMask:0,clipping:0,
    effects:0,advancedBlend:0,groups:0,text:0,smartObject:0,adjustments:0,skipped:skippedCount};
  const groupNames=new Set();
  for(const layer of layers){
    const c=layer.compatibility||{};
    if(c.complexity==='caution')counts.caution++;else counts.basic++;
    for(const key of ['mask','vectorMask','clipping','advancedBlend','text','smartObject'])
      if(c[key])counts[key]++;
    if(c.adjustments)counts.adjustments++;
    if(c.effects?.length)counts.effects++;
    for(const n of c.groupPath||[])groupNames.add(n);
  }
  counts.groups=groupNames.size;
  const observations=[];
  if(!compositeAvailable)observations.push('Photoshop 원본 합성 이미지 없음: PSD 외관 보존 모드를 보장할 수 없습니다.');
  if(counts.skipped)observations.push('일부 PSD 레이어가 처리 용량 또는 형식 제한으로 제외되었습니다.');
  if(counts.caution)observations.push('마스크·그룹·효과·혼합 모드는 원시 레이어 재구성만으로 정확하게 표시되지 않을 수 있습니다.');
  return {counts,compositeAvailable,observations,
    editingPolicy:compositeAvailable?'원본 합성 기준으로 선택한 색상만 수정':'레이어 재구성만 가능 · 정확도 제한'};
}
