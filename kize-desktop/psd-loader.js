import { readPsd, getLayerImageData, getCompositeImageData } from 'ag-psd';
import {inspectPhotoshopLayer,summarizePsdCompatibility} from './psd-compatibility.mjs';

// PSD parsing is isolated from the interface, so real PSD fixtures can be tested
// without a desktop window. No uploads or network access are required.
export const PSD_LIMITS = Object.freeze({
  fileBytes: 700 * 1024 * 1024,
  documentPixels: 40_000_000,
  layerPixels: 40_000_000,
  decodedPixels: 160_000_000,
  layerCount: 500,
  canvasEdge: 16_000,
});
const supportedModes = new Set([0, 1, 2, 3, 4]); // bitmap, gray, indexed, RGB, CMYK

function bytes(buffer) {
  return buffer instanceof ArrayBuffer ? buffer :
    buffer?.buffer?.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
export function inspectPsdHeader(buffer) {
  const ab = bytes(buffer);
  if (!ab || ab.byteLength < 26) throw Error('PSD 데이터가 너무 짧습니다.');
  const v = new DataView(ab);
  if (v.getUint32(0) !== 0x38425053) throw Error('Photoshop PSD/PSB 파일이 아닙니다 (8BPS 헤더 없음).');
  const version = v.getUint16(4);
  if (version !== 1 && version !== 2) throw Error('지원하지 않는 Photoshop 파일 버전: ' + version);
  const width = v.getUint32(18), height = v.getUint32(14);
  const bits = v.getUint16(22), colorMode = v.getUint16(24);
  if (!width || !height || width > PSD_LIMITS.canvasEdge || height > PSD_LIMITS.canvasEdge ||
      width * height > PSD_LIMITS.documentPixels)
    throw Error('캔버스가 너무 큽니다. 가로·세로 최대 16,000px, 전체 4,000만 픽셀까지 지원합니다.');
  if (![1, 8, 16, 32].includes(bits))
    throw Error('지원하지 않는 색 깊이: ' + bits + '비트');
  if (!supportedModes.has(colorMode))
    throw Error('현재 색상 모드는 지원하지 않습니다 (모드 ' + colorMode + '). Photoshop에서 RGB로 변환해 저장해 주세요.');
  return { version, width, height, bits, colorMode };
}
function enumerate(children, prefix='', ancestorHidden=false, output=[],groups=[],parentKey='root') {
  for(let index=0;index<(children||[]).length;index++){
    const layer=children[index];
    const name=layer.name||'이름 없는 레이어';
    const fullName=prefix?prefix+' / '+name:name;
    if(Array.isArray(layer.children)){
      const group={name,key:parentKey+'/'+index,blendMode:layer.blendMode||'pass through',
        masked:Boolean(layer.mask||layer.vectorMask),
        effects:Boolean(layer.effects)};
      enumerate(layer.children,fullName,ancestorHidden||!!layer.hidden,output,[...groups,group],group.key);
    } else {
      output.push({layer,name:fullName,hidden:ancestorHidden||!!layer.hidden,
        compatibility:inspectPhotoshopLayer(layer,groups)});
    }
  }
  return output;
}
export function fileSizeAllowed(byteLength) {
  return Number.isFinite(byteLength) && byteLength >= 0 && byteLength <= PSD_LIMITS.fileBytes;
}
export function importPsdPixels(buffer, options={}) {
  const ab = bytes(buffer);
  if (!fileSizeAllowed(ab.byteLength))
    throw Error('PSD 파일이 700MiB 제한을 초과했습니다. 600MB PSD 파일은 크기만으로 차단하지 않습니다.');
  const header = inspectPsdHeader(ab);
  const progress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  progress('PSD 레이어 구조 분석 중…');
  let psd;
  try {
    // The upstream library recommends parsing raw channel data and decoding one
    // bitmap at a time, after checking bounds. Skips embedded linked assets.
    psd = readPsd(ab, {
      useRawData: true,
      useRawThumbnail: true,
      skipLinkedFilesData: true,
      imageResourcesWhitelist: [],
      totalMemoryLimit: 1024 * 1024 * 1024,
    });
  } catch (e) {
    throw Error('PSD 구조를 읽지 못했습니다: ' + (e?.message || String(e)));
  }
  const sourceLayers = enumerate(psd.children);
  const warnings=[],decoded=[],failed=[];
  // Large compressed documents can expand many times in memory. Limit decoded
  // RGBA channel bytes separately from the 700MiB compressed file allowance.
  const bytesPerChannel=header.bits<=8?1:header.bits===16?2:4;
  const decodedByteBudget=ab.byteLength>=350*1024*1024?320*1024*1024:640*1024*1024;
  let decodedBytes=0,decodedPixels=0, skippedCount=0;
  const cap=Math.min(sourceLayers.length, PSD_LIMITS.layerCount);
  for(let i=0;i<cap;i++){
    const {layer,name,hidden,compatibility}=sourceLayers[i];
    const x=Number(layer.left??0),y=Number(layer.top??0);
    const w=Math.max(0,Math.round(Number(layer.right??0)-x)),h=Math.max(0,Math.round(Number(layer.bottom??0)-y));
    if(w===0||h===0){skippedCount++;continue;}
    if(w>PSD_LIMITS.canvasEdge||h>PSD_LIMITS.canvasEdge||w*h>PSD_LIMITS.layerPixels||
      decodedPixels+w*h>PSD_LIMITS.decodedPixels||
      decodedBytes+w*h*4*bytesPerChannel>decodedByteBudget){
      skippedCount++;failed.push(name+' (레이어 크기/메모리 제한)');continue;
    }
    let bitmap;
    try{
      bitmap=getLayerImageData(layer);
      if(!bitmap?.data || !bitmap.width || !bitmap.height) {
        skippedCount++;failed.push(name+' (렌더링 가능한 픽셀 없음)');
        continue;
      }
      if(bitmap.width*bitmap.height*4!==bitmap.data.length)
        throw Error('픽셀 데이터 길이가 일치하지 않음');
    }catch(e){
      skippedCount++;failed.push(name+' ('+(e?.message||'디코딩 실패')+')');
      continue;
    }
    decodedPixels+=bitmap.width*bitmap.height;
    decodedBytes+=bitmap.width*bitmap.height*4*bytesPerChannel;
    decoded.push({
      name,x,y,w,h,hidden,bitmap,opacity:layer.opacity,
      blendMode:layer.blendMode||'normal',
      type:layer.text?'text':(layer.placedLayer?'smart-object':'image'),
      psdText:layer.text||null,
      compatibility,
    });
    if(i%12===0)progress('PSD 레이어 해석 '+(i+1)+'/'+cap);
  }
  if(sourceLayers.length>cap){skippedCount+=sourceLayers.length-cap;warnings.push('레이어가 많아 '+cap+'개까지만 처리했습니다.');}
  if(ab.byteLength>=350*1024*1024){warnings.push('대용량 모드: 파일 크기는 허용하지만 PC 메모리 상황에 따라 일부 레이어를 제외할 수 있습니다.');}
  if(failed.length){warnings.push('해석하지 못한 레이어 '+failed.length+'개. 예: '+failed.slice(0,2).join(' · '));}
  // Photoshop stores a flattened (Maximize Compatibility) composite which
  // preserves layer styles, text rasterization, masks and adjustment layers.
  // Always decode it when affordable: redrawing layers with Canvas alone is
  // NOT pixel-identical to Photoshop and must not be the default preview.
  let composite=null;
  try {
    const pxCount=header.width*header.height;
    const compositeBytes=pxCount*4*bytesPerChannel;
    if(pxCount<=PSD_LIMITS.documentPixels && compositeBytes<=512*1024*1024){
      const candidate=getCompositeImageData(psd);
      if(candidate?.data?.length===candidate.width*candidate.height*4)
        composite=candidate;
    } else {
      warnings.push('메모리 보호를 위해 PSD 원본 합성 미리보기를 생략했습니다.');
    }
  }catch(e){
    warnings.push('PSD 원본 합성 미리보기를 읽지 못했습니다: '+(e?.message||e));
  }
  if(!decoded.length && !composite){
    throw Error('레이어 픽셀과 통합 미리보기를 모두 읽을 수 없습니다. '+(failed[0]||'PSD 저장 방식이 현재 엔진과 호환되지 않습니다.'));
  }
  if(!decoded.length && composite)
    warnings.push('레이어를 개별 해석하지 못해 통합 이미지로 열었습니다. 이 경우 레이어별 편집은 제한됩니다.');
  const compatibilityReport=summarizePsdCompatibility(decoded,{
    compositeAvailable:Boolean(composite),skippedCount,
  });
  // Report covers every decoded layer; missing/skipped ones are counted
  // separately so incomplete documents are never misrepresented as exact.
  return {header,layers:decoded,composite,layerTotal:sourceLayers.length,
    decodedCount:decoded.length,skippedCount,warnings,compatibilityReport};
}
