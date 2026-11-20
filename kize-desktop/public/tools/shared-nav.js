/* KIZE shared offline shell. All tools are bundled in the same desktop
   app origin. Navigation never opens external sites or an iframe. */
(()=>{
  const root=document.createElement('nav');
  root.id='kize-unified-nav';
  root.setAttribute('aria-label','KIZE 통합 디자인 도구');
  const path=location.pathname;
  const active=path.includes('/pattern/')?'pattern':path.endsWith('circle.html')?'circle':'editor';
  const items=[
    ['editor','색상·에셋 편집','/index.html'],
    ['pattern','큐트 패턴','/tools/pattern/index.html'],
    ['circle','원형 프레임','/circle.html']
  ];
  const brand=document.createElement('span');brand.className='kize-nav-brand';brand.textContent='KIZE STUDIO';
  root.append(brand);
  const tabs=document.createElement('div');tabs.className='kize-nav-tabs';
  for(const [key,label,url] of items){
    const a=document.createElement('a');a.href=url;a.textContent=label;
    a.dataset.tool=key;
    if(active===key){a.className='current';a.setAttribute('aria-current','page');}
    tabs.append(a);
  }
  root.append(tabs);
  const share=document.createElement('div');share.className='kize-nav-share';
  const label=document.createElement('span');label.textContent='내 팔레트';
  const select=document.createElement('select');select.id='kize-shared-palette';
  select.setAttribute('aria-label','저장한 공유 팔레트 선택');
  const use=document.createElement('button');use.type='button';use.textContent='현재 도구에 적용';
  const refresh=()=>{
    select.replaceChildren();
    let array=[];
    try{
      const parsed=JSON.parse(localStorage.getItem('kize-shared-palettes-v1')||'[]');
      if(Array.isArray(parsed))array=parsed;
    }catch{}
    const choose=document.createElement('option');choose.value='';choose.textContent=array.length?'저장한 팔레트 선택':'저장된 팔레트 없음';select.append(choose);
    for(const p of array){
      if(!Array.isArray(p.colors)||p.colors.length<2)continue;
      const option=document.createElement('option');option.value=JSON.stringify(p.colors.slice(0,6));
      option.textContent=p.name||'이름 없는 팔레트';select.append(option);
    }
  };
  refresh();
  use.addEventListener('click',()=>{
    if(!select.value){select.focus();return;}
    try{
      const colors=JSON.parse(select.value);
      if(!colors.every(c=>/^#[A-Fa-f0-9]{6}$/.test(c)))return;
      window.dispatchEvent(new CustomEvent('kize:shared-palette-apply',{detail:{colors,source:'shared-library'}}));
      status.textContent='색상 '+colors.length+'개를 현재 도구에 전달했어요.';
    }catch(e){status.textContent='팔레트 형식 오류';}
  });
  share.append(label,select,use);root.append(share);
  const status=document.createElement('span');status.id='kize-shared-notice';status.setAttribute('role','status');
  root.append(status);
  window.addEventListener('storage',e=>{if(e.key==='kize-shared-palettes-v1')refresh();});
  window.addEventListener('kize:palette-saved',refresh);
  document.body.prepend(root);
})();


/* Actual lossless PNG handoff between locally bundled design tools.
   IndexedDB preserves the Blob byte-for-byte and never sends it to a server. */
(()=>{
  const DATABASE='kize-shared-workspace-v1',STORE='assets',MAX=100*1024*1024;
  const open=()=>new Promise((resolve,reject)=>{
    if(!window.indexedDB)return reject(Error('이 환경은 로컬 작업물 공유 저장소를 지원하지 않습니다.'));
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{const db=request.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error('작업물 공유 저장소를 열 수 없습니다.'));
  });
  const operation=async(mode,cb)=>{
    const db=await open();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,mode);
        const store=tx.objectStore(STORE);
        const req=cb(store);
        let value;
        req.onsuccess=()=>{value=req.result;};
        req.onerror=()=>reject(req.error||Error('작업물 처리 실패'));
        tx.oncomplete=()=>resolve(value);
        tx.onerror=()=>reject(tx.error||Error('작업물 저장 실패'));
        tx.onabort=()=>reject(tx.error||Error('작업물 저장 중단'));
      });
    }finally{db.close();}
  };
  window.KIZEBridge={
    async putAsset(blob,name='KIZE-shared.png'){
      if(!(blob instanceof Blob)||blob.size<1||blob.size>MAX)
        throw Error('공유 PNG가 비어 있거나 100MB 파일 제한을 초과했습니다.');
      if(blob.type!=='image/png')throw Error('도구 사이에는 고품질 PNG만 전달합니다.');
      const safe=String(name).replace(/[\\/:*?"<>|]/g,'-').slice(0,120);
      await operation('readwrite',s=>s.put({blob,name:safe,savedAt:Date.now()},'handoff'));
      return true;
    },
    async getAsset(){
      const entry=await operation('readonly',s=>s.get('handoff'));
      if(!entry)return null;
      if(Date.now()-Number(entry.savedAt)>24*60*60*1000)return null;
      return entry;
    },
    async clearAsset(){await operation('readwrite',s=>s.delete('handoff'));},
    openTool(id){
      const targets={editor:'/index.html',pattern:'/tools/pattern/index.html',circle:'/circle.html'};
      if(targets[id])location.assign(targets[id]+'?handoff=1');
    }
  };
})();
