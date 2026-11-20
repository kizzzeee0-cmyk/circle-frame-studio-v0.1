// KIZE-only GitHub Release discovery. No updater signing keys, no background
// installer execution. Users open a GitHub-hosted download after opting in.
export const CURRENT_VERSION='0.13.0';
export const REPO='kizzzeee0-cmyk/circle-frame-studio-v0.1';
export const RELEASES_API='https://api.github.com/repos/'+REPO+'/releases?per_page=50';
export const RELEASES_PAGE='https://github.com/'+REPO+'/releases';
const numberVersion=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function parseVersion(raw){
  const match=numberVersion.exec(String(raw||'').trim());
  return match?match.slice(1).map(Number):null;
}
export function compareVersion(a,b){
  const x=parseVersion(a),y=parseVersion(b);
  if(!x||!y)throw Error('지원되지 않는 버전 형식입니다.');
  for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;
  return 0;
}
export function trustedAsset(release,asset){
  if(!asset||asset.state!=='uploaded'||typeof asset.name!=='string'||
      typeof asset.browser_download_url!=='string')return false;
  const version=String(release.tag_name||'').replace(/^kize-v/,'');
  const isZip=asset.name==='KIZE-DESIGN-TOOL-v'+version+'-Windows.zip';
  const isExe=new RegExp('^KIZE DESIGN TOOL_'+version.replace(/\./g,'\\.')+'_x64-setup\\.exe$').test(asset.name);
  if(!isZip&&!isExe)return false;
  try{
    const url=new URL(asset.browser_download_url);
    const base='/'+REPO+'/releases/download/'+release.tag_name+'/';
    if(url.protocol!=='https:'||url.hostname!=='github.com'||
        url.username||url.password||url.search||url.hash||
        !url.pathname.startsWith(base))return false;
    const filePart=url.pathname.slice(base.length);
    return filePart===encodeURIComponent(asset.name)||decodeURIComponent(filePart)===asset.name;
  }catch{return false;}
}
export function latestKizeRelease(releases,currentVersion=CURRENT_VERSION){
  if(!parseVersion(currentVersion)||!Array.isArray(releases))return null;
  let best=null;
  for(const release of releases){
    if(!release||release.draft||release.prerelease||typeof release.tag_name!=='string')continue;
    const match=/^kize-v(\d+\.\d+\.\d+)$/.exec(release.tag_name);
    if(!match||!parseVersion(match[1])||compareVersion(match[1],currentVersion)<=0)continue;
    const assets=(Array.isArray(release.assets)?release.assets:[]).filter(a=>trustedAsset(release,a));
    const zip=assets.find(a=>a.name.endsWith('.zip'));
    const asset=zip||assets.find(a=>a.name.endsWith('.exe'));
    if(!asset)continue; // Do not advertise an update until the installer is published.
    if(!best||compareVersion(match[1],best.version)>0){
      best={
        version:match[1],tag:release.tag_name,
        title:'KIZE DESIGN TOOL v'+match[1],
        notes:String(release.body||'새 버전의 기능과 안정성을 개선했습니다.').trim().slice(0,900),
        assetName:asset.name,downloadUrl:asset.browser_download_url,
        releaseUrl:'https://github.com/'+REPO+'/releases/tag/'+release.tag_name,
      };
    }
  }
  return best;
}
