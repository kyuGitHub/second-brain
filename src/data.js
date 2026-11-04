// 그래프 데이터를 어디서 읽을지 정한다.
//  - 내 PC 개발 실행(npm run dev / start.bat): 로컬 파일 public/data — 로그인 없음
//  - 웹 배포본: Supabase 비공개 저장소 — Supabase 에 추가된 계정으로 로그인한 사용자만
import { supabase, BUCKET } from './supabase.js';

export const LOCAL = import.meta.env.DEV;

async function remoteJson(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return JSON.parse(await data.text());
}

export async function loadGraph() {
  if (LOCAL) {
    const res = await fetch('data/graph.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }
  return remoteJson('graph.json');
}

// 본문은 16묶음(notes/0.json ~ notes/f.json)으로 나뉘어 있어서 필요한 묶음만 받는다
const chunks = new Map();
export async function loadNoteHtml(file) {
  if (LOCAL) {
    const res = await fetch('data/notes/' + file);
    return (await res.json()).html;
  }
  const k = file[0];
  if (!chunks.has(k)) chunks.set(k, remoteJson(`notes/${k}.json`).catch((e) => { chunks.delete(k); throw e; }));
  return (await chunks.get(k))[file] || '';
}

// 변경 이력 (업로드할 때마다 한 건씩 쌓임, 최신이 앞). 없으면 빈 목록
export async function loadHistory() {
  try {
    if (LOCAL) { const res = await fetch('data/history.json', { cache: 'no-store' }); return res.ok ? await res.json() : []; }
    return await remoteJson('history.json');
  } catch { return []; }
}

// 본문 전체 검색용 글자 (노트 id → 본문). 크기가 커서 검색을 처음 할 때 한 번만 받는다. 없으면 null
let searchP = null;
export function loadSearch() {
  searchP ??= (LOCAL
    ? fetch('data/search.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
    : remoteJson('search.json')).catch(() => null);
  return searchP;
}
