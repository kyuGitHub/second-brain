// 업로드 비밀번호 보관: Mac 은 키체인, 그 밖은 .env
// 키체인 항목 이름: second-brain-upload (계정 = 로그인 이메일)
import { execFileSync } from 'node:child_process';

const SERVICE = 'second-brain-upload';
export const hasKeychain = process.platform === 'darwin';

export function keychainGet(email) {
  if (!hasKeychain || !email) return null;
  try { return execFileSync('security', ['find-generic-password', '-s', SERVICE, '-a', email, '-w'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().replace(/\n$/, '') || null; }
  catch { return null; }
}

// 비밀번호가 명령줄(ps)에 보이지 않게 security 의 대화형 입력(-i)으로 넣는다
export function keychainSet(email, password) {
  if (!hasKeychain) return false;
  const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  try {
    execFileSync('security', ['-i'], { input: `add-generic-password -U -s ${q(SERVICE)} -a ${q(email)} -w ${q(password)}\n`, stdio: ['pipe', 'ignore', 'ignore'] });
    return keychainGet(email) === password; // 다시 읽어 확인
  } catch { return false; }
}
