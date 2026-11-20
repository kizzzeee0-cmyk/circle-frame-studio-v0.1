import test from 'node:test';
import assert from 'node:assert/strict';
import {CURRENT_VERSION,parseVersion,compareVersion,latestKizeRelease,trustedAsset} from '../release-feed.mjs';
const repo='kizzzeee0-cmyk/circle-frame-studio-v0.1';
function release(version,options={}){
  const tag='kize-v'+version;
  const name='KIZE-DESIGN-TOOL-v'+version+'-Windows.zip';
  const asset={state:'uploaded',name,browser_download_url:
    'https://github.com/'+repo+'/releases/download/'+tag+'/'+name};
  return {tag_name:tag,draft:false,prerelease:false,body:'변경사항',assets:[asset],...options};
}
test('versions are numerically ordered, never lexically',()=>{
  assert.deepEqual(parseVersion('0.11.0'),[0,11,0]);
  assert.equal(compareVersion('0.12.0','0.9.10'),1);
  assert.equal(compareVersion('1.0.0','1.0.0'),0);
  assert.equal(compareVersion('0.8.9','0.11.0'),-1);
  assert.equal(parseVersion('0.12.0-beta.1'),null);
  assert.throws(()=>compareVersion('v0.12','0.11.0'),/버전/);
});
test('KIZE-only safe releases: an EXE or ZIP must exist before displaying new update',()=>{
  const a=release('0.12.0');
  const b=release('0.13.0',{assets:[]});
  const other={...release('9.99.9'),tag_name:'circle-v9.99.9'};
  const x=latestKizeRelease([a,b,other],CURRENT_VERSION);
  assert.equal(x.version,'0.12.0');
  assert.equal(x.title,'KIZE DESIGN TOOL v0.12.0');
  assert.equal(x.assetName,'KIZE-DESIGN-TOOL-v0.12.0-Windows.zip');
  assert.equal(latestKizeRelease([release('0.11.0'),release('0.10.0')]),null);
  assert.equal(latestKizeRelease([release('0.99.0',{draft:true})]),null);
  assert.equal(latestKizeRelease([release('0.99.0',{prerelease:true})]),null);
});
test('a hostile GitHub Release cannot redirect KIZE to untrusted downloads',()=>{
  const r=release('0.12.0');
  for(const href of [
    'https://attacker.example/drive.exe',
    'http://github.com/'+repo+'/releases/download/kize-v0.12.0/'+r.assets[0].name,
    'https://github.com/'+repo+'/releases/download/circle-v9/'+r.assets[0].name,
    'https://github.com/'+repo+'/releases/download/kize-v0.12.0/'+r.assets[0].name+'?foo=bar',
    'https://github.com/'+repo+'/releases/download/kize-v0.12.0/unrelated.exe'
  ]){
    assert.equal(trustedAsset(r,{...r.assets[0],browser_download_url:href}),false,href);
  }
  assert.equal(trustedAsset(r,{...r.assets[0],name:'evil.exe'}),false);
  assert.equal(trustedAsset(r,{...r.assets[0],state:'new'}),false);
});
test('choose highest valid semantic version and prefer ZIP over EXE',()=>{
  const r=release('0.12.0');
  const exe='KIZE DESIGN TOOL_0.12.0_x64-setup.exe';
  const exeAsset={state:'uploaded',name:exe,browser_download_url:
    'https://github.com/'+repo+'/releases/download/kize-v0.12.0/'+encodeURIComponent(exe)};
  const top=latestKizeRelease([{...r,assets:[exeAsset,...r.assets]},release('0.11.1')]);
  assert.equal(top.assetName,r.assets[0].name);
  assert.equal(latestKizeRelease([{...r,assets:[exeAsset]}]).assetName,exe);
});
