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
