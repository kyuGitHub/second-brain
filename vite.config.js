import { defineConfig } from 'vite';

// base: './' 로 두면 만든 결과물(dist)을 어느 주소에 올려도 동작한다.
export default defineConfig({
  base: './',
  server: { port: 5173, watch: { ignored: ['**/public/data/**'] } },
  build: { chunkSizeWarningLimit: 2000 },
});
