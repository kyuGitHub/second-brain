// 변경 이력 비교(diffGraphs) 테스트 — node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { diffGraphs, isEmpty, keyOf } from '../scripts/history.mjs';

const req = (id, extra = {}) => ({ id: 'w/' + id + '.md', title: id + ' 이름', type: 'semantic', props: { 요구사항ID: id, 처리결과: '유지', ...extra.props }, fp: extra.fp || 'a', lv: extra.lv || '세부' });

test('요구사항은 요구사항ID 로, 나머지는 노트 id 로 같은 문서를 찾는다', () => {
  assert.equal(keyOf(req('REQ-AP-1')), 'req:REQ-AP-1');
  assert.equal(keyOf({ id: 'x.md' }), 'id:x.md');
});

test('추가·삭제·속성 변경·본문 변경을 구분하고 수준(lv)을 함께 적는다', () => {
  const prev = { nodes: [req('REQ-AP-1'), req('REQ-AP-2'), req('REQ-AP-3')] };
  const next = { nodes: [
    req('REQ-AP-1', { props: { 처리결과: '취소선' } }),
    req('REQ-AP-2', { fp: 'b', lv: '상위' }),
    req('REQ-AP-4'),
  ] };
  const e = diffGraphs(prev, next, '2026-11-05T00:00:00Z');
  assert.deepEqual(e.added.map((x) => x.k), ['req:REQ-AP-4']);
  assert.deepEqual(e.removed.map((x) => x.k), ['req:REQ-AP-3']);
  const c1 = e.changed.find((c) => c.k === 'req:REQ-AP-1');
  assert.deepEqual(c1.fields, [{ f: '처리결과', from: '유지', to: '취소선' }]);
  const c2 = e.changed.find((c) => c.k === 'req:REQ-AP-2');
  assert.deepEqual(c2.fields, [{ f: '본문' }]);
  assert.equal(c2.lv, '상위');
  assert.equal(e.total, 3);
});

test('수정일(updated)만 바뀐 것은 변경으로 보지 않는다', () => {
  const a = { nodes: [req('REQ-AP-1', { props: { updated: '2026-11-01' } })] };
  const b = { nodes: [req('REQ-AP-1', { props: { updated: '2026-11-05' } })] };
  assert.ok(isEmpty(diffGraphs(a, b)));
});

test('보조 자료와 대분류 노드는 비교에서 뺀다', () => {
  const a = { nodes: [{ id: 'moc.md', title: 'MOC', aux: true, props: {} }, { id: 't', type: 'topic', title: 'T' }] };
  assert.ok(isEmpty(diffGraphs(a, { nodes: [] })));
});
