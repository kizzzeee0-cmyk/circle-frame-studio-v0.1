import {importPsdPixels} from './psd-loader.js';
import {regionMask,recolorPixels,photoAdjust,hexToRGB,rgbToHex,clamp} from './engine.js';
import {initUpdates} from './updater.js';

const $=id=>document.getElementById(id);
const canvas=$('renderCanvas'),ctx=canvas.getContext('2d',{alpha:true});
const overlay=$('overlayCanvas'),oc=overlay.getContext('2d');
const stage=$('stage'),holder=$('canvasHolder');
let documentModel=null,layers=[],selectedId=null,selection=null,zoom=1,history=[],lastImportPsd=false,drag=null;
let nextId=1;
const maxDocPixels=26000000,maxLayerPixels=65000000,maxLayers=120;
const defaultAdjust=()=>({exposure:0,contrast:0,saturation:0,warmth:0,highlights:0,shadows:0});
function notify(s){$('status').textContent=s;}
function cloneCanvas(src){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);return c;}
function blankCanvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
function pixelCanvas(p){const c=blankCanvas(p.width,p.height);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p.data),p.width,p.height),0,0);return c;}
function toImageData(c){return c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);}
function newLayer(obj){return {id:nextId++,name:'레이어',x:0,y:0,w:100,h:100,visible:true,opacity:1,flipH:false,flipV:false,rotation:0,blend:'source-over',type:'image',adjust:defaultAdjust(),offsetX:0,offsetY:0,scale:100,...obj};}
function sel(){return layers.find(l=>l.id===selectedId)||null;}
function settingsSnapshot(layer){return {id:layer.id,canvas:cloneCanvas(layer.canvas),x:layer.x,y:layer.y,w:layer.w,h:layer.h,flipH:layer.flipH,flipV:layer.flipV,rotation:layer.rotation,visible:layer.visible,opacity:layer.opacity,adjust:{...layer.adjust},offsetX:layer.offsetX,offsetY:layer.offsetY,scale:layer.scale,photoSource:layer.photoSource,textValue:layer.textValue,fontFamily:layer.fontFamily,fontSize:layer.fontSize,textColor:layer.textColor};}
function checkpoint(l){if(!l)return;history.push(settingsSnapshot(l));if(history.length>12)history.shift();}
function openDoc(w,h,name,kind){documentModel={width:w,height:h,name,kind};canvas.width=overlay.width=w;canvas.height=overlay.height=h;holder.style.display='block';$('canvasEmpty').style.display='none';$('sourceName').textContent=name;$('docInfo').textContent=w+'×'+h+'px · '+kind;selectedId=null;selection=null;history=[];}
function normOpacity(v){return Math.max(0,Math.min(1,Number(v??1)));}
function mappedBlend(s){return ({normal:'source-over',multiply:'multiply',screen:'screen',overlay:'overlay',darken:'darken',lighten:'lighten','color dodge':'color-dodge','color burn':'color-burn',difference:'difference',exclusion:'exclusion'}[s]||'source-over');}
function flatten(items,prefix='',hidden=false,out=[]){
  for(const entry of items||[]){
    if(entry.children){flatten(entry.children,prefix?prefix+' / '+entry.name:entry.name,hidden||entry.hidden,out);}
    else out.push({...entry,_displayName:prefix?prefix+' / '+(entry.name||'레이어'):(entry.name||'레이어'),_hiddenGroup:hidden});
  }
  return out;
}
function psdMeta(arr){let total=0,count=0;for(const l of arr){count++;const w=Math.max(0,(l.right||0)-(l.left||0)),h=Math.max(0,(l.bottom||0)-(l.top||0));total+=w*h;if(w*h>maxDocPixels||total>maxLayerPixels||count>maxLayers)throw Error('레이어 크기 또는 개수가 안전 제한을 넘었습니다.');}return count;}
async function importPsd(file){
  const start=performance.now();
  notify('PSD 파일 해석 중…');
  showImportReport('', 'normal');
  const buffer=await file.arrayBuffer();
  // Display the 'loading' status before CPU-bound PSD decoding begins.
  await new Promise(requestAnimationFrame);
  const result=importPsdPixels(buffer,{onProgress:message=>notify(message)});
  const {header,layers:rawLayers,composite,warnings,decodedCount,layerTotal,skippedCount}=result;
  const built=rawLayers.map(pl=>newLayer({
    name:pl.name,type:pl.type,x:pl.x,y:pl.y,w:pl.w,h:pl.h,
    visible:!pl.hidden,opacity:normOpacity(pl.opacity),
    blend:mappedBlend(pl.blendMode),canvas:pixelCanvas(pl.bitmap),
    psdText:pl.psdText||null,textValue:pl.psdText?.text||'',
    fontFamily:pl.psdText?.style?.font?.name||'Arial',
    fontSize:Math.max(1,Math.round(pl.psdText?.style?.fontSize||32)),
    textColor:rgbToHex(pl.psdText?.style?.fillColor?.r??50,pl.psdText?.style?.fillColor?.g??50,pl.psdText?.style?.fillColor?.b??50),
  }));
  built.reverse(); // Photoshop layer list is highest layer first.
  if(!built.length && composite){
    built.push(newLayer({
      name:'통합 미리보기 (레이어 복구 필요)',type:'composite',
      x:0,y:0,w:header.width,h:header.height,
      canvas:pixelCanvas(composite),
    }));
  }
  openDoc(header.width,header.height,file.name,
    header.version===2?'PSB':'PSD');
  layers=built;lastImportPsd=true;
  selectedId=layers.length?layers[layers.length-1].id:null;
  refreshAll();fitZoom();
  const seconds=((performance.now()-start)/1000).toFixed(1);
  const detail='불러오기 완료: '+decodedCount+'/'+layerTotal+'개 레이어 · '+header.bits+'비트 · '+seconds+'초'+
    (skippedCount?' · 일부 레이어 제외 '+skippedCount+'개':'');
  const warningMessage=warnings.length?warnings.join(' / '):'';
  notify(detail+(warnings.length?' · 일부 항목은 별도 확인 필요':''));
  showImportReport(detail+(warningMessage?'\n'+warningMessage:''),warnings.length?'warning':'success');
}
function showImportReport(message,type='normal'){
  const el=$('importReport');if(!el)return;
  el.textContent=message;
  el.hidden=!message;
  el.dataset.type=type;
}

async function importRaster(file){
  const image=await createImageBitmap(file);
  if(image.width*image.height>maxDocPixels){image.close();throw Error('이미지 크기가 제한을 넘었습니다.');}
  const c=blankCanvas(image.width,image.height);c.getContext('2d').drawImage(image,0,0);image.close();
  openDoc(c.width,c.height,file.name,'IMAGE');layers=[newLayer({name:file.name,type:'image',canvas:c,x:0,y:0,w:c.width,h:c.height})];lastImportPsd=false;selectedId=layers[0].id;refreshAll();fitZoom();
  notify('이미지를 레이어로 불러왔습니다. 클릭하여 색상 영역을 선택하세요.');
}
async function importProject(file){
  const obj=JSON.parse(await file.text());
  if(obj?.format!=='KIZE-PROJECT-1'||!obj.width||!obj.height||obj.width*obj.height>maxDocPixels||!Array.isArray(obj.layers)||obj.layers.length>maxLayers)throw Error('올바른 KIZE 프로젝트 파일이 아닙니다.');
  const loaded=[];
  for(const l of obj.layers){
    const b=await (await fetch(l.data)).blob(),im=await createImageBitmap(b),c=blankCanvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);im.close();
    const {data,...props}=l;
    loaded.push(newLayer({...props,canvas:c,photoSource:null,adjust:defaultAdjust()}));
  }
  openDoc(obj.width,obj.height,file.name,'KIZE');layers=loaded;selectedId=layers.at(-1)?.id||null;lastImportPsd=false;refreshAll();fitZoom();notify('KIZE 프로젝트를 열었습니다.');
}
$('importFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  try{if(/\.psd$/i.test(file.name))await importPsd(file);else if(/\.kize\.json$/i.test(file.name))await importProject(file);else await importRaster(file);}
  catch(err){
    const reason=err?.message||String(err);
    notify('불러오기 실패: '+reason);
    showImportReport('PSD/이미지 열기 실패\n'+reason+
      '\n\n원인 확인을 위해 오류 메시지나 PSD 샘플 파일을 보내주시면 해당 형식에 맞춰 수정할 수 있습니다.', 'error');
    console.error('KIZE import error:',err);
  }
});
function sourceToCanvas(l){
  const source=l.photoSource;if(!source)return l.canvas;
  const output=blankCanvas(l.canvas.width,l.canvas.height),cx=output.getContext('2d');
  const ratio=Math.max(output.width/source.width,output.height/source.height)*l.scale/100;
  const dw=source.width*ratio,dh=source.height*ratio;
  cx.drawImage(source,(output.width-dw)/2+l.offsetX,(output.height-dh)/2+l.offsetY,dw,dh);
  return output;
}
function layerImage(l){
  let image=sourceToCanvas(l);
  if(!Object.values(l.adjust||{}).some(v=>v!==0))return image;
  const c=cloneCanvas(image),pc=c.getContext('2d',{willReadFrequently:true}),p=pc.getImageData(0,0,c.width,c.height);
  p.data.set(photoAdjust(p.data,l.adjust));pc.putImageData(p,0,0);return c;
}
function render(){
  if(!documentModel)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(const l of layers){if(!l.visible||!l.canvas)continue;
    ctx.save();ctx.globalAlpha=normOpacity(l.opacity);ctx.globalCompositeOperation=l.blend;
    ctx.translate(l.x+l.w/2,l.y+l.h/2);ctx.rotate(l.rotation*Math.PI/180);ctx.scale(l.flipH?-1:1,l.flipV?-1:1);
    ctx.drawImage(layerImage(l),-l.w/2,-l.h/2,l.w,l.h);ctx.restore();}
  drawOverlay();
}
function drawOverlay(){
  oc.clearRect(0,0,overlay.width,overlay.height);const l=sel();if(!l)return;
  oc.save();oc.lineWidth=Math.max(1,1.5/zoom);oc.setLineDash([7/zoom,5/zoom]);oc.strokeStyle='#9476D7';oc.strokeRect(l.x,l.y,l.w,l.h);oc.restore();
  if(selection&&selection.id===l.id){
    const {mask,w,h}=selection,ox=l.x,oy=l.y;
    // Sparse selection indication, not resampling underlying document.
    oc.fillStyle='rgba(165,102,235,.14)';
    for(let y=0;y<h;y+=Math.max(1,Math.floor(3/zoom)))for(let x=0;x<w;x+=Math.max(1,Math.floor(3/zoom)))if(mask[y*w+x])oc.fillRect(ox+x,oy+y,Math.max(1,3/zoom),Math.max(1,3/zoom));
  }
}
function refreshLayers(){
  const list=$('layerList');list.replaceChildren();
  const shown=layers.slice().reverse().filter(l=>$('showHidden').checked||l.visible);
  $('layerCount').textContent=layers.length;
  if(!shown.length){list.innerHTML='<div class="placeholder">표시할 레이어가 없습니다.</div>';return;}
  for(const l of shown){
    const row=document.createElement('button');row.className='layer'+(l.id===selectedId?' active':'');row.type='button';
    const icon=document.createElement('span');icon.className='layer-icon';icon.textContent=l.type==='text'?'T':l.type==='smart-object'?'◇':'▧';
    const label=document.createElement('span');label.className='layer-text';
    const name=document.createElement('strong');name.textContent=l.name;
    const note=document.createElement('small');note.textContent=l.type+' · '+Math.round(l.w)+'×'+Math.round(l.h);
    label.append(name,note);
    const eye=document.createElement('span');eye.className='eye';eye.textContent=l.visible?'◉':'○';
    row.append(icon,label,eye);row.onclick=()=>{select(l.id);};list.append(row);
  }
}
function refreshProperties(){
  const l=sel();$('selectedType').textContent=l?l.type:'선택 없음';
  for(const [input,key] of [['propX','x'],['propY','y'],['propW','w'],['propH','h']])$(input).value=l?Math.round(l[key]):'';
  $('visibleLayer').checked=!!l?.visible;$('opacityLayer').value=Math.round((l?.opacity??1)*100);
  $('photoScale').value=l?.scale??100;$('photoOffsetX').value=l?.offsetX??0;$('photoOffsetY').value=l?.offsetY??0;
  $('textValue').value=l?.type==='text'?(l.textValue||''):'';
  $('fontFamily').value=l?.fontFamily||'';$('fontSize').value=l?.fontSize||32;$('textColor').value=l?.textColor||'#333333';
  for(const input of document.querySelectorAll('[data-adjust]')){const k=input.dataset.adjust;input.value=l?.adjust?.[k]||0;const id='out'+k[0].toUpperCase()+k.slice(1);if($(id))$(id).textContent=input.value;}
  $('textPanel').hidden=l?.type!=='text';
  $('selectionInfo').textContent=selection&&selection.id===selectedId?selection.count.toLocaleString()+'개 픽셀 선택됨':'색상 영역을 선택하지 않았습니다.';
}
function refreshAll(){refreshLayers();refreshProperties();render();}
function select(id){selectedId=id;selection=null;refreshAll();}
function setZoom(v){zoom=clamp(v,.1,8);$('zoomLabel').textContent=Math.round(zoom*100)+'%';if(documentModel){holder.style.width=Math.round(documentModel.width*zoom)+'px';holder.style.height=Math.round(documentModel.height*zoom)+'px';}}
function fitZoom(){if(!documentModel)return;const v=Math.min((stage.clientWidth-70)/documentModel.width,(stage.clientHeight-70)/documentModel.height,1);setZoom(clamp(v,.1,8));}
$('zoomIn').onclick=()=>setZoom(zoom*1.25);$('zoomOut').onclick=()=>setZoom(zoom/1.25);$('zoomFit').onclick=fitZoom;
stage.addEventListener('wheel',e=>{if(e.ctrlKey&&documentModel){e.preventDefault();setZoom(zoom*(e.deltaY<0?1.15:1/1.15));}},{passive:false});
function localPoint(e){const r=overlay.getBoundingClientRect();return{x:Math.floor((e.clientX-r.left)*overlay.width/r.width),y:Math.floor((e.clientY-r.top)*overlay.height/r.height)};}
function hit(l,x,y){if(!l.visible||x<l.x||y<l.y||x>=l.x+l.w||y>=l.y+l.h)return false;
  const visual=layerImage(l);const px=Math.floor((x-l.x)*visual.width/l.w),py=Math.floor((y-l.y)*visual.height/l.h);if(px<0||py<0||px>=visual.width||py>=visual.height)return false;
  return visual.getContext('2d',{willReadFrequently:true}).getImageData(px,py,1,1).data[3]>0;
}
overlay.addEventListener('pointerdown',e=>{
  if(!documentModel)return;
  const pt=localPoint(e),l=layers.slice().reverse().find(l=>hit(l,pt.x,pt.y));
  if(!l)return;
  if(selectedId!==l.id)select(l.id);
  if(e.shiftKey){checkpoint(l);drag={id:l.id,originX:l.x,originY:l.y,start:pt};overlay.setPointerCapture(e.pointerId);return;}
  const visual=layerImage(l),px=Math.floor((pt.x-l.x)*visual.width/l.w),py=Math.floor((pt.y-l.y)*visual.height/l.h);
  const data=toImageData(visual).data,idx=(py*visual.width+px)*4;
  const tol=Number($('colorTolerance').value);
  const mask=regionMask(data,visual.width,visual.height,px,py,tol,$('connectedOnly').checked);
  let count=0;for(let i=0;i<mask.length;i++)count+=mask[i];
  selection={id:l.id,mask,w:visual.width,h:visual.height,count};
  $('pickedHex').value=rgbToHex(data[idx],data[idx+1],data[idx+2]);refreshProperties();render();
  notify('레이어 「'+l.name+'」 안에서 '+count.toLocaleString()+'개 픽셀 선택됨');
});
overlay.addEventListener('pointermove',e=>{
  if(!drag)return;const l=sel();if(!l||drag.id!==l.id)return;
  const p=localPoint(e),threshold=8/zoom;
  l.x=Math.round(drag.originX+p.x-drag.start.x);l.y=Math.round(drag.originY+p.y-drag.start.y);
  if($('guideOn').checked){
    if(Math.abs(l.x+l.w/2-documentModel.width/2)<threshold)l.x=Math.round((documentModel.width-l.w)/2);
    if(Math.abs(l.y+l.h/2-documentModel.height/2)<threshold)l.y=Math.round((documentModel.height-l.h)/2);
  }
  refreshProperties();render();syncGuides();
});
function stopDrag(){if(!drag)return;drag=null;syncGuides();refreshAll();}
overlay.addEventListener('pointerup',stopDrag);overlay.addEventListener('pointercancel',stopDrag);
function syncGuides(){const l=sel(),on=$('guideOn').checked&&!!l&&!!documentModel;const x=on&&Math.abs(l.x+l.w/2-documentModel.width/2)<=1,y=on&&Math.abs(l.y+l.h/2-documentModel.height/2)<=1;$('guideV').hidden=!x;$('guideH').hidden=!y;}
$('guideOn').onchange=syncGuides;
$('colorTolerance').oninput=e=>$('toleranceOut').textContent=e.target.value;
$('showHidden').onchange=refreshLayers;
$('applyColor').onclick=()=>{
  const l=sel();if(!l||!selection||selection.id!==l.id){notify('먼저 수정할 레이어의 색상 영역을 클릭해 선택하세요.');return;}
  checkpoint(l);const base=layerImage(l),px=toImageData(base),result=recolorPixels(px.data,px.width,px.height,selection.mask,$('targetColor').value);
  px.data.set(result.data);l.canvas=pixelCanvas(px);if(l.photoSource){l.photoSource=null;l.adjust=defaultAdjust();l.type='image';}
  selection=null;refreshAll();notify(result.count.toLocaleString()+'개 픽셀 변경 완료 · 사진 보정 레이어는 현재 보이는 상태로 픽셀에 고정됩니다.');
};
$('undo').onclick=()=>{
  const last=history.pop();if(!last){notify('되돌릴 작업이 없습니다.');return;}
  const l=layers.find(x=>x.id===last.id);if(!l)return;
  Object.assign(l,last);selection=null;refreshAll();notify('마지막 편집을 되돌렸습니다.');
};
for(const [id,key] of [['propX','x'],['propY','y'],['propW','w'],['propH','h']]){
  $(id).onchange=e=>{const l=sel();if(!l)return;checkpoint(l);const v=Number(e.target.value);if(Number.isFinite(v)){l[key]=key==='w'||key==='h'?clamp(Math.round(v),1,20000):Math.round(v);}refreshAll();syncGuides();};
}
$('opacityLayer').oninput=e=>{const l=sel();if(l){l.opacity=Number(e.target.value)/100;render();}};
$('visibleLayer').onchange=e=>{const l=sel();if(l){checkpoint(l);l.visible=e.target.checked;refreshAll();}};
$('centerH').onclick=()=>align(true);$('centerV').onclick=()=>align(false);
function align(horizontal){const l=sel();if(!l)return;checkpoint(l);if(horizontal)l.x=Math.round((documentModel.width-l.w)/2);else l.y=Math.round((documentModel.height-l.h)/2);refreshAll();syncGuides();}
for(const [id,key] of [['flipH','flipH'],['flipV','flipV']])$(id).onclick=()=>{const l=sel();if(!l)return;checkpoint(l);l[key]=!l[key];render();};
$('rotate90').onclick=()=>{const l=sel();if(!l)return;checkpoint(l);l.rotation=(l.rotation+90)%360;render();};
async function replaceImage(file){
  if(!documentModel){await importRaster(file);return;}
  if(!file?.type?.startsWith('image/'))throw Error('사진 파일만 선택할 수 있습니다.');
  const im=await createImageBitmap(file);
  if(im.width*im.height>maxDocPixels){im.close();throw Error('사진이 너무 큽니다.');}
  const src=blankCanvas(im.width,im.height);src.getContext('2d').drawImage(im,0,0);im.close();
  let l=sel();
  if(l){checkpoint(l);l.type='photo';l.name=file.name+' (교체됨)';l.photoSource=src;l.adjust=defaultAdjust();l.offsetX=l.offsetY=0;l.scale=100;}
  else {const w=Math.min(documentModel.width,src.width),h=Math.min(documentModel.height,src.height);l=newLayer({name:file.name,type:'photo',canvas:blankCanvas(w,h),photoSource:src,w,h,x:Math.round((documentModel.width-w)/2),y:Math.round((documentModel.height-h)/2)});layers.push(l);selectedId=l.id;}
  selection=null;refreshAll();notify('사진을 기존 레이어 영역에 맞춰 교체했습니다. 내부 이동/크기와 톤을 조정할 수 있습니다.');
}
$('replaceFile').onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(f)try{await replaceImage(f);}catch(err){notify('사진 교체 실패: '+err.message);}};
for(const input of document.querySelectorAll('[data-adjust]'))input.oninput=e=>{
  const l=sel();if(!l)return;
  if(!l.photoSource){l.photoSource=cloneCanvas(l.canvas);}
  const k=e.target.dataset.adjust;l.adjust[k]=Number(e.target.value);const out=$('out'+k[0].toUpperCase()+k.slice(1));if(out)out.textContent=e.target.value;render();
};
$('resetAdjust').onclick=()=>{const l=sel();if(!l)return;checkpoint(l);l.adjust=defaultAdjust();refreshAll();};
for(const [id,key] of [['photoScale','scale'],['photoOffsetX','offsetX'],['photoOffsetY','offsetY']])$(id).onchange=e=>{const l=sel();if(!l||!l.photoSource)return;l[key]=id==='photoScale'?clamp(Number(e.target.value),10,500):Math.round(Number(e.target.value));render();};
$('applyText').onclick=()=>{
  const l=sel();if(!l||l.type!=='text'||!l.psdText){notify('PSD에서 가져온 텍스트 레이어를 선택해 주세요.');return;}
  checkpoint(l);l.textValue=$('textValue').value;l.fontFamily=$('fontFamily').value||'Arial';l.fontSize=clamp(Number($('fontSize').value)||32,1,999);l.textColor=$('textColor').value;
  const c=blankCanvas(l.canvas.width,l.canvas.height),cx=c.getContext('2d');
  cx.fillStyle=l.textColor;cx.font=l.fontSize+'px "'+l.fontFamily.replace(/["\\]/g,'')+'", sans-serif';cx.textBaseline='top';
  l.textValue.split('\n').forEach((line,i)=>cx.fillText(line,0,i*l.fontSize*1.2,c.width));
  l.canvas=c;selection=null;render();
  notify('텍스트 미리보기 갱신됨 · 원본 Photoshop 타이포그래피/효과와 차이 날 수 있습니다.');
};
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
$('exportPng').onclick=()=>{
  if(!documentModel){notify('먼저 디자인 파일을 불러와 주세요.');return;}
  render();
  canvas.toBlob(blob=>{if(blob)downloadBlob(blob,(documentModel.name.replace(/\.[^.]+$/,'')||'KIZE-design')+'-edited.png');else notify('PNG 저장에 실패했습니다.');},'image/png');
};
$('saveProject').onclick=()=>{
  if(!documentModel){notify('저장할 프로젝트가 없습니다.');return;}
  try{
    const out={format:'KIZE-PROJECT-1',width:documentModel.width,height:documentModel.height,layers:layers.map(l=>{
      const {canvas,photoSource,psdText,...props}=l;return {...props,data:layerImage(l).toDataURL('image/png')};
    })};
    downloadBlob(new Blob([JSON.stringify(out)],{type:'application/json'}),'KIZE-project.kize.json');
    notify('KIZE 프로젝트 저장 완료 · PSD 파일은 변경하지 않았습니다.');
  }catch(err){notify('프로젝트 저장 실패: '+err.message);}
};
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click();}});
window.addEventListener('resize',()=>{if(documentModel)syncGuides();});
initUpdates($('updateStatus'),$('checkUpdate'));
