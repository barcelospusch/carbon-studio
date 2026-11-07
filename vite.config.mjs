import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { target: 'chrome140', sourcemap: false, chunkSizeWarningLimit: 1600, rollupOptions:{input:['index.html','mermaid.html']} },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, watch:{ignored:['**/tmp/**','**/release/**','**/output/**','**/build/**']} },
});
