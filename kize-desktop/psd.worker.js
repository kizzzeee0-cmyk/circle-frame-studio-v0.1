// Dedicated worker: large PSD parsing never blocks pointer, zoom, or the main UI.
// The original input ArrayBuffer and decoded bitmap buffers are transferred,
// not cloned, between the UI and this worker.
import {importPsdPixels} from './psd-loader.js';
self.onmessage = e => {
  if (e.data?.type !== 'open-psd') return;
  try {
    const result=importPsdPixels(e.data.buffer,{
      onProgress:message=>self.postMessage({type:'progress',message}),
      useCompositeIfIncomplete:false,
    });
    const transfer=new Set();
    for(const l of result.layers) {
      if(l.bitmap?.data?.buffer)transfer.add(l.bitmap.data.buffer);
    }
    if(result.composite?.data?.buffer)transfer.add(result.composite.data.buffer);
    self.postMessage({type:'complete',result},[...transfer]);
  } catch(error) {
    self.postMessage({type:'failed',message:error?.message||String(error)});
  }
};
