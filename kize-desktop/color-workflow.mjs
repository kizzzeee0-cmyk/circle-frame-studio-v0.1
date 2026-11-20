// All color editing uses one explicit policy for the on-canvas Apply action
// and batch PNG variants. Default = the exact HEX chosen by the designer.
// Pastel conversion is opt-in, visible and numerically adjustable.
import {hexToRGB,rgbToHex,clamp} from './engine.js';
export const FINISHES=Object.freeze(['exact','pastel','shaded','palette']);
export function pastelizeHex(hex,softness=40){
  const source=hexToRGB(hex);
  if(!source)throw Error('HEX 색상은 #RRGGBB 형식으로 입력해 주세요.');
  const t=clamp(Number(softness),0,90)/100;
  return rgbToHex(...source.map(v=>Math.round(v+(255-v)*t)));
}
export function effectiveColor(hex,finish='exact',softness=40){
  if(!FINISHES.includes(finish))throw Error('지원하지 않는 색상 변경 방식입니다.');
  if(!hexToRGB(hex))throw Error('HEX 색상은 #RRGGBB 형식으로 입력해 주세요.');
  return finish==='pastel'?pastelizeHex(hex,softness):hex.toUpperCase();
}
export function paintPolicy(settings,partMode='color'){
  const finish=FINISHES.includes(settings.finish)?settings.finish:'exact';
  const tintAsset=partMode==='asset'&&settings.tintAsset!==false;
  const color=effectiveColor(settings.color||'#9389DE',finish,settings.softness??40);
  const gradient=String(settings.mode)==='gradient';
  const stops=Array.isArray(settings.stops)?settings.stops.map(s=>({
    ...s,color:finish==='pastel'?pastelizeHex(s.color,settings.softness??40):s.color,
  })):[];
  return {
    mode:gradient?'gradient':'solid',color,stops,angle:settings.angle??90,
    tintAsset,
    protectWhite:settings.protectWhite!==false,
    preserveShading:finish==='shaded'||finish==='palette'
      ?settings.preserveShading!==false:false,
    smartPalette:finish==='palette'&&tintAsset,
  };
}
export function defaultImportSelection(kind){
  // A single PNG often joins motifs, borders and icons in ONE alpha component.
  // Never use that full component as the first click's selection.
  return kind==='IMAGE'?'color':'color';
}
