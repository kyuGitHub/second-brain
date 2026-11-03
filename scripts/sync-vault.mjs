// 원본 옵시디언 볼트(config.json 의 sourcePath)에서 .md 파일만 골라 저장소의 vault 폴더로 복사한다.
// 원본에서 지운 노트는 vault 에서도 지운다 (원본과 똑같이 맞춤).
// 실행: npm run sync              → config.json 의 sourcePath 사용
//       npm run sync -- "경로"     → 다른 경로를 한 번만 사용
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
if (fs.existsSync(path.join(ROOT, 'config.local.json'))) Object.assign(cfg, JSON.parse(fs.readFileSync(path.join(ROOT, 'config.local.json'), 'utf8'))); // 이 PC 전용 값
const source = path.resolve(ROOT, process.argv[2] || cfg.sourcePath || '');
const target = path.resolve(ROOT, cfg.vaultPath || './vault');
const exclude = new Set(cfg.exclude || []);

if (!cfg.sourcePath && !process.argv[2]) fail('config.json 에 sourcePath(원본 볼트 경로)를 적어 주세요.');
if (!fs.existsSync(source)) fail(`원본 볼트를 찾을 수 없어요: ${source}\nconfig.json 의 sourcePath 를 확인해 주세요.`);
if (source === target) fail('원본과 대상 폴더가 같아요.');

// 1) 원본에서 .md 파일 목록 수집
const wanted = new Map(); // 상대경로 → 원본 절대경로
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || exclude.has(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    if (abs === target || abs === ROOT) continue; // 프로젝트 폴더가 볼트 안에 있어도 건너뜀
    if (ent.isDirectory()) walk(abs);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) wanted.set(path.relative(source, abs), abs);
  }
})(source);

// 2) 복사 (내용이 바뀐 파일만)
fs.mkdirSync(target, { recursive: true });
let added = 0, updated = 0, removed = 0;
for (const [rel, abs] of wanted) {
  const dest = path.join(target, rel);
  const next = fs.readFileSync(abs);
  if (fs.existsSync(dest)) {
    if (Buffer.compare(fs.readFileSync(dest), next) === 0) continue;
    updated++;
  } else added++;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, next);
}

// 3) 원본에 없는 .md 와 빈 폴더 정리
(function prune(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      prune(abs);
      if (!fs.readdirSync(abs).length) fs.rmdirSync(abs);
    } else if (ent.name.toLowerCase().endsWith('.md') && !wanted.has(path.relative(target, abs))) {
      fs.rmSync(abs);
      removed++;
    }
  }
})(target);

console.log(`✔ 동기화 완료: .md ${wanted.size}개 (새로 ${added} · 변경 ${updated} · 삭제 ${removed})`);
console.log(`  원본: ${source}`);
console.log(`  대상: ${target}`);

function fail(msg) { console.error('✖ ' + msg); process.exit(1); }
