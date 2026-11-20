// Sampled Photoshop composite-vs-reconstruction quality measurement.
// Both arrays must be the same size. Transparent pixels are compared by alpha,
// visible color is compared in premultiplied space to avoid flagging invisible
// RGB values under fully transparent pixels as false image damage.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function compareRgba(reference,candidate,width,height,{threshold=10}={}){
  if(!reference||!candidate||reference.length!==width*height*4||
     candidate.length!==width*height*4||width<1||height<1)
    throw Error('PSD 품질 검사 픽셀 길이가 올바르지 않습니다.');
  const n=width*height,heatmap=new Uint8ClampedArray(n*4);
  let mismatched=0,alphaMismatch=0,maxDiff=0,sumDiff=0,severe=0;
  for(let i=0;i<n;i++){
    const at=i*4,ar=reference[at+3]/255,ac=candidate[at+3]/255;
    const alphaDelta=Math.abs(reference[at+3]-candidate[at+3]);
    let d=alphaDelta;
    // RGB colors under full transparency are not visible.
    for(let c=0;c<3;c++){
      const delta=Math.abs(reference[at+c]*ar-candidate[at+c]*ac);
      d=Math.max(d,delta);
      sumDiff+=delta;
    }
    sumDiff+=alphaDelta;
    maxDiff=Math.max(maxDiff,d);
    if(alphaDelta>threshold)alphaMismatch++;
    if(d>threshold){
      mismatched++;if(d>64)severe++;
      // Heatmap red encodes deviation magnitude; underlying original is not
      // modified. Opaque markers make small thin strokes easier to inspect.
      heatmap[at]=255;
      heatmap[at+1]=Math.round(190*(1-d/255));
      heatmap[at+2]=Math.round(25*(1-d/255));
      heatmap[at+3]=clamp(Math.round(100+d*.5),115,240);
    }
  }
  return {
    sampleWidth:width,sampleHeight:height,samplePixels:n,
    mismatched,matchPercent:Math.round(10000*(1-mismatched/n))/100,
    changedPercent:Math.round(10000*mismatched/n)/100,
    alphaMismatch,severe,maxDiff:Math.round(maxDiff),
    meanChannelError:Math.round((sumDiff/(n*4))*100)/100,
    threshold,heatmap,
    verdict:mismatched===0?'identical':mismatched/n<=.005?'minor':'different',
  };
}
// Excludes the pixel buffers from the JSON diagnostic report.
export function publicFidelityReport(quality,info){
  const {heatmap,...metrics}=quality;
  return {
    schema:'kize-psd-fidelity-1',
    sourceName:String(info?.name||''),
    canvas:{width:info?.width||0,height:info?.height||0},
    comparison:'Photoshop stored merged appearance vs KIZE approximate layer reconstruction',
    ...metrics,
    warning:'This is a downscaled visual comparison. Not a pixel-perfect proof for the full-resolution PSD.',
    compatibility:info?.compatibility||null,
    layers:(info?.layers||[]).map(l=>({
      name:l.name,type:l.type,
      visible:l.visible,opacity:l.opacity,
      compatibility:l.compatibility||null
    })),
  };
}
