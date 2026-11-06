// 그래프 만들기(build-graph) 테스트 — 작은 가짜 볼트로 실제 빌드를 돌려 본다
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-test-'));
const vault = path.join(tmp, 'vault'), out = path.join(tmp, 'out');
const write = (rel, text) => { const p = path.join(vault, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };

write('1_위키/20_요구사항/REQ-AP-001 상위.md', `---\n요구사항ID: REQ-AP-001\n요구정의명: 간편한도조회\n업무: 상위요구사항\n대분류: 대출공통\n처리결과: 유지\n---\n# 상위\n하위는 [[REQ-AP-002 본인인증]] 이에요.\n`);
write('1_위키/20_요구사항/REQ-AP-002 본인인증.md', `---\n요구사항ID: REQ-AP-002\n요구정의명: 본인인증\n업무: APP\n대분류: 대출공통\n중분류: 인증\n처리결과: 유지\n---\n# 본인인증\n${'긴 본문 '.repeat(200)}마지막단어\n<script>alert(1)</script>\n`);
write('1_위키/20_요구사항/REQ-AP-003 숨김.md', `---\n요구사항ID: REQ-AP-003\n업무: APP\n처리결과: 숨김\n---\n숨겨야 하는 문서\n`);
write('1_위키/10_회의록&인터뷰/12_업무회의/2026-10-01 회의.md', `---\ntype: 회의록\n---\n본인인증 이야기\n`);
write('2_작업/무시.md', '위키 밖 문서');

process.env.SB_VAULT = vault;
process.env.SB_OUT = out;
const { build } = await import('../scripts/build-graph.mjs');
const g = build({ quiet: true });
const byTitle = (t) => g.nodes.find((n) => n.title.startsWith(t));

test('위키 폴더만 읽고, 처리결과: 숨김 문서는 뺀다', () => {
  assert.ok(byTitle('REQ-AP-001'));
  assert.ok(!g.nodes.some((n) => n.title.includes('무시')));
  assert.ok(!byTitle('REQ-AP-003'));
});

test('요구사항 수준: 업무가 상위요구사항이면 상위, 아니면 세부', () => {
  assert.equal(byTitle('REQ-AP-001').lv, '상위');
  assert.equal(byTitle('REQ-AP-002').lv, '세부');
});

test('본문 링크가 연결이 되고, 상위요구사항에서 나간 링크는 parent 유형', () => {
  const a = byTitle('REQ-AP-001').id, b = byTitle('REQ-AP-002').id;
  const l = g.links.find((x) => x.source === a && x.target === b);
  assert.ok(l, '연결 없음');
  assert.equal(l.type, 'parent');
});

test('그래프의 검색어는 짧게, 본문 전체는 search.json 에', () => {
  const n = byTitle('REQ-AP-002');
  assert.ok(n.search.length <= 300);
  const full = JSON.parse(fs.readFileSync(path.join(out, 'search.json'), 'utf8'));
  assert.ok(full[n.id].includes('마지막단어'));
  assert.equal(g.meta.format, 3);
  assert.ok(g.meta.domain?.idPattern, 'domain.idPattern 이 meta 에 있어야 함');
});

test('본문 HTML 파일이 만들어지고 지문(fp)이 붙는다', () => {
  const n = byTitle('REQ-AP-002');
  assert.ok(fs.existsSync(path.join(out, 'notes', n.file)));
  assert.match(n.fp, /^[0-9a-f]{10}$/);
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
