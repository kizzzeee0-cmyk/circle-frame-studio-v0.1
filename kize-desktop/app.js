const pages = ['home','pattern','circle','editor','about'];
const titles = {home:'홈',pattern:'큐트 패턴',circle:'원형 테두리',editor:'색상 편집기',about:'프로그램 정보'};
function showPage(id) {
  if (!pages.includes(id)) return;
  for (const p of pages) document.getElementById(p).hidden = p !== id;
  for (const btn of document.querySelectorAll('[data-page]')) btn.classList.toggle('active',btn.dataset.page === id);
  document.getElementById('currentPage').textContent = titles[id];
}
document.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click',()=>showPage(btn.dataset.page)));
document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click',()=>showPage(btn.dataset.open)));
showPage('home');

const $ = id => document.getElementById(id);
const canvas = $('imageCanvas'), ctx = canvas.getContext('2d', {willReadFrequently:true});
let original = null, current = null, history = [], samplePoint = null, filename = 'KIZE-edited.png';
function toRgb(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw Error('올바른 HEX 색상 코드가 필요합니다.');
  return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
}
function toHex(r,g,b) {return '#' + [r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase();}
function bindColor(inputId,hexId) {
  const input=$(inputId),hex=$(hexId);
  input.addEventListener('input',()=>hex.value=input.value.toUpperCase());
  hex.addEventListener('change',()=>{
    if (/^#[0-9a-f]{6}$/i.test(hex.value)) input.value=hex.value;
    else hex.value=input.value.toUpperCase();
  });
}
bindColor('oldColor','oldHex');bindColor('newColor','newHex');
$('threshold').addEventListener('input',e=>$('thresholdText').textContent=e.target.value+'%');
function setStatus(s) { $('editorStatus').textContent = s; }
function render() { if (!current) return; ctx.putImageData(current,0,0); }
function pushHistory() {if(!current)return; history.push(new ImageData(new Uint8ClampedArray(current.data),current.width,current.height));if(history.length>5)history.shift();}
async function loadImage(file) {
  if(!file || !/^image\/(png|jpeg|webp|bmp)$/i.test(file.type)) {setStatus('지원하지 않는 이미지입니다. PNG/JPG/WebP/BMP 파일을 선택해 주세요.');return;}
  try {
    const image = await createImageBitmap(file);
    if(image.width*image.height>24000000){image.close();setStatus('이미지가 너무 큽니다. 2,400만 픽셀 이하 이미지를 사용해 주세요.');return;}
    canvas.width=image.width;canvas.height=image.height;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);image.close();
    original=ctx.getImageData(0,0,canvas.width,canvas.height);
    current=new ImageData(new Uint8ClampedArray(original.data),original.width,original.height);
    history=[];samplePoint=null;filename=file.name.replace(/\.[^.]+$/,'')+'-KIZE.png';
    $('imageInfo').textContent=file.name+' · '+canvas.width+' × '+canvas.height+'px';
    $('canvasLabel').textContent=file.name+' · '+canvas.width+' × '+canvas.height+'px';
    $('emptyText').hidden=true;canvas.hidden=false;
    setStatus('이미지를 불러왔습니다. 캔버스를 클릭해 색상을 선택하세요.');
  } catch(e){setStatus('이미지 읽기 실패: '+e.message);}
}
$('imageInput').addEventListener('change',e=>{if(e.target.files?.[0])loadImage(e.target.files[0]);e.target.value='';});
canvas.addEventListener('pointerdown',e=>{
  if (!current) return;
  const rect=canvas.getBoundingClientRect();
  const x=Math.floor((e.clientX-rect.left)*canvas.width/rect.width);
  const y=Math.floor((e.clientY-rect.top)*canvas.height/rect.height);
  if(x<0||y<0||x>=canvas.width||y>=canvas.height)return;
  const idx=(y*canvas.width+x)*4;
  const p=current.data;
  const hex=toHex(p[idx],p[idx+1],p[idx+2]);
  $('oldColor').value=hex;$('oldHex').value=hex;
  samplePoint={x,y};
  setStatus('스포이드: '+hex+' · X '+x+' / Y '+y);
});
$('recolor').addEventListener('click',()=>{
  if(!current){setStatus('먼저 이미지를 불러와 주세요.');return;}
  try{
    const oldRgb=toRgb($('oldColor').value),newRgb=toRgb($('newColor').value);
    const threshold=Number($('threshold').value)*4.42;
    pushHistory();
    const data=current.data;
    let changed=0;
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]===0)continue;
      const dr=data[i]-oldRgb[0],dg=data[i+1]-oldRgb[1],db=data[i+2]-oldRgb[2];
      const distance=Math.sqrt(dr*dr+dg*dg+db*db);
      if(distance>threshold+0.01)continue;
      // Preserve source pixel variation and alpha without any resizing or blur.
      data[i]=Math.max(0,Math.min(255,newRgb[0]+dr));
      data[i+1]=Math.max(0,Math.min(255,newRgb[1]+dg));
      data[i+2]=Math.max(0,Math.min(255,newRgb[2]+db));
      changed++;
    }
    if(changed===0){history.pop();setStatus('변경된 픽셀이 없습니다. 기준 색상이나 허용 범위를 확인하세요.');return;}
    render();
    setStatus(changed.toLocaleString()+'개 픽셀 변경 완료 · 원본 크기 및 알파값 보존');
  }catch(e){setStatus('색상 변경 실패: '+e.message);}
});
$('undo').addEventListener('click',()=>{
  if(!history.length){setStatus('실행 취소 기록이 없습니다.');return;}
  current=history.pop();render();setStatus('이전 상태로 되돌렸습니다.');
});
$('reset').addEventListener('click',()=>{
  if(!original)return;
  pushHistory();
  current=new ImageData(new Uint8ClampedArray(original.data),original.width,original.height);
  render();setStatus('원본 이미지로 복구했습니다.');
});
$('download').addEventListener('click',()=>{
  if(!current){setStatus('저장할 이미지가 없습니다.');return;}
  canvas.toBlob(blob=>{
    if(!blob){setStatus('PNG 생성에 실패했습니다.');return;}
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);setStatus('원본 해상도로 PNG 저장 완료');
  },'image/png');
});
document.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{
  if(e.dataTransfer?.files?.length){e.preventDefault();showPage('editor');loadImage(e.dataTransfer.files[0]);}
});
