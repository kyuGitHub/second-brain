import { defineConfig } from 'vite';

// 배포 환경에 빈 값(VITE_...=)이 있으면 .env.production 의 값을 덮어써 버리므로 지운다
for (const k of Object.keys(process.env)) if (k.startsWith('VITE_') && !process.env[k]) delete process.env[k];

// base: './' 로 두면 결과물(dist)을 어느 주소에 올려도 동작한다.
// publicDir: 그래프 데이터(public/data)는 내 PC 개발 실행에서만 쓴다.
//            웹 배포본(dist)에는 노트 데이터가 들어가지 않고, 로그인 후 Supabase 비공개 저장소에서 받는다.
export default defineConfig(({ command }) => ({
  base: './',
  publicDir: command === 'serve' ? 'public' : false,
  server: { port: 5173, watch: { ignored: ['**/public/data/**', '**/vault/**'] } },
  build: { chunkSizeWarningLimit: 2000 },
}));
