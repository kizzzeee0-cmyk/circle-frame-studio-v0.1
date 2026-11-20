// Signed in-app updates. This module never installs an unsigned file.
import {check} from '@tauri-apps/plugin-updater';
import {relaunch} from '@tauri-apps/plugin-process';
const installedInTauri=()=>Boolean(window.__TAURI_INTERNALS__);
export function initUpdates(label,button){
  let busy=false;
  async function run(manual=false){
    if(busy)return;
    if(!installedInTauri()){label.textContent='웹 미리보기: 앱 업데이트 비활성';return;}
    busy=true;button.disabled=true;
    try{
      label.textContent='업데이트 확인 중…';
      const update=await check();
      if(!update){label.textContent='최신 버전';return;}
      label.textContent='v'+update.version+' 업데이트 다운로드 중…';
      await update.downloadAndInstall(ev=>{
        if(ev.event==='Progress'&&ev.data?.chunkLength)label.textContent='업데이트 다운로드 중…';
        else if(ev.event==='Finished')label.textContent='새 버전 설치 준비 완료';
      });
      label.textContent='업데이트 설치 완료 · 다시 시작';
      // Protect unsaved work. Never silently restart an editing session.
      if(confirm('KIZE DESIGN TOOL 업데이트가 준비되었습니다. 저장한 뒤 지금 다시 시작할까요?'))await relaunch();
    }catch(e){
      const err=String(e?.message||e);
      console.warn('KIZE updater:',err);
      label.textContent=err.includes('pubkey')||err.includes('endpoint')||err.includes('updater')?'업데이트 서명·배포 설정 필요':'업데이트 확인 불가';
      if(manual)alert('업데이트 확인 실패: '+err);
    }finally{busy=false;button.disabled=false;}
  }
  button.addEventListener('click',()=>run(true));
  // If released without signing setup, check() fails safely rather than installing an untrusted package.
  setTimeout(()=>run(false),2500);
  setInterval(()=>{if(!document.hidden)run(false);},6*60*60*1000);
}
