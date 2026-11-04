// 사용 현황 기록·조회 (supabase/schema.sql 의 "3. 사용 현황" 을 실행했을 때만 동작)
// 기록은 조용히 보내고, 표가 없거나 실패하면 이 탭에서는 더 보내지 않는다.
import { supabase } from './supabase.js';
import { LOCAL } from './data.js';

let off = LOCAL || !supabase;
const sent = new Map(); // 같은 문서를 짧은 시간에 여러 번 열어도 한 번만
const GAP = 10 * 60 * 1000;

export function logEvent(kind, key, title = '') {
  if (off || !key) return;
  const k = kind + '|' + key.toLowerCase();
  const now = Date.now();
  if (now - (sent.get(k) || 0) < GAP) return;
  sent.set(k, now);
  supabase.from('brain_events').insert({ kind, key: String(key).slice(0, 200), title: String(title).slice(0, 300) })
    .then(({ error }) => { if (error) off = true; }, () => { off = true; });
}

// { users_7d, views_7d, users, views, daily[], top[], misses[] } · 기능이 꺼져 있으면 null
export async function loadUsage(days = 30) {
  if (LOCAL || !supabase) return null;
  try {
    const { data, error } = await supabase.rpc('brain_usage', { days });
    return error ? null : data;
  } catch { return null; }
}

// AI 질문: 서버 함수(ask)로 질문과 근거 문서를 보내 답을 받는다
export const askAvailable = () => !LOCAL && !!supabase;
export async function askClaude(payload) {
  const { data, error } = await supabase.functions.invoke('ask', { body: payload });
  if (error) {
    let msg = '';
    try { msg = (await error.context?.json?.())?.error || ''; } catch { /* 무시 */ }
    if (!msg && /Failed to send|fetch/i.test(String(error.message))) msg = 'AI 질문 서버(ask 함수)에 연결하지 못했어요. 아직 배포되지 않았을 수 있어요.';
    throw new Error(msg || error.message || 'AI 질문에 실패했어요.');
  }
  return data;
}
// 내 질문 기록 (본인 것만 보임)
export async function loadMyQuestions(limit = 20) {
  if (!askAvailable()) return null;
  const { data, error } = await supabase.from('brain_questions').select('id, at, question, answer, refs, ok, error').order('at', { ascending: false }).limit(limit);
  return error ? null : data;
}
