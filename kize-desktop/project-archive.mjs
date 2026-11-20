// KIZE editable project archive v2.
// Real PNG byte streams rather than base64 JSON drastically reduce memory and
// keep source pixels, replacement-photo sources and PSD merged reference apart.
// This is KIZE's own edit format; it is NOT a Photoshop PSD writer.
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';

export const FORMAT='KIZE-PROJECT-2';
export const ARCHIVE_LIMIT=300*1024*1024;
export const CONTENT_LIMIT=800*1024*1024;
const MAX_FILES=1100;
const safe=(v)=>typeof v==='string'&&v.length>0&&v.length<=255&&!v.includes('..')&&!v.startsWith('/')&&!v.includes('\\');
const isPng=(data)=>data instanceof Uint8Array&&data.length>=8&&
  data[0]===137&&data[1]===80&&data[2]===78&&data[3]===71&&data[4]===13&&data[5]===10&&data[6]===26&&data[7]===10;
export function validateManifest(m){
  if(!m||m.format!==FORMAT||!Number.isInteger(m.width)||!Number.isInteger(m.height)||
    m.width<1||m.height<1||m.width>16000||m.height>16000||m.width*m.height>40_000_000)
    throw Error('올바른 KIZE 프로젝트 규격이 아닙니다.');
  if(!Array.isArray(m.layers)||m.layers.length>500||m.layers.length<1)
    throw Error('지원 범위를 벗어난 레이어 개수입니다.');
  const names=new Set();
  for(const layer of m.layers){
    if(!layer||!Number.isFinite(layer.x)||!Number.isFinite(layer.y)||
      !Number.isFinite(layer.w)||!Number.isFinite(layer.h)||
      layer.w<=0||layer.h<=0||layer.w>16000||layer.h>16000||
      !safe(layer.bitmap)||names.has(layer.bitmap))
      throw Error('레이어 메타데이터가 잘못되었거나 중복되었습니다.');
    names.add(layer.bitmap);
    if(layer.photoBitmap&&!safe(layer.photoBitmap))
      throw Error('교체 사진의 파일명이 잘못되었습니다.');
    if(layer.maskFiles!==undefined){
      if(!Array.isArray(layer.maskFiles)||layer.maskFiles.length>2)
        throw Error('PSD 레이어 마스크가 잘못되었습니다.');
      for(const mask of layer.maskFiles){
        if(!safe(mask.bitmap)||!Number.isInteger(mask.w)||!Number.isInteger(mask.h)||
          !Number.isFinite(mask.x)||!Number.isFinite(mask.y)||
          mask.w<1||mask.h<1||mask.w*mask.h>40_000_000||
          ![0,255].includes(mask.defaultColor)||!Number.isFinite(mask.density))
          throw Error('PSD 레이어 마스크의 크기·좌표 또는 투명도가 잘못되었습니다.');
      }
    }
  }
  if(m.composite&&!safe(m.composite))throw Error('원본 합성 미리보기 경로가 잘못되었습니다.');
  if(m.appearancePatches!==undefined){
    if(!m.composite||!Array.isArray(m.appearancePatches)||m.appearancePatches.length>256)
      throw Error('PSD 원본 보존 편집 영역 정보가 잘못되었습니다.');
    for(const p of m.appearancePatches){
      if(!safe(p.bitmap)||!Number.isInteger(p.x)||!Number.isInteger(p.y)||
        !Number.isInteger(p.w)||!Number.isInteger(p.h)||
        p.w<=0||p.h<=0||p.x<0||p.y<0||p.x+p.w>m.width||p.y+p.h>m.height)
        throw Error('PSD 외관 보존 패치의 좌표나 크기가 유효하지 않습니다.');
    }
  }
  return m;
}
export function createArchive(manifest,images){
  validateManifest(manifest);
  const entries={'manifest.json':[strToU8(JSON.stringify(manifest)),{level:6}]};
  let size=0;
  for(const [name,bytes] of Object.entries(images)){
    if(!safe(name)||!isPng(bytes))throw Error('올바른 PNG 이미지 자산이 아닙니다: '+name);
    if(Object.hasOwn(entries,name))throw Error('중복된 이미지 경로');
    size+=bytes.byteLength;
    if(size>CONTENT_LIMIT)throw Error('프로젝트 이미지 총량이 안전 한도를 초과했습니다. 큰 PSD는 원본을 유지하고 PNG를 별도로 출력해 주세요.');
    entries[name]=[bytes,{level:0}];
  }
  for(const l of manifest.layers){
    if(!entries[l.bitmap]||(l.photoBitmap&&!entries[l.photoBitmap]))
      throw Error('프로젝트 이미지가 누락되었습니다: '+l.name);
    for(const mask of l.maskFiles||[])if(!entries[mask.bitmap])
      throw Error('PSD 레이어 마스크 파일이 누락되었습니다: '+l.name);
  }
  if(manifest.composite&&!entries[manifest.composite])throw Error('PSD 원본 미리보기가 누락되었습니다.');
  for(const patch of manifest.appearancePatches||[])if(!entries[patch.bitmap])throw Error('PSD 외관 보존 편집 이미지가 누락되었습니다.');
  return zipSync(entries,{level:0});
}
export function readArchive(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.length<22||bytes.length>ARCHIVE_LIMIT)throw Error('지원 범위를 벗어난 프로젝트 크기입니다.');
  let total=0,count=0;
  const files=unzipSync(bytes,{filter(file){
    count++;
    if(count>MAX_FILES)throw Error('프로젝트 내부 파일이 너무 많습니다.');
    if(!safe(file.name)||!(file.name==='manifest.json'||file.name.endsWith('.png')))
      throw Error('프로젝트에 잘못된 파일 경로가 포함되어 있습니다.');
    total+=Number(file.originalSize||file.size||0);
    if(total>CONTENT_LIMIT)throw Error('압축을 풀면 안전 메모리 한도를 초과합니다.');
    return true;
  }});
  if(!files['manifest.json'])throw Error('KIZE 프로젝트 정보를 찾지 못했습니다.');
  const manifest=validateManifest(JSON.parse(strFromU8(files['manifest.json'])));
  const names=[...manifest.layers.flatMap(l=>[l.bitmap,...(l.photoBitmap?[l.photoBitmap]:[]),
    ...(l.maskFiles||[]).map(mask=>mask.bitmap)]),...(manifest.composite?[manifest.composite]:[]),...(manifest.appearancePatches||[]).map(p=>p.bitmap)];
  for(const name of names)if(!isPng(files[name]))throw Error('레이어 이미지가 없거나 손상되었습니다: '+name);
  return {manifest,images:files};
}
