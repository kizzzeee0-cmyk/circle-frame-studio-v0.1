// PSD parsing runs in a worker to avoid blocking the editor while decoding large files.
import {regionMask,recolorPixels,photoAdjust,hexToRGB,rgbToHex,clamp} from './engine.js';
import {colorSelection,paintSelection} from './color-tools.mjs';
import {selectAssetRegion,growShrinkMask,maskBounds} from './selection-tools.mjs';
import {initUpdates} from './updater.js';

const $=id=>document.getElementById(id);
const canvas=$('renderCanvas'),ctx=canvas.getContext('2d',{alpha:true});
const overlay=$('overlayCanvas'),oc=overlay.getContext('2d');
const stage=$('stage'),holder=$('canvasHolder');
let documentModel=null,layers=[],selectedId=null,selection=null,zoom=1,history=[],lastImportPsd=false,drag=null;
// Original Photoshop composite is a read-only WYSIWYG reference. Canvas
// reconstruction of masks, layer styles, groups and text is never assumed exact.
let originalComposite=null,previewMode='layers',hasLayerEdits=false;
let nextId=1;
let selectionPreview=null,selectionParts=[];
let panX=0,panY=0;
let gradientStops=[{id:1,color:'#F5B8CC',position:0},{id:2,color:'#9185D5',position:100}];
let nextStopId=3;
const maxDocPixels=26000000,maxLayerPixels=65000000,maxLayers=120;
const maxPsdFileBytes=700*1024*1024;
const defaultAdjust=()=>({exposure:0,contrast:0,saturation:0,warmth:0,highlights:0,shadows:0});
function notify(s){$('status').textContent=s;}
function cloneCanvas(src){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);return c;}
function blankCanvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
function pixelCanvas(p){
  const c=blankCanvas(p.width,p.height);
  let data;
  if(p.data instanceof Uint16Array){data=new Uint8ClampedArray(p.data.length);for(let i=0;i<data.length;i++)data[i]=Math.round(p.data[i]/257);}
  else if(p.data instanceof Float32Array){data=new Uint8ClampedArray(p.data.length);for(let i=0;i<data.length;i++)data[i]=Math.max(0,Math.min(255,Math.round(p.data[i]*255)));}
  else data=new Uint8ClampedArray(p.data);
  c.getContext('2d').putImageData(new ImageData(data,p.width,p.height),0,0);
  return c;
}
function toImageData(c){return c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);}
function newLayer(obj){return {id:nextId++,name:'레이어',x:0,y:0,w:100,h:100,visible:true,opacity:1,flipH:false,flipV:false,rotation:0,blend:'source-over',type:'image',adjust:defaultAdjust(),offsetX:0,offsetY:0,scale:100,...obj};}
function sel(){return layers.find(l=>l.id===selectedId)||null;}
function settingsSnapshot(layer){return {id:layer.id,canvas:cloneCanvas(layer.canvas),x:layer.x,y:layer.y,w:layer.w,h:layer.h,flipH:layer.flipH,flipV:layer.flipV,rotation:layer.rotation,visible:layer.visible,opacity:layer.opacity,adjust:{...layer.adjust},offsetX:layer.offsetX,offsetY:layer.offsetY,scale:layer.scale,photoSource:layer.photoSource,textValue:layer.textValue,fontFamily:layer.fontFamily,fontSize:layer.fontSize,textColor:layer.textColor};}
function checkpoint(l){if(!l)return;history.push(settingsSnapshot(l));if(history.length>12)history.shift();hasLayerEdits=true;if(previewMode==='composite')setPreviewMode('layers');}
function checkpointBatch(list){
  if(list.length===1){checkpoint(list[0]);return;}
  history.push({batch:list.map(settingsSnapshot)});
  if(history.length>12)history.shift();
  hasLayerEdits=true;if(previewMode==='composite')setPreviewMode('layers');
}
function clearSelections(){
  selectionParts=[];selection=null;selectionPreview=null;
  $('pickedHex').value='—';$('pickedSwatch').style.backgroundColor='';
  updateSelectionUi();
}
function updateSelectionUi(){
  const count=selectionParts.reduce((n,p)=>n+p.count,0);
  const layersCount=new Set(selectionParts.map(p=>p.id)).size;
  const label=selectionParts.length+'개 영역'+(layersCount>1?' · '+layersCount+'개 레이어':'');
  if($('selectionPartsCount'))$('selectionPartsCount').textContent=label;
  if($('selectionInfo'))$('selectionInfo').textContent=selectionParts.length
    ?selectionParts.length+'개 영역 · '+count.toLocaleString()+'개 픽셀 선택 · Shift+클릭으로 추가 가능'
    :'색상/에셋 영역을 클릭해 선택하세요. Shift+클릭은 누적 선택입니다.';
}
function updateSelectionPreview(){
  selection=selectionParts.at(-1)||null;
  selectionPreview=selection?createMaskPreview(selection):null;
  updateSelectionUi();
}

function openDoc(w,h,name,kind){documentModel={width:w,height:h,name,kind};canvas.width=overlay.width=w;canvas.height=overlay.height=h;holder.style.display='block';$('canvasEmpty').style.display='none';$('sourceName').textContent=name;$('docInfo').textContent=w+'×'+h+'px · '+kind;selectedId=null;selection=null;history=[];originalComposite=null;previewMode='layers';hasLayerEdits=false;clearSelections();panX=panY=0;holder.style.transform='';stage.scrollLeft=0;stage.scrollTop=0;}
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
async function readPsdInBackground(file){
  if(file.size>maxPsdFileBytes)throw Error('현재 최대 파일 크기는 700MiB입니다. 600MB 파일은 크기만으로 차단하지 않습니다.');
  if(typeof Worker==='undefined')throw Error('현재 Windows WebView2 환경이 대용량 PSD 작업 스레드를 지원하지 않습니다.');
  notify('PSD 읽기 준비 · '+Math.round(file.size/1024/1024)+'MiB…');
  let raw;
  try{raw=await file.arrayBuffer();}
  catch(e){throw Error('파일 내용을 메모리에 읽지 못했습니다. 다른 프로그램을 종료해 RAM을 확보한 뒤 다시 시도해 주세요. '+(e?.message||''));}
  return await new Promise((resolve,reject)=>{
    let settled=false;
    const worker=new Worker(new URL('./psd.worker.js',import.meta.url),{type:'module'});
    const done=(error,result)=>{
      if(settled)return;settled=true;
      worker.terminate();
      if(error)reject(error);else resolve(result);
    };
    worker.onmessage=e=>{
      const msg=e.data;
      if(msg?.type==='progress'){notify(msg.message);return;}
      if(msg?.type==='complete')done(null,msg.result);
      if(msg?.type==='failed')done(new Error(msg.message||'PSD 해석에 실패했습니다.'));
    };
    worker.onerror=e=>{e.preventDefault();done(new Error('PSD 작업 스레드 실행 오류: '+(e.message||'알 수 없는 오류')));};
    worker.onmessageerror=()=>done(new Error('큰 PSD 레이어를 메모리에서 전송할 수 없습니다. 다른 프로그램을 종료하고 다시 시도해 주세요.'));
    try{worker.postMessage({type:'open-psd',buffer:raw},[raw]);}
    catch(e){done(new Error('PSD 데이터를 작업 스레드로 전달하지 못했습니다: '+(e?.message||e)));}
  });
}
async function importPsd(file){
  const start=performance.now();
  notify('PSD 파일 해석 중…');
  showImportReport('', 'normal');
  // Worker parses the PSD and transfers the layer buffers back without copying.
  const result=await readPsdInBackground(file);
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
  // Prefer Photoshop's own merged pixels over a naive layer redraw.
  // This is an exact raster reference to the stored composite, not a promise
  // that every original layer effect can be edited in this app.
  originalComposite=composite?pixelCanvas(composite):null;
  previewMode=originalComposite?'composite':'layers';
  selectedId=layers.length?layers[layers.length-1].id:null;
  refreshAll();fitZoom();
  const seconds=((performance.now()-start)/1000).toFixed(1);
  const detail='불러오기 완료: '+decodedCount+'/'+layerTotal+'개 레이어 · '+header.bits+'비트 · '+seconds+'초'+
    (skippedCount?' · 일부 레이어 제외 '+skippedCount+'개':'');
  const warningMessage=warnings.length?warnings.join(' / '):'';
  if(!originalComposite){warnings.push('포토샵 원본 합성 이미지가 없어 레이어 재구성으로만 미리보기를 제공합니다. 레이어 효과가 다르게 보일 수 있습니다.');}
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
  try{if(/\.(psd|psb)$/i.test(file.name))await importPsd(file);else if(/\.kize\.json$/i.test(file.name))await importProject(file);else await importRaster(file);}
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
  if(previewMode==='composite'&&originalComposite){
    ctx.drawImage(originalComposite,0,0);
  } else {
    for(const l of layers){if(!l.visible||!l.canvas)continue;
      ctx.save();ctx.globalAlpha=normOpacity(l.opacity);ctx.globalCompositeOperation=l.blend;
      ctx.translate(l.x+l.w/2,l.y+l.h/2);ctx.rotate(l.rotation*Math.PI/180);ctx.scale(l.flipH?-1:1,l.flipV?-1:1);
      ctx.drawImage(layerImage(l),-l.w/2,-l.h/2,l.w,l.h);ctx.restore();}
  }
  drawOverlay();
}
function setPreviewMode(mode){
  if(mode==='composite'&&!originalComposite){notify('PSD 원본 합성 미리보기가 이 파일에 없거나 해석할 수 없습니다.');return;}
  previewMode=mode;
  $('viewComposite').disabled=!originalComposite;
  $('viewComposite').classList.toggle('selected',mode==='composite');
  $('viewLayers').classList.toggle('selected',mode==='layers');
  const note=$('previewStatus');
  note.hidden=false;
  note.textContent=mode==='composite'
    ? (hasLayerEdits?'PSD 원본 미리보기 · 수정 결과는 표시되지 않음':'PSD 원본 합성 미리보기')
    : (originalComposite?'레이어 재구성 보기 · 일부 Photoshop 효과 차이 가능':'레이어 편집 보기');
  render();
}
$('viewComposite').onclick=()=>setPreviewMode('composite');
$('viewLayers').onclick=()=>setPreviewMode('layers');
function createMaskPreview(s){
  const b=s.bounds;if(!b)return null;
  const downsample=Math.min(1,1400/Math.max(b.w,b.h));
  const w=Math.max(1,Math.ceil(b.w*downsample)),h=Math.max(1,Math.ceil(b.h*downsample));
  const preview=blankCanvas(w,h);
  const pc=preview.getContext('2d');
  const image=pc.createImageData(w,h);
  for(let yy=0;yy<h;yy++){
    const sy=b.y+Math.min(b.h-1,Math.floor((yy+.5)/downsample));
    for(let xx=0;xx<w;xx++){
      const sx=b.x+Math.min(b.w-1,Math.floor((xx+.5)/downsample));
      const strength=s.mask[sy*s.w+sx];
      const p=(yy*w+xx)*4;
      image.data[p]=145;image.data[p+1]=109;image.data[p+2]=221;
      image.data[p+3]=Math.round(strength*.33);
    }
  }
  pc.putImageData(image,0,0);
  return {canvas:preview,bounds:b};
}
function drawOverlay(){
  oc.clearRect(0,0,overlay.width,overlay.height);
  for(const part of selectionParts){
    const layer=layers.find(l=>l.id===part.id);
    if(!layer?.visible||!part.bounds)continue;
    const preview=part.preview;
    if(!preview?.canvas)continue;
    oc.save();
    oc.translate(layer.x+layer.w/2,layer.y+layer.h/2);
    oc.rotate(layer.rotation*Math.PI/180);
    oc.scale(layer.flipH?-1:1,layer.flipV?-1:1);
    const b=preview.bounds,sw=layer.w/part.w,sh=layer.h/part.h;
    oc.drawImage(preview.canvas,-layer.w/2+b.x*sw,-layer.h/2+b.y*sh,b.w*sw,b.h*sh);
    oc.lineWidth=Math.max(.75,1.1/zoom);
    oc.setLineDash([4/zoom,4/zoom]);
    oc.strokeStyle='#7354AE';
    oc.strokeRect(-layer.w/2+b.x*sw,-layer.h/2+b.y*sh,b.w*sw,b.h*sh);
    oc.restore();
  }
  const l=sel();if(!l)return;
  oc.save();oc.translate(l.x+l.w/2,l.y+l.h/2);
  oc.rotate(l.rotation*Math.PI/180);
  oc.scale(l.flipH?-1:1,l.flipV?-1:1);
  oc.lineWidth=Math.max(1,1.5/zoom);
  oc.setLineDash([7/zoom,5/zoom]);oc.strokeStyle='#9476D7';
  oc.strokeRect(-l.w/2,-l.h/2,l.w,l.h);oc.restore();
}

function refreshLayers(){
  const list=$('layerList');list.replaceChildren();
  const query=($('layerSearch')?.value||'').trim().toLocaleLowerCase();
  const shown=layers.slice().reverse().filter(l=>($('showHidden').checked||l.visible)&&(!query||l.name.toLocaleLowerCase().includes(query)));
  $('layerCount').textContent=query?shown.length+' / '+layers.length:String(layers.length);
  const info=$('activeLayerInfo'),active=sel();
  info.textContent=active?'편집 중 · '+active.name:'먼저 색상을 수정할 PSD 레이어를 선택하세요.';
  info.title=active?.name||'';
  if(!shown.length){list.innerHTML='<div class="placeholder">검색 결과가 없거나 표시할 레이어가 없습니다.</div>';return;}
  const fragment=document.createDocumentFragment();
  for(const l of shown){
    const row=document.createElement('div');
    row.className='layer'+(l.id===selectedId?' active':'')+(l.visible?'':' layer-hidden');
    row.setAttribute('role','option');row.setAttribute('aria-selected',String(l.id===selectedId));
    row.tabIndex=0;row.title=l.name;
    row.onclick=()=>select(l.id);
    row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(l.id);}};
    const thumb=document.createElement('canvas');thumb.className='layer-thumb';thumb.width=40;thumb.height=40;
    const tc=thumb.getContext('2d');
    tc.fillStyle='#faf8fd';tc.fillRect(0,0,40,40);
    if(l.canvas?.width&&l.canvas?.height){
      const scale=Math.min(36/l.canvas.width,36/l.canvas.height);
      const dw=l.canvas.width*scale,dh=l.canvas.height*scale;
      tc.drawImage(l.canvas,(40-dw)/2,(40-dh)/2,dw,dh);
    }
    const nameBox=document.createElement('span');nameBox.className='layer-text';
    const parts=l.name.split(' / '),depth=parts.length-1;
    const name=document.createElement('strong');name.textContent=parts.at(-1);
    if(depth){const path=document.createElement('small');path.className='layer-path';path.textContent=parts.slice(0,-1).join(' / ');nameBox.append(path);}
    const note=document.createElement('small');note.textContent=(l.type==='text'?'텍스트':l.type==='smart-object'?'스마트 오브젝트':l.type==='composite'?'통합 미리보기':'이미지')+' · '+Math.round(l.w)+'×'+Math.round(l.h);
    nameBox.append(name,note);
    const eye=document.createElement('button');eye.type='button';eye.className='eye';eye.textContent=l.visible?'◉':'○';
    eye.setAttribute('aria-label',l.visible?'레이어 숨기기':'레이어 표시');eye.title=eye.getAttribute('aria-label');
    eye.onclick=e=>{e.stopPropagation();selectedId=l.id;checkpoint(l);l.visible=!l.visible;selection=null;selectionPreview=null;refreshAll();};
    row.append(thumb,nameBox,eye);fragment.append(row);
  }
  list.append(fragment);
}
$('layerSearch').oninput=refreshLayers;
$('selectedLayerOnly').onchange=e=>notify(e.target.checked?'선택한 PSD 레이어에서만 색상을 추출합니다.':'캔버스에서 클릭한 최상단 레이어의 색상을 추출합니다.');

function refreshProperties(){
  const l=sel();$('selectedType').textContent=l?l.type:'선택 없음';
  for(const [input,key] of [['propX','x'],['propY','y'],['propW','w'],['propH','h']])$(input).value=l?Math.round(l[key]):'';
  $('visibleLayer').checked=!!l?.visible;$('opacityLayer').value=Math.round((l?.opacity??1)*100);
  $('photoScale').value=l?.scale??100;$('photoOffsetX').value=l?.offsetX??0;$('photoOffsetY').value=l?.offsetY??0;
  $('textValue').value=l?.type==='text'?(l.textValue||''):'';
  $('fontFamily').value=l?.fontFamily||'';$('fontSize').value=l?.fontSize||32;$('textColor').value=l?.textColor||'#333333';
  for(const input of document.querySelectorAll('[data-adjust]')){const k=input.dataset.adjust;input.value=l?.adjust?.[k]||0;const id='out'+k[0].toUpperCase()+k.slice(1);if($(id))$(id).textContent=input.value;}
  $('textPanel').hidden=l?.type!=='text';
  updateSelectionUi();
}
function refreshAll(){refreshLayers();refreshProperties();setPreviewMode(previewMode);}
function select(id,keepSelections=false){selectedId=id;if(!keepSelections)clearSelections();refreshAll();}
function applyPan(){holder.style.transform='translate3d('+panX+'px,'+panY+'px,0)';}
function setZoom(v){
  zoom=clamp(v,.1,8);
  $('zoomLabel').textContent=Math.round(zoom*100)+'%';
  if(documentModel){
    holder.style.width=Math.round(documentModel.width*zoom)+'px';
    holder.style.height=Math.round(documentModel.height*zoom)+'px';
  }
}
function fitZoom(){
  if(!documentModel)return;
  const v=Math.min((stage.clientWidth-72)/documentModel.width,(stage.clientHeight-72)/documentModel.height,1);
  setZoom(clamp(v,.1,8));
  panX=panY=0;applyPan();stage.scrollLeft=0;stage.scrollTop=0;
}
function zoomAtPointer(value,cx,cy){
  if(!documentModel)return;
  const before=holder.getBoundingClientRect();
  const px=(cx-before.left)/zoom,py=(cy-before.top)/zoom;
  setZoom(value);
  const after=holder.getBoundingClientRect();
  panX+=cx-(after.left+px*zoom);
  panY+=cy-(after.top+py*zoom);
  applyPan();
}
const stageCenter=()=>{const r=stage.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];};
// Toolbar zoom starts at the visible artboard edge and retains scrollable
// top/left boundaries. Mouse-wheel zoom remains cursor-anchored.
$('zoomIn').onclick=()=>{panX=panY=0;applyPan();setZoom(zoom*1.25);};
$('zoomOut').onclick=()=>{panX=panY=0;applyPan();setZoom(zoom/1.25);};
$('zoomFit').onclick=fitZoom;
$('panReset').onclick=()=>{panX=panY=0;applyPan();stage.scrollLeft=0;stage.scrollTop=0;notify('캔버스 이동을 초기화했습니다. 휠 버튼으로 자유롭게 이동할 수 있습니다.');};
stage.addEventListener('wheel',e=>{
  if(!documentModel)return;
  e.preventDefault();
  const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?stage.clientHeight:1);
  const factor=Math.exp(-Math.max(-350,Math.min(350,delta))*.0019);
  zoomAtPointer(zoom*factor,e.clientX,e.clientY);
},{passive:false});

// Middle mouse pan changes the artboard transform directly instead of scrollLeft.
// This is essential when a page is already fit inside the viewport (no scrollbars).
// Listening on the capturing phase and on window also works across nested canvas
// elements and if a middle-button pointer travels outside the viewport.
let middlePan=null,spacePan=false;
function isTextInput(el){return !!el?.closest?.('input,textarea,select,[contenteditable]');}
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!isTextInput(e.target)){spacePan=true;stage.classList.add('hand-ready');e.preventDefault();}});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spacePan=false;stage.classList.remove('hand-ready');}});
window.addEventListener('blur',()=>{spacePan=false;stage.classList.remove('hand-ready');endMiddlePan();});
function beginMiddlePan(e){
  if(!documentModel)return;
  const middle=e.button===1 || (e.pointerType==='mouse'&&(e.buttons&4)!==0);
  const space=spacePan&&e.button===0;
  if(!middle&&!space)return;
  e.preventDefault();e.stopPropagation();
  middlePan={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,panX,panY};
  stage.classList.add('panning');
  try{stage.setPointerCapture(e.pointerId);}catch{}
}
stage.addEventListener('pointerdown',beginMiddlePan,true);
window.addEventListener('pointermove',e=>{
  if(!middlePan||e.pointerId!==middlePan.pointerId)return;
  e.preventDefault();
  panX=middlePan.panX+(e.clientX-middlePan.startX)*1.35;
  panY=middlePan.panY+(e.clientY-middlePan.startY)*1.35;
  applyPan();
},true);
function endMiddlePan(e){
  if(!middlePan||(e&&e.pointerId!==middlePan.pointerId))return;
  const id=middlePan.pointerId;middlePan=null;stage.classList.remove('panning');
  try{if(stage.hasPointerCapture(id))stage.releasePointerCapture(id);}catch{}
}
window.addEventListener('pointerup',endMiddlePan,true);
window.addEventListener('pointercancel',endMiddlePan,true);
stage.addEventListener('lostpointercapture',endMiddlePan);
stage.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();},true);
stage.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();},true);
function localPoint(e){
  const r=overlay.getBoundingClientRect();
  return {x:(e.clientX-r.left)*overlay.width/r.width,y:(e.clientY-r.top)*overlay.height/r.height};
}
function pixelInLayer(l,x,y){
  if(!l||!l.canvas||!l.visible)return null;
  const cx=l.x+l.w/2,cy=l.y+l.h/2;
  const theta=l.rotation*Math.PI/180;
  const ax=x-cx,ay=y-cy;
  let lx=ax*Math.cos(theta)+ay*Math.sin(theta);
  let ly=-ax*Math.sin(theta)+ay*Math.cos(theta);
  if(l.flipH)lx=-lx;if(l.flipV)ly=-ly;
  const u=(lx+l.w/2)/l.w,v=(ly+l.h/2)/l.h;
  if(u<0||u>=1||v<0||v>=1)return null;
  return {x:Math.floor(u*l.canvas.width),y:Math.floor(v*l.canvas.height)};
}
function hit(l,x,y){
  const pt=pixelInLayer(l,x,y);
  if(!pt)return false;
  return l.canvas.getContext('2d',{willReadFrequently:true}).getImageData(pt.x,pt.y,1,1).data[3]>7;
}
function regionAt(l,px,py,mode){
  const visual=layerImage(l),image=toImageData(visual);
  const options={tolerance:Number($('colorTolerance').value),connected:$('connectedOnly').checked};
  const result=mode==='asset'
    ?selectAssetRegion(image.data,visual.width,visual.height,px,py,options)
    :colorSelection(image.data,visual.width,visual.height,px,py,options);
  return {...result,mode,id:l.id,w:visual.width,h:visual.height};
}
function reapplyMaskAmount(part){
  const amount=Number($('maskAdjust').value)||0;
  part.mask=growShrinkMask(part.baseMask,part.w,part.h,amount);
  const stats=maskBounds(part.mask,part.w,part.h);
  part.count=stats.count;part.bounds=stats.bounds;
  part.preview=part.bounds?createMaskPreview(part):null;
}
function pickLayerColor(l,px,py,additive=false){
  const mode=$('selectionMode').value;
  const region=regionAt(l,px,py,mode);
  if(!region.count){
    if(!additive)clearSelections();
    render();notify('이 부분에서 선택 가능한 색상 영역을 찾지 못했습니다. 다른 영역이나 색상 선택 방식을 사용해 주세요.');
    return;
  }
  region.baseMask=region.mask;
  reapplyMaskAmount(region);
  if(!additive)selectionParts=[];
  // Guard against duplicate Shift-click causing unintentionally stacked fill.
  const duplicate=selectionParts.find(p=>p.id===region.id&&p.seed?.x===region.seed?.x&&p.seed?.y===region.seed?.y);
  if(!duplicate)selectionParts.push(region);
  updateSelectionPreview();
  const hex=rgbToHex(...region.sample);
  $('pickedHex').value=hex;$('pickedSwatch').style.backgroundColor=hex;
  refreshProperties();render();
  notify('선택 '+selectionParts.length+'개 영역 · '+region.count.toLocaleString()+'px · Shift+클릭으로 추가 선택');
}
overlay.addEventListener('pointerdown',e=>{
  if(!documentModel||e.button!==0||middlePan||spacePan)return;
  const p=localPoint(e),selected=sel(),additive=e.shiftKey;
  let layer;
  if($('selectedLayerOnly').checked&&selected){
    layer=selected;
    if(!hit(layer,p.x,p.y)){
      notify('현재 선택된 레이어에 이 위치의 색상이 없습니다. 필요하면 레이어 고정을 해제해 주세요.');
      return;
    }
  } else {
    layer=layers.slice().reverse().find(l=>hit(l,p.x,p.y));
    if(!layer){notify('이 위치에서 선택 가능한 레이어를 찾지 못했습니다.');return;}
  }
  // Alt-drag moves the selected layer; Shift-click is reserved for multi-select.
  if(e.altKey){
    if(layer.id!==selectedId)select(layer.id);
    checkpoint(layer);
    drag={id:layer.id,originX:layer.x,originY:layer.y,start:p};
    overlay.setPointerCapture(e.pointerId);
    return;
  }
  if(layer.id!==selectedId)select(layer.id,additive);
  const pixel=pixelInLayer(layer,p.x,p.y);
  if(!pixel)return;
  if(previewMode==='composite')setPreviewMode('layers');
  pickLayerColor(layer,pixel.x,pixel.y,additive);
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
function repickCurrentColor(){
  if(!selectionParts.length)return;
  const rebuilt=[];
  for(const part of selectionParts){
    const l=layers.find(x=>x.id===part.id);
    if(!l||!part.seed)continue;
    const fresh=regionAt(l,part.seed.x,part.seed.y,part.mode);
    if(!fresh.count)continue;
    fresh.baseMask=fresh.mask;
    reapplyMaskAmount(fresh);
    rebuilt.push(fresh);
  }
  selectionParts=rebuilt;updateSelectionPreview();refreshProperties();render();
}
$('colorTolerance').onchange=repickCurrentColor;
$('connectedOnly').onchange=repickCurrentColor;
$('selectionMode').onchange=()=>{
  clearSelections();refreshProperties();render();
  notify($('selectionMode').value==='asset'
    ?'에셋 단위 선택: 연결된 요소의 그림자와 색상을 함께 조정할 수 있습니다.':'유사 색상 선택: 선택한 색상 계열만 변경합니다.');
};
$('clearSelection').onclick=()=>{clearSelections();refreshProperties();render();notify('선택한 영역을 해제했습니다.');};
$('maskAdjust').oninput=e=>$('maskAdjustOut').textContent=(Number(e.target.value)>0?'+':'')+e.target.value+'px';
$('maskAdjust').onchange=()=>{
  for(const part of selectionParts)reapplyMaskAmount(part);
  updateSelectionPreview();refreshProperties();render();
};
$('showHidden').onchange=refreshLayers;
// Multi-stop linear gradient editor. Stops, their percentages and angle are
// regular user-editable properties; no opaque "AI-picked" placeholder colors.
function refreshGradientUi(){
  $('solidControls').hidden=$('colorMode').value!=='solid';
  $('gradientControls').hidden=$('colorMode').value!=='gradient';
  const parent=$('gradientStops');parent.replaceChildren();
  const sorted=gradientStops.slice().sort((a,b)=>a.position-b.position);
  for(const stop of sorted){
    const row=document.createElement('div');row.className='gradient-stop';
    const color=document.createElement('input');color.type='color';color.value=stop.color;
    color.setAttribute('aria-label','색상점 '+stop.position+'% 색상');
    color.oninput=e=>{stop.color=e.target.value;updateGradientPreview();};
    const pos=document.createElement('input');pos.type='number';pos.min=0;pos.max=100;pos.step=1;
    pos.value=stop.position;pos.setAttribute('aria-label','색상점 위치 퍼센트');
    pos.onchange=e=>{stop.position=clamp(Number(e.target.value),0,100);refreshGradientUi();};
    const percent=document.createElement('span');percent.textContent='%';percent.className='gradient-percent';
    const remove=document.createElement('button');remove.type='button';remove.className='stop-remove';
    remove.textContent='×';remove.title='색상점 제거';remove.disabled=gradientStops.length<=2;
    remove.onclick=()=>{gradientStops=gradientStops.filter(x=>x.id!==stop.id);refreshGradientUi();};
    row.append(color,pos,percent,remove);parent.append(row);
  }
  $('addGradientStop').disabled=gradientStops.length>=6;
  updateGradientPreview();
}
function updateGradientPreview(){
  const sorted=gradientStops.slice().sort((a,b)=>a.position-b.position);
  const cssAngle=180-Number($('gradientAngle').value);
  $('gradientPreview').style.background='linear-gradient('+cssAngle+'deg, '+
    sorted.map(s=>s.color+' '+s.position+'%').join(', ')+')';
  $('angleLabel').textContent=$('gradientAngle').value+'°';
}
$('colorMode').onchange=refreshGradientUi;
$('gradientAngle').oninput=updateGradientPreview;
$('addGradientStop').onclick=()=>{
  if(gradientStops.length>=6)return;
  const a=gradientStops.slice().sort((x,y)=>x.position-y.position);
  let maxGap=-1,left=a[0],right=a[1];
  for(let i=1;i<a.length;i++){
    const gap=a[i].position-a[i-1].position;
    if(gap>maxGap){maxGap=gap;left=a[i-1];right=a[i];}
  }
  const position=Math.round((left.position+right.position)/2);
  gradientStops.push({id:nextStopId++,color:'#FFF3CE',position});
  refreshGradientUi();
};
refreshGradientUi();
$('applyColor').onclick=()=>{
  const l=sel();
  if(!l||!selection||selection.id!==l.id){notify('먼저 왼쪽에서 레이어를 선택하고 원하는 색상 픽셀을 클릭해 주세요.');return;}
  const mode=$('colorMode').value;
  let result;
  try {
    const base=layerImage(l),px=toImageData(base);
    result=paintSelection(px.data,px.width,px.height,selection,{
      mode,color:$('targetColor').value,
      stops:gradientStops.map(s=>({color:s.color,position:s.position})),
      angle:Number($('gradientAngle').value),
      preserveShading:$('preserveShading').checked,
    });
    if(!result.count){notify('적용할 색상 픽셀이 없습니다.');return;}
    checkpoint(l);
    px.data.set(result.data);
    l.canvas=pixelCanvas(px);
    if(l.photoSource){l.photoSource=null;l.adjust=defaultAdjust();l.type='image';}
    selection=null;selectionPreview=null;
    refreshAll();
    notify(result.count.toLocaleString()+'개 픽셀에 '+(mode==='gradient'?'그라데이션':'단색')+
      ' 적용 · 「'+l.name+'」 레이어만 변경했습니다.');
  } catch(error){notify('색상 변경 실패: '+(error?.message||error));console.error(error);}
};
$('undo').onclick=()=>{
  const last=history.pop();if(!last){notify('되돌릴 작업이 없습니다.');return;}
  const l=layers.find(x=>x.id===last.id);if(!l)return;
  Object.assign(l,last);selection=null;selectionPreview=null;refreshAll();notify('마지막 편집을 되돌렸습니다.');
};
for(const [id,key] of [['propX','x'],['propY','y'],['propW','w'],['propH','h']]){
  $(id).onchange=e=>{const l=sel();if(!l)return;checkpoint(l);const v=Number(e.target.value);if(Number.isFinite(v)){l[key]=key==='w'||key==='h'?clamp(Math.round(v),1,20000):Math.round(v);}refreshAll();syncGuides();};
}
$('opacityLayer').oninput=e=>{const l=sel();if(l){if(previewMode==='composite')setPreviewMode('layers');hasLayerEdits=true;l.opacity=Number(e.target.value)/100;render();}};
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
  hasLayerEdits=true;setPreviewMode('layers');selection=null;refreshAll();notify('사진을 기존 레이어 영역에 맞춰 교체했습니다. 내부 이동/크기와 톤을 조정할 수 있습니다.');
}
$('replaceFile').onchange=async e=>{const f=e.target.files?.[0];e.target.value='';if(f)try{await replaceImage(f);}catch(err){notify('사진 교체 실패: '+err.message);}};
for(const input of document.querySelectorAll('[data-adjust]'))input.oninput=e=>{
  const l=sel();if(!l)return;
  if(!l.photoSource){l.photoSource=cloneCanvas(l.canvas);}
  if(previewMode==='composite')setPreviewMode('layers');hasLayerEdits=true;
  const k=e.target.dataset.adjust;l.adjust[k]=Number(e.target.value);const out=$('out'+k[0].toUpperCase()+k.slice(1));if(out)out.textContent=e.target.value;render();
};
$('resetAdjust').onclick=()=>{const l=sel();if(!l)return;checkpoint(l);l.adjust=defaultAdjust();refreshAll();};
for(const [id,key] of [['photoScale','scale'],['photoOffsetX','offsetX'],['photoOffsetY','offsetY']])$(id).onchange=e=>{const l=sel();if(!l||!l.photoSource)return;checkpoint(l);l[key]=id==='photoScale'?clamp(Number(e.target.value),10,500):Math.round(Number(e.target.value));render();};
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
  if(hasLayerEdits&&previewMode==='composite'){
    setPreviewMode('layers');
    notify('PSD 원본 보기에는 수정 내용이 표시되지 않습니다. 레이어 편집 모습으로 전환했습니다. 확인 후 다시 PNG 저장을 눌러 주세요.');
    return;
  }
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
