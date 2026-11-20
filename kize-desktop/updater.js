// Signed updates are only initialized in builds that contain a configured
// updater public key, HTTPS endpoint and corresponding Rust plugin feature.
// Never let an optional updater prevent the editing workspace from opening.
import {check} from '@tauri-apps/plugin-updater';
import {relaunch} from '@tauri-apps/plugin-process';
const installedInTauri=()=>Boolean(window.__TAURI_INTERNALS__);
const signedUpdatesEnabled=import.meta.env.VITE_KIZE_SIGNED_UPDATES === 'true';
export function initUpdates(label,button){
  let busy=false;
  if(!signedUpdatesEnabled) {
    label.textContent='자동 업데이트 연결 준비 중';
    button.disabled=true;
    button.title='현재 버전은 서명된 업데이트가 아직 활성화되지 않았습니다.';
    return;
  }
  async function run(manual=false){
    if(busy)return;
    if(!installedInTauri()){label.textContent='웹 미리보기 · 앱 업데이트 비활성';return;}
    busy=true;button.disabled=true;
    try{
      label.textContent='업데이트 확인 중…';
      const update=await check();
      if(!update){label.textContent='최신 버전';return;}
      label.textContent='v'+update.version+' 업데이트 가능';
      // Windows may exit automatically during installation, so ask BEFORE starting.
      if(!confirm('KIZE DESIGN TOOL v'+update.version+' 업데이트가 있습니다. 편집 중인 프로젝트를 저장한 뒤 계속하시겠습니까?')) {
        label.textContent='업데이트 보류';
        return;
      }
      label.textContent='v'+update.version+' 다운로드 및 설치 중…';
      await update.downloadAndInstall(event=>{
        if(event.event==='Finished')label.textContent='설치가 완료되었습니다.';
      });
      if(confirm('업데이트 설치가 끝났습니다. 프로그램을 다시 실행할까요?'))await relaunch();
    }catch(e){
      const err=String(e?.message||e);
      console.warn('KIZE updater',err);
      label.textContent='업데이트 확인에 실패했습니다';
      if(manual)alert('업데이트 확인 실패: '+err);
    }finally{busy=false;button.disabled=false;}
  }
  button.addEventListener('click',()=>run(true));
  setTimeout(()=>run(false),4000);
  setInterval(()=>{if(!document.hidden)run(false);},6*60*60*1000);
}
