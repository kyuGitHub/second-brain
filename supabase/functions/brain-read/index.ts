// brain-read: 세컨브레인 비공개 저장소를 "읽기 전용"으로 꺼내 주는 서버 함수
// - 요청 머리글 x-brain-key (또는 Authorization) 가 Secrets 의 BRAIN_READ_KEY 와 같을 때만 응답
// - GET 만, 정해진 파일만 (graph.json, history.json, search.json, notes/0~f.json)
// - 쓰기·삭제·다른 버킷 접근은 할 수 없음. 키가 새면 Secrets 에서 값만 바꾸면 바로 막힘
//
// 배포: Edge Functions → Deploy a new function → Via Editor → 이름 brain-read → 이 내용 붙여넣기
//       함수 설정에서 "Enforce JWT verification" 끄기 (이 함수는 자체 키로 확인)
// 키:   Edge Functions → Secrets → BRAIN_READ_KEY = 긴 임의 문자열

const BUCKET = 'second-brain';
const ALLOWED = /^(graph|history|search)\.json$|^notes\/[0-9a-f]\.json$/;

function same(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return new Response('method not allowed', { status: 405 });

  // 키는 x-brain-key 또는 Authorization(Bearer 유무 상관없이) 어느 쪽으로 와도 받는다
  const expected = Deno.env.get('BRAIN_READ_KEY') ?? '';
  const auth = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const given = [req.headers.get('x-brain-key') ?? '', auth];
  if (expected.length < 32 || !given.some((g) => same(g, expected))) {
    return new Response('unauthorized', { status: 401 });
  }

  const path = new URL(req.url).searchParams.get('path') ?? 'graph.json';
  if (!ALLOWED.test(path)) return new Response('path not allowed', { status: 400 });

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (!res.ok) return new Response(`storage ${res.status}`, { status: res.status === 404 ? 404 : 502 });

  return new Response(res.body, {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
});
