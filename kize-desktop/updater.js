// Optional manual-download update notifications. Never execute an unsigned
// installer or silently mutate documents. All installer links are validated
// against this repository's KIZE-only release assets.
import {openUrl} from '@tauri-apps/plugin-opener';
import {CURRENT_VERSION,RELEASES_API,latestKizeRelease} from './release-feed.mjs';

const inDesktop=()=>Boolean(window.__TAURI_INTERNALS__);
const seenKey=version=>'kize-release-seen:'+version;
function previouslyViewed(version){
  try{return localStorage.getItem(seenKey(version))==='1';}catch{return false;}
}
function recordViewed(version){
  try{localStorage.setItem(seenKey(version),'1');}catch{}
}
export function initUpdates(label,button,{hasUnsavedChanges=()=>false}={}){
  const badge=document.getElementById('updateBadge');
  const panel=document.getElementById('updateDetails');
  const title=document.getElementById('updateTitle');
  const notes=document.getElementById('updateNotes');
  const download=document.getElementById('downloadUpdate');
  const close=document.getElementById('dismissUpdate');
  const warning=document.getElementById('updateSaveWarning');
  let busy=false,latest=null;
  const showUpdate=()=>{
    const exists=Boolean(latest);
    badge.hidden=!exists||previouslyViewed(latest.version);
    if(!exists)panel.hidden=true;
    label.textContent=exists?'새 버전 v'+latest.version:'최신 버전 v'+CURRENT_VERSION;
    button.textContent=exists?'업데이트 보기':'업데이트 확인';
    button.title=exists?'새 버전 설치 파일 확인':'GitHub에서 KIZE 새 버전 확인';
  };
  async function checkUpdates({manual=false}={}){
    if(busy)return;
    busy=true;
    button.disabled=true;
    if(manual)label.textContent='업데이트 확인 중…';
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(RELEASES_API,{
        method:'GET',headers:{'Accept':'application/vnd.github+json'},
        cache:'no-store',signal:controller.signal
      });
      if(!response.ok)throw Error('GitHub 응답 '+response.status);
      const releases=await response.json();
      if(!Array.isArray(releases))throw Error('업데이트 목록 형식 오류');
      latest=latestKizeRelease(releases,CURRENT_VERSION);
      showUpdate();
    }catch(error){
      // If offline, do not present a stale cached version as "latest".
      label.textContent='업데이트 확인 불가';
      button.title='인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
      button.textContent='다시 확인';
      if(manual)console.warn('KIZE update check:',error);
    }finally{
      clearTimeout(timeout);busy=false;button.disabled=false;
    }
  }
  function toggleDetails(){
    if(!latest)return;
    const opening=panel.hidden;
    panel.hidden=!opening;
    if(opening){
      recordViewed(latest.version);
      badge.hidden=true;
      title.textContent=latest.title+' 업데이트';
      notes.textContent=latest.notes;
      warning.textContent=hasUnsavedChanges()
        ?'저장하지 않은 작업이 있어요. 설치 전 프로젝트를 저장해 주세요.'
        :'설치 전 열린 작업을 저장하고 프로그램을 종료해 주세요.';
      download.textContent=latest.assetName.endsWith('.zip')?'설치 ZIP 다운로드':'설치 파일 다운로드';
    }
  }
  button.addEventListener('click',()=>latest?toggleDetails():checkUpdates({manual:true}));
  badge.addEventListener('click',()=>{if(latest&&panel.hidden)toggleDetails();});
  close.addEventListener('click',()=>{panel.hidden=true;});
  download.addEventListener('click',async()=>{
    if(!latest)return;
    // Manual download only. A browser gives the user a normal ZIP / EXE
    // download; KIZE does not run or replace any installed program.
    warning.textContent=hasUnsavedChanges()
      ?'다운로드 후 설치하기 전에 현재 프로젝트를 반드시 저장해 주세요.'
      :'다운로드 후 설치 전에 프로그램을 종료해 주세요.';
    try{
      if(inDesktop())await openUrl(latest.downloadUrl);
      else window.open(latest.downloadUrl,'_blank','noopener,noreferrer');
      download.textContent='다운로드 페이지 열림';
    }catch(error){
      warning.textContent='다운로드를 열지 못했습니다. 브라우저 또는 네트워크를 확인해 주세요.';
      console.warn('KIZE download open:',error);
    }
  });
  label.textContent='새 버전 확인 중…';
  button.title='새 버전 설치 파일 확인';
  // Nonblocking, launch-time discovery; repeated checks do not interrupt work.
  void checkUpdates();
  setInterval(()=>{if(!document.hidden)void checkUpdates();},6*60*60*1000);
}
