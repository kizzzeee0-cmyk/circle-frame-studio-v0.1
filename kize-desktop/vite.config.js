import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base:'./',
  esbuild:{jsx:'automatic'},
  server:{port:1420,strictPort:true},
  build:{
    rollupOptions:{input:{
      editor:resolve(process.cwd(),'index.html'),
      circle:resolve(process.cwd(),'circle.html')
    }},
    chunkSizeWarningLimit:2600
  }
});
