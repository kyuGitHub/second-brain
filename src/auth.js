// 로그인 관문. 어드민 제너레이터와 같은 방식:
//  - Supabase 이메일/비밀번호 로그인
//  - 계정은 Supabase 대시보드에서 초대 메일로 발급 → 초대 링크를 열면 비밀번호 설정 화면
//  - 비밀번호 재설정 메일 링크도 같은 화면으로 이어짐
import { supabase, isConfigured } from './supabase.js';
import { LOCAL } from './data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let overlay = null;
function show(html) {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'auth-root';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="auth-card">${html}</div>`;
  overlay.hidden = false;
  return overlay;
}
function hide() { if (overlay) overlay.hidden = true; }

function loginForm() {
  const el = show(`
    <div class="auth-eyebrow">KNOWLEDGE GRAPH</div>
    <h1>세컨브레인 로그인</h1>
    <form id="auth-form" novalidate>
      <label for="auth-email">이메일</label>
      <input id="auth-email" type="email" autocomplete="username" required />
      <label for="auth-pw">비밀번호</label>
      <input id="auth-pw" type="password" autocomplete="current-password" required />
      <p class="auth-error" id="auth-error" role="alert"></p>
      <button type="submit" id="auth-submit">로그인</button>
      <p class="auth-hint">계정은 관리자가 초대 메일로 발급합니다. 초대 메일의 링크를 열면 비밀번호 설정 화면으로 이어집니다.</p>
    </form>`);
  const form = el.querySelector('#auth-form');
  el.querySelector('#auth-email').focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = el.querySelector('#auth-submit');
    const err = el.querySelector('#auth-error');
    const email = el.querySelector('#auth-email').value.trim();
    const password = el.querySelector('#auth-pw').value;
    if (!email || !password) { err.textContent = '이메일과 비밀번호를 입력해 주세요.'; return; }
    btn.disabled = true; btn.textContent = '확인 중…'; err.textContent = '';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    btn.disabled = false; btn.textContent = '로그인';
    if (error) err.textContent = error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 맞지 않습니다.' : error.message;
    // 성공하면 onAuthStateChange 가 이어서 처리한다
  };
}

function setPasswordForm(onDone) {
  const el = show(`
    <div class="auth-eyebrow">KNOWLEDGE GRAPH</div>
    <h1>비밀번호 설정</h1>
    <form id="auth-form" novalidate>
      <label for="auth-pw">새 비밀번호 (8자 이상)</label>
      <input id="auth-pw" type="password" autocomplete="new-password" required />
      <label for="auth-pw2">새 비밀번호 확인</label>
      <input id="auth-pw2" type="password" autocomplete="new-password" required />
      <p class="auth-error" id="auth-error" role="alert"></p>
      <button type="submit" id="auth-submit">저장하고 시작하기</button>
    </form>`);
  el.querySelector('#auth-pw').focus();
  el.querySelector('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = el.querySelector('#auth-error');
    const pw = el.querySelector('#auth-pw').value, pw2 = el.querySelector('#auth-pw2').value;
    if (pw.length < 8) { err.textContent = '비밀번호는 8자 이상이어야 합니다.'; return; }
    if (pw !== pw2) { err.textContent = '두 비밀번호가 다릅니다.'; return; }
    const btn = el.querySelector('#auth-submit');
    btn.disabled = true;
    const { error } = await supabase.auth.updateUser({ password: pw });
    btn.disabled = false;
    if (error) { err.textContent = error.message; return; }
    history.replaceState(null, '', location.pathname + location.search);
    onDone();
  };
}

function notConfigured() {
  show(`
    <div class="auth-eyebrow">KNOWLEDGE GRAPH</div>
    <h1>설정이 필요해요</h1>
    <p class="auth-hint" style="margin-top:0">Supabase 연결 정보(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 없어서 로그인할 수 없어요.
    배포 환경의 환경변수에 두 값을 등록한 뒤 다시 배포해 주세요.</p>`);
}

function addAccountBar(email) {
  const foot = document.getElementById('built-at');
  if (!foot || document.getElementById('account-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'account-bar';
  bar.className = 'account-bar';
  bar.innerHTML = `<span title="${esc(email)}">${esc(email)}</span><button type="button" id="logout-btn">로그아웃</button>`;
  foot.before(bar);
  bar.querySelector('#logout-btn').onclick = async () => { await supabase.auth.signOut(); location.reload(); };
}

/** 로그인이 끝나면 start() 를 한 번 부른다. 내 PC 개발 실행에서는 바로 부른다. */
export async function gate(start) {
  if (LOCAL) { start(); return; }
  if (!isConfigured) { notConfigured(); return; }

  let started = false;
  let needsPassword = /type=(invite|recovery|magiclink)/.test(location.hash);
  const go = (session) => {
    if (started) return;
    started = true;
    hide();
    addAccountBar(session.user.email);
    start();
  };
  const route = (session) => {
    if (!session) { loginForm(); return; }
    if (needsPassword) { setPasswordForm(() => { needsPassword = false; go(session); }); return; }
    go(session);
  };

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') needsPassword = true;
    if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') setTimeout(() => route(session), 0);
  });
  const { data } = await supabase.auth.getSession();
  route(data.session);
}
