// 개발용 실행: 그래프를 만들고 사이트를 띄운 뒤, 옵시디언에서 노트가 바뀌면 자동으로 다시 만든다.
// 실행: npm run dev
import fs from 'node:fs';
import { createServer } from 'vite';
import { build, loadConfig } from './build-graph.mjs';

// npm run dev:live → 저장소의 vault 대신 원본 볼트(config.json 의 sourcePath)를 바로 읽고 감시한다
if (process.argv.includes('--source')) process.env.SB_USE_SOURCE = '1';

const cfg = loadConfig();
try { build(); } catch (e) { console.error('✖ ' + e.message); process.exit(1); }

const server = await createServer({ server: { open: true } });
await server.listen();
server.printUrls();

// 옵시디언 싱크가 파일을 여러 번 나눠 쓰므로 잠깐 기다렸다가 한 번만 다시 만든다.
let timer = null;
const rebuild = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      build();
      server.ws.send({ type: 'full-reload' });
    } catch (e) { console.error('✖ ' + e.message); }
  }, 800);
};

try {
  fs.watch(cfg.vaultAbs, { recursive: true }, (event, file) => {
    if (!file) return;
    const f = String(file).replace(/\\/g, '/');
    if (f.startsWith('.obsidian') || f.includes('/.') || f.startsWith('.trash')) return;
    rebuild();
  });
  console.log(`👀 볼트 변경 감시 중: ${cfg.vaultAbs}`);
} catch (e) {
  console.warn('! 자동 감시를 켤 수 없어요. 노트를 고친 뒤 npm run graph 로 다시 만들어 주세요.', e.message);
}
