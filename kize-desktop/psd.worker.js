// Dedicated worker: large PSD parsing never blocks pointer, zoom, or the main UI.
// The original input ArrayBuffer and decoded bitmap buffers are transferred,
// not cloned, between the UI and this worker.
import { initializeCanvas } from 'ag-psd';
import {importPsdPixels} from './psd-loader.js';

// Unlike a browser window, a dedicated Web Worker has no document canvas.
// ag-psd's on-demand layer decode calls must be initialized explicitly here.
// PSD thumbnails stay raw so no Image/createCanvasFromData callback is needed.
const canvasReady=typeof OffscreenCanvas==='function' &&
  !!new OffscreenCanvas(1,1).getContext('2d');
if(canvasReady) {
  initializeCanvas((width,height)=>new OffscreenCanvas(width,height));
}
self.onmessage = e => {
  if (e.data?.type !== 'open-psd') return;
  try {
    if(!canvasReady)throw Error('PSD 미리보기에 필요한 OffscreenCanvas 2D 기능을 사용할 수 없습니다. Windows WebView2 런타임을 업데이트해 주세요.');
    const result=importPsdPixels(e.data.buffer,{
      onProgress:message=>self.postMessage({type:'progress',message}),
      useCompositeIfIncomplete:false,
    });
    const transfer=new Set();
    for(const l of result.layers) {
      if(l.bitmap?.data?.buffer)transfer.add(l.bitmap.data.buffer);
      for(const mask of l.maskSpecs||[])if(mask.pixels?.buffer)transfer.add(mask.pixels.buffer);
    }
    for(const group of result.groupMasks||[])
      for(const spec of group.maskSpecs||[])
        if(spec.pixels?.buffer)transfer.add(spec.pixels.buffer);
    if(result.composite?.data?.buffer)transfer.add(result.composite.data.buffer);
    self.postMessage({type:'complete',result},[...transfer]);
  } catch(error) {
    self.postMessage({type:'failed',message:error?.message||String(error)});
  }
};
