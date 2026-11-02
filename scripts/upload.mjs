// vault 폴더의 노트로 그래프를 만들어 Supabase 비공개 저장소에 올린다.
// 웹사이트는 로그인한 열람 명단 사용자에게만 이 데이터를 보여준다.
// 실행: npm run upload   (보통은 deploy.bat / deploy.command 가 대신 실행)
//
// 필요한 값 (.env 파일, GitHub 에 올라가지 않음):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  ← 웹사이트와 같은 값
//   SB_EMAIL      ← 업로드 권한이 있는 내 계정 이메일
//   SB_PASSWORD   ← (선택) 비워 두면 실행할 때마다 물어봄
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { build } from './build-graph.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'second-brain';
const fail = (msg) => { console.error('✖ ' + msg); process.exit(1); };

// .env 읽기 (KEY=VALUE 형식)
const env = { ...process.env };
for (const f of ['.env', '.env.local']) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && m[2] !== '') env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) fail('.env 파일에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 적어 주세요. (.env.example 참고)');

const ask = (q, hidden = false) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); else if (s !== '\r\n' && s !== '\n') process.stdout.write('*'); };
  rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
});

const email = env.SB_EMAIL || await ask('세컨브레인 계정 이메일: ');
const password = env.SB_PASSWORD || await ask('비밀번호: ', true);

// 1) 그래프 만들기
const graph = build();
const notesDir = path.join(ROOT, 'public', 'data', 'notes');
const notes = {};
for (const n of graph.nodes) {
  if (!n.file) continue;
  const p = path.join(notesDir, n.file);
  if (fs.existsSync(p)) notes[n.file] = JSON.parse(fs.readFileSync(p, 'utf8')).html;
}

// 2) 로그인
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: loginErr } = await sb.auth.signInWithPassword({ email, password });
if (loginErr) {
  if (/fetch failed|network/i.test(loginErr.message)) fail('Supabase 에 연결할 수 없어요. .env 의 VITE_SUPABASE_URL 과 인터넷 연결을 확인해 주세요.');
  fail(loginErr.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 맞지 않아요.' : loginErr.message);
}

// 3) 올리기
const put = async (name, obj) => {
  const body = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const { error } = await sb.storage.from(BUCKET).upload(name, body, { upsert: true, contentType: 'application/json', cacheControl: '0' });
  if (error) {
    const msg = String(error.message || error);
    if (/row-level security|unauthorized|403/i.test(msg)) fail(`업로드 권한이 없어요. Supabase 의 brain_members 에 ${email} 을(를) can_upload = true 로 추가해 주세요.`);
    if (/bucket not found/i.test(msg)) fail('저장소(second-brain)가 없어요. supabase/schema.sql 을 Supabase SQL Editor 에서 실행해 주세요.');
    fail(`${name} 업로드 실패: ${msg}`);
  }
  const mb = (body.size / 1024 / 1024).toFixed(2);
  console.log(`  ↑ ${name} (${mb} MB)`);
};
await put('graph.json', graph);
await put('notes.json', notes);
await sb.auth.signOut();
console.log(`✔ 업로드 완료: 노트 ${graph.meta.noteCount}개. 웹사이트를 새로 고치면 바로 보여요.`);
