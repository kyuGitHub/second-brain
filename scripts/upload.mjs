// vault 폴더의 노트로 그래프를 만들어 Supabase 비공개 저장소에 올린다.
// 웹사이트는 Supabase 에 추가된 계정으로 로그인한 사용자에게만 이 데이터를 보여준다.
// 실행: npm run upload   (보통은 deploy.bat / deploy.command 가 대신 실행)
//
// Supabase 주소·공개 키는 .env.production 에 들어 있어요.
// (선택) .env 파일에 SB_EMAIL / SB_PASSWORD 를 적어 두면 묻지 않아요. 없으면 실행할 때 물어봐요.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { build } from './build-graph.mjs';
import { diffGraphs, isEmpty } from './history.mjs';
import { hasKeychain, keychainGet, keychainSet } from './secret.mjs';

const FORCE = process.argv.includes('--force'); // 바뀐 게 없어도 올리기

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'second-brain';
const fail = (msg) => { console.error('✖ ' + msg); process.exit(1); };

// .env 읽기 (KEY=VALUE 형식)
const env = { ...process.env };
for (const f of ['.env', '.env.local', '.env.production']) { // 앞의 파일이 우선
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && m[2] !== '') env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) fail('.env.production 에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 가 없어요.');

const ask = (q, hidden = false) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); else if (s !== '\r\n' && s !== '\n') process.stdout.write('*'); };
  rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
});

// Mac: .env 에 비밀번호가 남아 있으면 키체인으로 옮기고 .env 에서 지운다 (한 번만, 자동)
const envFile = path.join(ROOT, '.env');
if (hasKeychain && env.SB_EMAIL && fs.existsSync(envFile) && /^SB_PASSWORD=.+/m.test(fs.readFileSync(envFile, 'utf8')) && !process.env.SB_PASSWORD) {
  if (keychainSet(env.SB_EMAIL, env.SB_PASSWORD)) {
    const rest = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => !/^SB_PASSWORD=/.test(l)).join('\n');
    fs.writeFileSync(envFile, rest, { mode: 0o600 });
    console.log('  · 비밀번호를 .env 에서 Mac 키체인(second-brain-upload)으로 옮겼어요.');
  } else console.log('  ! 키체인에 저장하지 못해서 .env 의 비밀번호를 그대로 써요.');
}
const keyPw = !env.SB_PASSWORD && env.SB_EMAIL ? keychainGet(env.SB_EMAIL) : null;
// 자동 실행(사람이 없는 창)에서는 물어볼 수 없으니 저장된 값이 꼭 있어야 한다
if ((!env.SB_EMAIL || !(env.SB_PASSWORD || keyPw)) && !process.stdin.isTTY) fail('저장된 로그인 정보(.env 의 SB_EMAIL, 비밀번호는 .env 또는 Mac 키체인)가 없어서 자동으로 올릴 수 없어요.');
const email = env.SB_EMAIL || await ask('세컨브레인 계정 이메일: ');
const password = env.SB_PASSWORD || keyPw || await ask('비밀번호: ', true);

// 1) 그래프 만들기
const graph = build();
const notesDir = path.join(ROOT, 'public', 'data', 'notes');
// 본문은 파일 이름 첫 글자(0~f)로 16묶음으로 나눠 올린다 → 글을 처음 열 때 받는 양이 1/16
const chunks = {};
for (const n of graph.nodes) {
  if (!n.file) continue;
  const p = path.join(notesDir, n.file);
  if (!fs.existsSync(p)) continue;
  (chunks[n.file[0]] ??= {})[n.file] = JSON.parse(fs.readFileSync(p, 'utf8')).html;
}

// 가입 허용이 켜져 있으면 아무나 가입해서 볼 수 있으므로 매번 확인해 경고한다
try {
  const st = await (await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })).json();
  if (st && st.disable_signup === false) console.log('  ⚠⚠ Supabase 의 "새 사용자 가입 허용"이 켜져 있어요! 아무나 가입해서 노트를 볼 수 있어요. Authentication 설정에서 꺼 주세요.');
} catch { /* 확인 실패는 업로드를 막지 않음 */ }

// 2) 로그인
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: loginErr } = await sb.auth.signInWithPassword({ email, password });
if (loginErr) {
  if (/fetch failed|network/i.test(loginErr.message)) fail('Supabase 에 연결할 수 없어요. .env 의 VITE_SUPABASE_URL 과 인터넷 연결을 확인해 주세요.');
  fail(loginErr.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 맞지 않아요.' : loginErr.message);
}

// 3) 이전 업로드와 비교해서 변경 이력 만들기
const getJson = async (name) => {
  const { data, error } = await sb.storage.from(BUCKET).download(name);
  if (error) return null; // 처음 올리는 경우
  try { return JSON.parse(await data.text()); } catch { return null; }
};
const prev = await getJson('graph.json');
const prevHasFp = !!prev?.nodes?.some((n) => n.fp);
const entry = diffGraphs(prev, graph);
let history = (await getJson('history.json')) || [];
if (!Array.isArray(history)) history = [];
const formatChanged = (prev?.meta?.format || 1) !== (graph.meta.format || 1); // 프로그램이 바뀌어 데이터 형식이 달라졌으면 한 번 올린다
if (prev && prevHasFp && isEmpty(entry) && !FORCE && !formatChanged) {
  console.log('✔ 바뀐 노트가 없어서 올리지 않았어요. (그래도 올리려면 npm run upload -- --force)');
  await sb.auth.signOut();
  process.exit(0);
}
if (!prev || !prevHasFp) {
  // 비교할 이전 기록이 없거나 옛 형식이면 '기준선'만 남긴다 (다음 업로드부터 변경이 기록됨)
  history.unshift({ at: entry.at, baseline: true, total: entry.total, added: [], removed: [], changed: [] });
  console.log(`  · 변경 이력 기준선을 만들었어요 (문서 ${entry.total}개). 다음 업로드부터 변경이 기록돼요.`);
} else if (isEmpty(entry)) {
  console.log('  · 노트 변경은 없고 데이터 형식만 바뀌어서 올려요 (변경 이력에는 남기지 않아요).');
} else {
  history.unshift(entry);
  console.log(`  · 변경: 추가 ${entry.added.length} · 변경 ${entry.changed.length} · 삭제 ${entry.removed.length}`);
}
history = history.slice(0, 300);

// 4) 올리기
const put = async (name, obj, { gzip = false } = {}) => {
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
  // 압축본(.gz)은 받는 양이 약 1/4 — 웹사이트·AI 함수가 먼저 찾고, 없으면 원본을 받아요
  const body = gzip ? new Blob([zlib.gzipSync(text, { level: 9 })], { type: 'application/gzip' }) : new Blob([text], { type: 'application/json' });
  const { error } = await sb.storage.from(BUCKET).upload(name, body, { upsert: true, contentType: gzip ? 'application/gzip' : 'application/json', cacheControl: '0' });
  if (error) {
    const msg = String(error.message || error);
    if (/row-level security|unauthorized|403/i.test(msg)) fail(`업로드 권한이 없어요. Supabase 의 brain_members 에 ${email} 을(를) can_upload = true 로 추가해 주세요.`);
    if (/bucket not found/i.test(msg)) fail('저장소(second-brain)가 없어요. supabase/schema.sql 을 Supabase SQL Editor 에서 실행해 주세요.');
    fail(`${name} 업로드 실패: ${msg}`);
  }
  const mb = (body.size / 1024 / 1024).toFixed(2);
  console.log(`  ↑ ${name} (${mb} MB)`);
};
// 본문 묶음은 내용이 바뀐 것만 올린다 (지문을 graph.meta.chunkHash 에 남겨 다음 업로드와 비교)
const chunkText = Object.fromEntries(Object.entries(chunks).map(([k, obj]) => [k, JSON.stringify(obj)]));
graph.meta.chunkHash = Object.fromEntries(Object.entries(chunkText).map(([k, t]) => [k, crypto.createHash('sha1').update(t).digest('hex').slice(0, 12)]));
const prevHash = prev?.meta?.chunkHash || {};
const changedChunks = Object.keys(chunkText).filter((k) => FORCE || prevHash[k] !== graph.meta.chunkHash[k]);
// 본문 묶음을 먼저 올리고 그래프를 마지막에 → 중간에 끊겨도 그래프가 없는 본문을 가리키지 않음
for (const k of changedChunks) await put(`notes/${k}.json`, chunkText[k]);
console.log(`  · 본문 묶음 ${changedChunks.length}/${Object.keys(chunkText).length}개 올림 (나머지는 바뀐 게 없어요)`);
const searchFile = path.join(ROOT, 'public', 'data', 'search.json');
if (fs.existsSync(searchFile)) {
  const st = fs.readFileSync(searchFile, 'utf8'); // 본문 검색용
  await put('search.json.gz', st, { gzip: true });
  await put('search.json', st); // 원본도 둔다 (예전 화면·brain-read 함수용)
}
await put('history.json', history);
const graphText = JSON.stringify(graph);
await put('graph.json.gz', graphText, { gzip: true });
await put('graph.json', graphText);
// 예전 한 덩어리 파일과, 이번에 노트가 하나도 없는 묶음(지운·숨긴 노트가 남아 있을 수 있음)을 정리
const stale = ['notes.json', ...'0123456789abcdef'.split('').filter((k) => !chunks[k]).map((k) => `notes/${k}.json`)];
await sb.storage.from(BUCKET).remove(stale);
await sb.auth.signOut();
console.log(`✔ 업로드 완료: 노트 ${graph.meta.noteCount}개. 웹사이트를 새로 고치면 바로 보여요.`);
