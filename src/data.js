// 그래프 데이터를 어디서 읽을지 정한다.
//  - 내 PC 개발 실행(npm run dev / start.bat): 로컬 파일 public/data — 로그인 없음
//  - 웹 배포본: Supabase 비공개 저장소 — 로그인한 명단 사용자만
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

let notesBundle = null;
export async function loadNoteHtml(file) {
  if (LOCAL) {
    const res = await fetch('data/notes/' + file);
    return (await res.json()).html;
  }
  notesBundle ??= remoteJson('notes.json');
  return (await notesBundle)[file] || '';
}
