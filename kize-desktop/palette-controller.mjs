// KIZE PNG palette-combination UI. The user selects one MULTICOLOR palette
// and applies it to one image; the ZIP contains rendered palette combinations.
// Nothing is applied merely by choosing a preset or exporting a ZIP.
import {parseVariantColors} from './palette-variants.mjs';
import {PALETTE_PRESETS} from './palette-presets.mjs';
import {effectiveColor} from './color-workflow.mjs';
import {createPaletteMap,applyPaletteMap} from './palette-combination.mjs';
import {zipSync,strToU8} from 'fflate';

const $=id=>document.getElementById(id);
export function installPaletteController(api){
  let active=false,timer=null;
  const combo=()=>$('variantOutputMode').value==='combo';
  function dismiss(){
    if(!active)return;
    active=false;
    api.showPreview(null);
    $('palettePreview').textContent='조합 미리보기';
  }
  function context(){
    const source=api.pngSource();
    if(!source)throw Error('팔레트 조합은 단일 PNG 파일에서만 적용할 수 있어요. PSD는 기존 단색 시안 모드를 이용하세요.');
    if(source.width*source.height>8_000_000)
      throw Error('팔레트 변경은 최대 800만 픽셀 PNG까지 지원해요.');
    if(!source.width||!source.height||source.rgba.length!==source.width*source.height*4)
      throw Error('원본 PNG 크기/픽셀 자료를 확인할 수 없어요.');
    let mask=null;
    if($('paletteScope').value==='selected'){
      mask=api.selectedMask(source.layerId,source.width,source.height);
      if(!mask||!mask.some(Boolean))
        throw Error('선택한 부분만 변경하려면 먼저 색을 클릭하거나 전체 선택을 눌러 주세요.');
    }
    return {...source,mask};
  }
  function plan(source,colors){
    const finish=$('variantFinish').value;
    const actual=colors.map(c=>effectiveColor(c,finish,Number($('variantSoftness').value)));
    const map=createPaletteMap(source.rgba,source.width,source.height,actual,{
      preserveWhiteBlack:$('paletteProtectNeutrals').checked,
      preserveShading:$('palettePreserveTone').checked||finish==='shaded'||finish==='palette',
      mask:source.mask
    });
    return {actual,map,input:colors};
  }
  function currentPlan(){
    const source=context();
    return {source,...plan(source,parseVariantColors($('variantColors').value))};
  }
  function updateMapping(){
    const box=$('paletteMapping');box.replaceChildren();
    if(!combo())return;
    const caption=document.createElement('p');caption.className='palette-map-caption';
    try{
      const {map,actual}=currentPlan();
      caption.textContent='원본의 독립 색상 패밀리 → 현재 조합의 기준색 · 그림자/외곽선은 같은 패밀리의 명도 단계로 자동 유지';
      box.append(caption);
      for(let i=0;i<map.sourceHex.length;i++){
        const row=document.createElement('div');row.className='palette-map-item';
        const before=document.createElement('span');before.className='palette-map-source';before.style.background=map.sourceHex[i];
        const after=document.createElement('span');after.className='palette-map-target';after.style.background=actual[i];
        const arrow=document.createElement('span');arrow.className='palette-map-arrow';arrow.textContent='→';
        const detail=document.createElement('code');detail.textContent=map.sourceHex[i]+' → '+actual[i];
        row.append(before,arrow,after,detail);box.append(row);
      }
      if(map.unusedTargets){
        const warning=document.createElement('p');warning.className='palette-map-caption';
        warning.textContent='원본에서 서로 다른 색상 계열이 '+map.source.length+'개만 발견되어 조합 색상 '+map.unusedTargets+
          '개는 사용되지 않았어요. 원본에 없는 색상 영역을 임의로 만들지 않습니다.';
        box.append(warning);
      }
      $('paletteScopeHint').textContent=
        '독립 색상 패밀리 '+map.source.length+'개를 팔레트 기준색에 대응합니다. 같은 계열의 외곽선·그림자는 별도 색을 소비하지 않고 자동으로 더 어둡게 유지됩니다.';
    }catch(e){caption.textContent=e?.message||String(e);box.append(caption);}
  }
  function schedule({preview=false}={}){
    dismiss();
    clearTimeout(timer);
    timer=setTimeout(()=>{
      timer=null;updateMapping();
      if(preview&&combo()&&api.canUse())previewOrApply(false);
    },280);
  }
  function refresh(){
    const isCombo=combo();
    $('paletteComboPanel').hidden=!isCombo;
    $('exportVariants').textContent=isCombo
      ?'현재 조합을 PNG ZIP으로 저장 (화면에는 미적용)'
      :'기존 단색 PNG 시안 ZIP 저장';
    $('paletteApply').disabled=!isCombo;
    $('paletteApply').title=isCombo
      ?'현재 PNG에 팔레트 여러 색을 동시에 적용합니다.'
      :'여러 색을 동시에 바꾸려면 변경할 방식을 전체 조합으로 선택하세요.';
    schedule();
  }
  function transform(source,plan){
    return applyPaletteMap(source.rgba,source.width,source.height,plan.map,{mask:source.mask});
  }
  function previewOrApply(commit){
    if(!combo()){api.notify('전체 팔레트 조합 모드에서 적용해 주세요.');return;}
    if(!commit&&active){
      dismiss();api.notify('미리보기 해제 · 원본 PNG는 변경되지 않았습니다.');return;
    }
    if(commit)dismiss();
    try{
      const {source,...p}=currentPlan();
      const result=transform(source,p);
      if(result.changed===0){
        api.notify('변경된 색상이 없습니다. 다른 팔레트나 흰색·검정 보호 설정을 확인해 주세요.');return;
      }
      if(!commit){
        active=true;
        api.showPreview({width:source.width,height:source.height,data:result.data});
        $('palettePreview').textContent='미리보기 해제';
        api.notify('여러 색상을 동시에 바꾼 미리보기입니다. 원본은 아직 변경되지 않았어요. 마음에 들면 ‘조합 적용’을 눌러 주세요.');
      }else{
        api.commit(source.layerId,{width:source.width,height:source.height,data:result.data},result.changed);
        api.notify('팔레트 조합 적용 완료 · '+result.changed.toLocaleString()+
          '픽셀 변경 · 원본 크기와 투명도 유지 · Ctrl+Z로 되돌릴 수 있어요.');
        updateMapping();
      }
    }catch(e){api.notify('팔레트 적용: '+(e?.message||e));}
  }
  function candidates(){
    const colors=parseVariantColors($('variantColors').value);
    const list=[{name:'선택한 색상 조합',colors}];
    if($('paletteZipCount').value==='1')return list;
    const choice=$('variantPreset').value;
    const chosen=PALETTE_PRESETS.find(p=>p.colors.join(', ')===choice);
    const family=chosen?PALETTE_PRESETS.filter(p=>p.group===chosen.group):PALETTE_PRESETS;
    const start=chosen?family.indexOf(chosen)+1:0;
    for(let offset=0;offset<family.length&&list.length<4;offset++){
      const p=family[(start+offset)%family.length];
      if(p.colors.join(',')===colors.join(','))continue;
      list.push({name:p.label,colors:p.colors});
    }
    return list;
  }
  async function exportZip(){
    const button=$('exportVariants');
    if(button.disabled)return;
    button.disabled=true;
    try{
      const source=context(),variants=candidates();
      if(variants.length>1&&source.width*source.height>4_000_000)
        throw Error('4개 조합 ZIP은 400만 픽셀 이하만 지원해요. 1개 조합 저장을 선택해 주세요.');
      const entries={},metadata=[];
      for(let i=0;i<variants.length;i++){
        const variant=variants[i],p=plan(source,variant.colors);
        const output=transform(source,p);
        const filename='palette-'+String(i+1).padStart(2,'0')+'.png';
        api.notify('팔레트 조합 ZIP 생성 · '+(i+1)+'/'+variants.length+' · '+variant.name);
        entries[filename]=[await api.pngBytes({width:source.width,height:source.height,data:output.data}),{level:0}];
        metadata.push({file:filename,label:variant.name,inputColors:p.input,
          outputColors:p.actual,sourceColors:p.map.sourceHex,
          mapping:p.map.sourceHex.map((from,j)=>({from,to:p.actual[j]})),
          changedPixels:output.changed,unusedTargetCount:p.map.unusedTargets});
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      entries['palette-mapping.json']=[strToU8(JSON.stringify({
        format:'KIZE-MULTICOLOR-PALETTES-1',source:api.filename(),
        note:'각 PNG는 여러 팔레트 색상이 동시에 적용된 완성 시안입니다. ZIP 저장은 편집 중인 파일을 변경하지 않습니다.',
        width:source.width,height:source.height,variants:metadata
      },null,2)),{level:6}];
      entries['README-사용법.txt']=[strToU8(
        'palette-01.png 등은 팔레트의 여러 색상이 함께 적용된 PNG 완성 시안입니다.\n'+
        'ZIP 저장은 미리보기/편집 화면을 변경하지 않습니다.\n'+
        'KIZE 앱에서 팔레트 조합을 고른 후 [선택한 팔레트 조합을 PNG에 적용] 버튼을 눌러야 현재 문서가 변경됩니다.\n'
      ),{level:6}];
      const safe=(api.filename()||'KIZE').replace(/\.[^.]+$/,'')
        .replace(/[\\/:*?"<>|]+/g,'-').slice(0,80);
      api.download(new Blob([zipSync(entries,{level:0})],{type:'application/zip'}),
        safe+'-palette-combinations.zip');
      api.notify(variants.length+'개 다색 팔레트 시안 ZIP 저장 완료 · 실제 화면에 적용하려면 ‘조합 적용’ 버튼을 누르세요.');
    }catch(e){api.notify('팔레트 ZIP 저장 실패: '+(e?.message||e));console.error(e);}
    finally{button.disabled=false;}
  }
  $('variantOutputMode').addEventListener('change',refresh);
  for(const id of ['variantPreset','variantColors','variantFinish','variantSoftness',
    'variantSoftnessNumber','paletteScope','paletteProtectNeutrals',
    'palettePreserveTone']){
    const el=$(id);
    const handler=e=>{
      if(e.target.id==='variantPreset'&&api.canUse()){
        // A palette preset means a MULTI-SWATCH combination, regardless of a
        // last-used legacy "single color for each PNG" setting.
        if($('variantOutputMode').value!=='combo'){
          $('variantOutputMode').value='combo';
          $('paletteComboPanel').hidden=false;
          $('exportVariants').textContent='현재 조합을 PNG ZIP으로 저장 (화면에는 미적용)';
          $('paletteApply').disabled=false;
        }
        schedule({preview:true});
      }else schedule();
    };
    el.addEventListener('input',handler);
    el.addEventListener('change',handler);
  }
  $('palettePreview').onclick=()=>previewOrApply(false);
  $('paletteApply').onclick=()=>previewOrApply(true);
  refresh();
  return {refresh,dismiss,exportZip,updateMapping,
    preview:()=>schedule({preview:true})};
}
