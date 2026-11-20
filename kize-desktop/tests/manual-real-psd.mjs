// Manual ONLY: actual 600MB+ PSD / PSB memory and fidelity profile.
// No test fixture is fabricated to claim large Photoshop-file compatibility.
// Usage (Windows): node --max-old-space-size=4096 tests/manual-real-psd.mjs "C:\\design\\actual.psd" "C:\\design\\reference.png"
import {readFile,stat} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {initializeCanvas} from 'ag-psd';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {inspectPsdHeader,importPsdPixels} from '../psd-loader.js';

initializeCanvas(createCanvas);
const input=process.argv[2],referenceFile=process.argv[3];
if(!input)throw Error('실제 600MB 이상 PSD 경로를 첫 번째 인자로 입력해 주세요. 검사용 가짜 PSD는 사용하지 않습니다.');
const file=await stat(input);
if(file.size<600_000_000)
  throw Error('검증 파일이 600MB보다 작습니다: '+file.size+' bytes. 600MB 실물 검증으로 인정할 수 없습니다.');
const before=process.memoryUsage();
let maxRss=before.rss,maxExternal=before.external;
const sample=setInterval(()=>{
  const m=process.memoryUsage();
  maxRss=Math.max(maxRss,m.rss);
  maxExternal=Math.max(maxExternal,m.external);
},100);
const start=performance.now();
let report;
try{
  const raw=await readFile(input);
  const header=inspectPsdHeader(raw);
  const result=importPsdPixels(raw,{onProgress:message=>console.log('[PSD]',message)});
  report={
    fileBytes:file.size,
    document:header,
    sourceLayerCount:result.layerTotal,decodedLayerCount:result.decodedCount,
    skippedLayerCount:result.skippedCount,warnings:result.warnings,
    compositeAvailable:Boolean(result.composite),
    elapsedSeconds:Number(((performance.now()-start)/1000).toFixed(2)),
    maxRssMiB:Math.round(maxRss/1024/1024),
    maxExternalMiB:Math.round(maxExternal/1024/1024),
    actualRssMiB:Math.round(process.memoryUsage().rss/1024/1024)
  };
  if(referenceFile){
    if(!result.composite)throw Error('PSD 저장 합성 픽셀이 없어 Photoshop PNG와 비교할 수 없습니다.');
    const image=await loadImage(await readFile(referenceFile));
    if(image.width!==header.width||image.height!==header.height)
      throw Error('참고 PNG 크기가 PSD 캔버스와 다릅니다.');
    const canvas=createCanvas(image.width,image.height),ctx=canvas.getContext('2d');
    ctx.drawImage(image,0,0);
    const reference=ctx.getImageData(0,0,image.width,image.height).data;
    const actual=result.composite.data;
    if(reference.length!==actual.length)throw Error('참고 PNG와 PSD 합성 데이터 길이가 다릅니다.');
    let checked=0,different=0,alphaDifferent=0,maxDelta=0;
    // Sample at regular 64px intervals to avoid another full-size heatmap.
    for(let y=0;y<image.height;y+=64)for(let x=0;x<image.width;x+=64){
      checked++;
      const i=(y*image.width+x)*4;
      const d=Math.max(...[0,1,2,3].map(k=>Math.abs(reference[i+k]-actual[i+k])));
      maxDelta=Math.max(maxDelta,d);
      if(d>1)different++;
      if(Math.abs(reference[i+3]-actual[i+3])>1)alphaDifferent++;
    }
    report.referencePngSample={checked,different,alphaDifferent,maxDelta};
  }
}finally{clearInterval(sample);}
console.log(JSON.stringify(report,null,2));
if(report.skippedLayerCount>0||!report.compositeAvailable)
  throw Error('실제 PSD 테스트는 완료되었으나 생략 레이어 또는 원본 합성 누락이 있어 완전 호환 판정 실패.');
