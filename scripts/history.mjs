// 이전 업로드와 이번 업로드의 그래프를 비교해 변경 이력 한 건을 만든다.
// lv: 요구사항 수준(상위/세부) — 상위 요구사항 변경을 따로 볼 수 있게 함께 적는다
// 요구사항은 요구사항ID 로, 나머지 노트는 노트 id(파일 경로 기준)로 같은 노트인지 판단한다.

export const keyOf = (n) => (n.props?.['요구사항ID'] ? 'req:' + n.props['요구사항ID'] : 'id:' + n.id);
const cut = (v) => { const s = String(v ?? ''); return s.length > 120 ? s.slice(0, 119) + '…' : s; };

export function diffGraphs(prev, next, at = new Date().toISOString()) {
  const pick = (g) => new Map((g?.nodes || []).filter((n) => n.type !== 'topic' && !n.aux).map((n) => [keyOf(n), n]));
  const a = pick(prev), b = pick(next);
  const added = [], removed = [], changed = [];
  for (const [k, n] of b) {
    const o = a.get(k);
    if (!o) { added.push({ k, t: n.title, lv: n.lv }); continue; }
    const fields = [];
    if (o.title !== n.title) fields.push({ f: '제목', from: cut(o.title), to: cut(n.title) });
    const keys = new Set([...Object.keys(o.props || {}), ...Object.keys(n.props || {})]);
    keys.delete('updated'); // 수정일은 매번 바뀔 수 있어서 변경으로 보지 않는다
    for (const f of keys) {
      const x = o.props?.[f] ?? '', y = n.props?.[f] ?? '';
      if (x !== y) fields.push({ f, from: cut(x), to: cut(y) });
    }
    if (o.fp && n.fp && o.fp !== n.fp) fields.push({ f: '본문' });
    if (fields.length) changed.push({ k, t: n.title, lv: n.lv, fields });
  }
  for (const [k, o] of a) if (!b.has(k)) removed.push({ k, t: o.title, lv: o.lv });
  return { at, added, removed, changed, total: b.size };
}

export const isEmpty = (e) => !e.added.length && !e.removed.length && !e.changed.length;
