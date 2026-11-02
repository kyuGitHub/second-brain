import { defineConfig } from 'vite';

// base: './' 로 두면 결과물(dist)을 어느 주소에 올려도 동작한다.
// publicDir: 그래프 데이터(public/data)는 내 PC 개발 실행에서만 쓴다.
//            웹 배포본(dist)에는 노트 데이터가 들어가지 않고, 로그인 후 Supabase 비공개 저장소에서 받는다.
export default defineConfig(({ command }) => ({
  base: './',
  publicDir: command === 'serve' ? 'public' : false,
  server: { port: 5173, watch: { ignored: ['**/public/data/**', '**/vault/**'] } },
  build: { chunkSizeWarningLimit: 2000 },
}));
