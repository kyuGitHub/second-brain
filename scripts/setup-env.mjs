// 자동 업로드에 필요한 로그인 정보를 .env 에 저장한다 (Windows·Mac 공용, 비밀번호는 화면에 안 보임)
// 실행: node scripts/setup-env.mjs   (install-autoupdate.bat / .command 가 대신 실행)
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, '.env');
const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
const has = (k) => lines.some((l) => new RegExp(`^${k}=.+`).test(l));
if (has('SB_EMAIL') && has('SB_PASSWORD') && !process.argv.includes('--reset')) {
  console.log('✔ .env 에 로그인 정보가 이미 있어요. (바꾸려면 node scripts/setup-env.mjs --reset)');
  process.exit(0);
}
const ask = (q, hidden = false) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); else if (s !== '\r\n' && s !== '\n') process.stdout.write('*'); };
  rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
});
const email = await ask('세컨브레인 계정 이메일: ');
const password = await ask('비밀번호 (화면에 안 보여요): ', true);
if (!email || !password) { console.error('✖ 이메일과 비밀번호를 모두 입력해 주세요.'); process.exit(1); }
const keep = lines.filter((l) => l && !/^SB_(EMAIL|PASSWORD)=/.test(l));
fs.writeFileSync(file, [...keep, `SB_EMAIL=${email}`, `SB_PASSWORD=${password}`, ''].join('\n'), { mode: 0o600 });
try { fs.chmodSync(file, 0o600); } catch { /* Windows 는 무시 */ }
console.log('✔ .env 에 저장했어요. 이 파일은 GitHub 에 올라가지 않아요.');
