import {analyzeCharacterPixels,generateCharacterPalettes} from './character-palette.mjs';
import {hexToRGB} from './engine.js';

const $=id=>document.getElementById(id);
const KEY='kize-shared-palettes-v1';
const ROLE_OPTIONS=[
 ['auto','자동'],['main','메인'],['sub','서브'],['light','라이트'],
 ['point','포인트'],['outline','외곽선'],['hair','머리색 (직접 지정)'],
 ['eyes','눈동자색 (직접 지정)'],['clothes','의상색 (직접 지정)']
];
const validHex=s=>/^#[0-9A-F]{6}$/i.test(s);
export function installCharacterPalette({applyPalette,notify,download}){
  let imageUrl=null,sourceImage=null,sourceCanvas=null,swatches=[],palettes=[],selected=null;
  let uiSeed=0;
  function clearPhoto(){
    if(imageUrl){URL.revokeObjectURL(imageUrl);imageUrl=null;}
    sourceImage=null;sourceCanvas=null;swatches=[];palettes=[];selected=null;
    $('charPhotoInput').value='';$('charReference').hidden=true;
    $('charExtractedColors').replaceChildren();$('charPaletteSuggestions').replaceChildren();
    $('charPreviewImage').removeAttribute('src');
    $('charPaletteState').textContent='사진을 첨부하면 12가지 팔레트를 만들어요.';
  }
  function controls(){
    return {pastel:Number($('charPastel').value),
      brightness:Number($('charBrightness').value),
      saturation:Number($('charSaturation').value),
      contrast:Number($('charContrast').value),
      whiteRatio:Number($('charWhite').value),
      accent:Number($('charAccent').value)};
  }
  function rerenderPalettes(){
    if(!swatches.length)return;
    try{palettes=generateCharacterPalettes(swatches,controls());}
    catch(err){notify(err.message);return;}
    const container=$('charPaletteSuggestions');
    container.replaceChildren();
    for(let i=0;i<palettes.length;i++){
      const p=palettes[i],button=document.createElement('button');
      button.type='button';button.className='char-palette-item';
      const title=document.createElement('span');title.textContent=p.name;
      const colors=document.createElement('span');colors.className='char-palette-swatches';
      for(const c of p.colors){
        const chip=document.createElement('span');chip.style.background=c;chip.title=c;
        colors.append(chip);
      }
      button.append(title,colors);
      if(selected===i)button.classList.add('selected');
      button.onclick=()=>{
        selected=i;
        applyPalette(p.colors);
        $('charPaletteState').textContent='「'+p.name+'」 조합을 아래 팔레트에 전달했어요. 미리보기를 확인한 뒤 ‘이 팔레트 적용’을 눌러 확정하세요.';
        rerenderPalettes();
      };
      container.append(button);
    }
  }
  function renderSwatches(){
    const holder=$('charExtractedColors');holder.replaceChildren();
    for(let i=0;i<swatches.length;i++){
      const s=swatches[i];
      const row=document.createElement('div');row.className='char-swatch';
      if(s.excluded)row.classList.add('excluded');
      const color=document.createElement('input');color.type='color';color.value=s.hex;
      color.title='이 색상 코드 직접 변경';
      color.oninput=()=>{if(s.locked)return;s.hex=color.value.toUpperCase();hex.value=s.hex;rerenderPalettes();};
      const hex=document.createElement('input');hex.type='text';hex.value=s.hex;hex.maxLength=7;
      hex.setAttribute('aria-label','추출 색상 '+(i+1)+' HEX');
      hex.onchange=()=>{
        if(s.locked||!validHex(hex.value)){hex.value=s.hex;return;}
        s.hex=hex.value.toUpperCase();color.value=s.hex;rerenderPalettes();
      };
      const role=document.createElement('select');role.setAttribute('aria-label','색상 '+(i+1)+' 역할');
      for(const [value,label] of ROLE_OPTIONS){
        const opt=document.createElement('option');opt.value=value;opt.textContent=label;
        role.append(opt);
      }
      role.value=s.role;role.onchange=()=>{s.role=role.value;rerenderPalettes();};
      const lock=document.createElement('button');lock.type='button';
      lock.textContent=s.locked?'잠금':'잠그기';lock.title='잠금 시 HEX 수정 방지';
      lock.onclick=()=>{s.locked=!s.locked;color.disabled=s.locked;hex.disabled=s.locked;lock.textContent=s.locked?'잠금':'잠그기';};
      const exclude=document.createElement('button');exclude.type='button';
      exclude.textContent=s.excluded?'포함':'제외';exclude.title='추천 팔레트에서 제외';
      exclude.onclick=()=>{s.excluded=!s.excluded;renderSwatches();rerenderPalettes();};
      const copy=document.createElement('button');copy.type='button';copy.textContent='복사';copy.title='HEX 복사';
      copy.onclick=()=>{navigator.clipboard?.writeText(s.hex).then(()=>notify('HEX 복사: '+s.hex)).catch(()=>notify('복사할 HEX: '+s.hex));};
      row.append(color,hex,role,lock,exclude,copy);holder.append(row);
    }
    rerenderPalettes();
  }
  async function analyze(){
    if(!sourceImage)return;
    try{
      const originalWidth=sourceImage.width,originalHeight=sourceImage.height;
      const factor=Math.min(1,Math.sqrt(1_500_000/(originalWidth*originalHeight)));
      const w=Math.max(2,Math.round(originalWidth*factor));
      const h=Math.max(2,Math.round(originalHeight*factor));
      if(w*h>1_800_000)throw Error('분석 이미지가 너무 커요.');
      const c=document.createElement('canvas');c.width=w;c.height=h;
      const ctx=c.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(sourceImage,0,0,w,h);
      const data=ctx.getImageData(0,0,w,h);
      const result=analyzeCharacterPixels(data.data,w,h,{limit:7});
      swatches=result.swatches;
      selected=null;
      $('charReport').textContent=result.note+
        ' (대표색 '+swatches.length+'종 · 원본 '+originalWidth+'×'+originalHeight+'px)';
      renderSwatches();
    }catch(error){notify('캐릭터 사진 색상 분석 실패: '+(error?.message||error));}
  }
  async function setImage(file){
    if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type)){
      notify('사진은 PNG, JPG 또는 WEBP를 첨부해 주세요.');return;
    }
    if(file.size>40*1024*1024){notify('분석용 사진 파일은 40MB 이하로 준비해 주세요.');return;}
    const next=URL.createObjectURL(file);
    try{
      const bitmap=await createImageBitmap(file);
      // Keep source photo separate: do not paint into editing document canvas.
      if(sourceImage?.close)sourceImage.close();
      if(imageUrl)URL.revokeObjectURL(imageUrl);
      sourceImage=bitmap;imageUrl=next;
      $('charPreviewImage').src=next;
      $('charReference').hidden=false;
      $('charZoom').value='100';$('charPreviewImage').style.transform='scale(1)';
      await analyze();
      notify('캐릭터 사진을 로컬에서 분석했습니다. 원본 편집 화면은 그대로입니다.');
    }catch(e){URL.revokeObjectURL(next);notify('사진을 열 수 없어요: '+(e?.message||e));}
  }
  $('charPhotoInput').onchange=e=>{const file=e.target.files?.[0];if(file)void setImage(file);};
  $('charRemove').onclick=clearPhoto;
  $('charAnalyze').onclick=()=>void analyze();
  $('charZoom').oninput=e=>$('charPreviewImage').style.transform='scale('+(Number(e.target.value)/100)+')';
  const drop=$('charDropzone');
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('hover');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('hover'));
  drop.addEventListener('drop',e=>{
    e.preventDefault();drop.classList.remove('hover');
    const f=e.dataTransfer?.files?.[0];if(f)void setImage(f);
  });
  // The photo itself doubles as a simple eyedropper. Pixel values are sampled
  // at the original reference bitmap resolution without changing document data.
  $('charPreviewImage').onclick=e=>{
    if(!sourceImage)return;
    const r=e.currentTarget.getBoundingClientRect();
    const x=Math.min(sourceImage.width-1,Math.max(0,Math.floor((e.clientX-r.left)/r.width*sourceImage.width)));
    const y=Math.min(sourceImage.height-1,Math.max(0,Math.floor((e.clientY-r.top)/r.height*sourceImage.height)));
    const c=document.createElement('canvas');c.width=c.height=1;
    const g=c.getContext('2d');g.drawImage(sourceImage,x,y,1,1,0,0,1,1);
    const data=g.getImageData(0,0,1,1).data;
    if(data[3]<24){notify('이 위치는 투명 영역이에요. 캐릭터 색상 부분을 클릭해 주세요.');return;}
    const hex='#'+[data[0],data[1],data[2]].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
    if(swatches.length<8)swatches.push({hex,source:'eyedropper',role:'point',locked:false,excluded:false});
    else{
      const slot=swatches.findIndex(s=>!s.locked);
      if(slot<0){notify('모든 색상이 잠겨 있어 새 색상을 담을 수 없어요.');return;}
      swatches[slot]={...swatches[slot],hex,source:'eyedropper'};
    }
    renderSwatches();notify('참고 이미지에서 '+hex+' 색상을 추출했습니다.');
  };
  $('charAddSwatch').onclick=()=>{
    if(swatches.length>=8){notify('대표색은 최대 8개까지 사용할 수 있어요.');return;}
    swatches.push({hex:'#BBDDF2',source:'manual',role:'point',locked:false,excluded:false});
    renderSwatches();
  };
  $('charCopyHex').onclick=()=>{
    const str=swatches.filter(s=>!s.excluded).map(s=>s.hex).join(', ');
    navigator.clipboard?.writeText(str).then(()=>notify('대표 HEX 목록을 복사했어요.')).catch(()=>notify(str));
  };
  for(const id of ['charPastel','charBrightness','charSaturation','charContrast','charWhite','charAccent'])
    $(id).oninput=rerenderPalettes;
  function jsonDownload(object,name){
    download(new Blob([JSON.stringify(object,null,2)],{type:'application/json'}),name);
  }
  function readLibrary(){
    try{
      const value=JSON.parse(localStorage.getItem(KEY)||'[]');
      return Array.isArray(value)?value:[];
    }catch{return [];}
  }
  $('charSavePalette').onclick=()=>{
    if(selected===null||!palettes[selected]){
      notify('먼저 추천 팔레트 중 하나를 선택해 주세요.');return;
    }
    const item={...palettes[selected],savedAt:new Date().toISOString(),
      id:'palette-'+Date.now(),schema:'KIZE_SHARED_PALETTE_1'};
    try{
      const old=readLibrary();
      const found=old.findIndex(p=>p.name===item.name&&p.colors.join(',')===item.colors.join(','));
      if(found>=0)old.splice(found,1);
      old.unshift(item);localStorage.setItem(KEY,JSON.stringify(old.slice(0,100)));
      window.dispatchEvent(new Event('kize:palette-saved'));
      $('charPaletteState').textContent='팔레트를 로컬 라이브러리에 저장했어요. 공유 JSON으로 내보내서 다른 도구에서도 가져올 수 있습니다.';
      notify('「'+item.name+'」 팔레트를 로컬에 저장했습니다.');
    }catch(e){notify('팔레트 저장 실패: '+(e?.message||e));}
  };
  $('charExportPalettes').onclick=()=>{
    if(!palettes.length){notify('먼저 캐릭터 사진을 분석해 주세요.');return;}
    jsonDownload({format:'KIZE_SHARED_PALETTES_1',source:'character photo, local',
      palettes,swatches,settings:controls()},'KIZE-character-palettes.json');
    notify('12가지 캐릭터 팔레트를 JSON으로 저장했어요.');
  };
  return {getSaved:readLibrary,clear:clearPhoto};
}
