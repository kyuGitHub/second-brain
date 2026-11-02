// 글꼴: Pretendard 를 프로젝트 안에 포함 (인터넷 없이도 동작, 필요한 글자 묶음만 불러옴)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import ForceGraph from 'force-graph';
import { gate } from './auth.js';
import { loadGraph, loadNoteHtml, LOCAL } from './data.js';
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/* ───────────── 설정값 ───────────── */
const TYPES = {
  thesis:     { ko: '핵심 주장', en: 'Thesis',     dark: '#d6f24a', light: '#6f8f00' },
  semantic:   { ko: '개념',     en: 'Semantic',   dark: '#f1efe8', light: '#3d3d38' },
  procedural: { ko: '방법',     en: 'Procedural', dark: '#6aa8ff', light: '#2f6fd6' },
  episodic:   { ko: '경험',     en: 'Episodic',   dark: '#ffa057', light: '#cf6410' },
  reflective: { ko: '회고',     en: 'Reflective', dark: '#b98cff', light: '#7a4fd0' },
  entity:     { ko: '개체',     en: 'Entity',     dark: '#5fd4c4', light: '#13877a' },
  topic:      { ko: '주제',     en: 'Topic',      dark: '#ff7aa8', light: '#c43c6e' },
};
const EDGES = {
  supports:       { ko: '뒷받침',   color: '#d6f24a', out: '뒷받침하는 대상',      in: '이 노트를 뒷받침하는 근거' },
  extends:        { ko: '확장',     color: '#6aa8ff', out: '확장한 노트',          in: '이 노트를 확장한 노트' },
  instantiates:   { ko: '사례',     color: '#ffa057', out: '사례로 보여주는 개념', in: '이 개념의 사례' },
  refines:        { ko: '다듬음',   color: '#5fd4c4', out: '다듬은 원래 노트',     in: '이 노트를 다듬은 버전' },
  contradicts:    { ko: '반박',     color: '#ff5a5a', out: '반박하는 노트',        in: '이 노트를 반박하는 노트' },
  'triggered-by': { ko: '계기',     color: '#ffd166', out: '계기가 된 노트',       in: '이 노트가 계기가 된 노트' },
  requires:       { ko: '전제',     color: '#b98cff', out: '전제 조건',            in: '이 노트를 전제로 하는 노트' },
  composes:       { ko: '구성',     color: '#9ad1ff', out: '구성 요소로 속한 곳',  in: '구성 요소' },
  mentions:       { ko: '언급',     color: '#9a988f', out: '본문에서 언급한 노트', in: '이 노트를 언급한 곳 (백링크)', dash: [1, 2] },
  topic:          { ko: '주제',     color: '#ff7aa8', out: '주제',                in: '이 주제의 노트', dash: [3, 3] },
  thesis:         { ko: '핵심 주장', color: '#d6f24a', out: '연결된 핵심 주장',    in: '이 주장에 속한 노트', dash: [3, 3] },
};
const PALETTE = ['#e4572e', '#f3a712', '#a8c256', '#29bf97', '#4fb3d9', '#6a7fdb', '#b06ad9', '#e86fa8', '#c9b18a', '#7fd1b9', '#f78c6b', '#9fa8ff'];
const VIEWS = {
  brain:         { ko: '브레인 3D', light: false, three: true, hint: '전체 기억을 3D 별자리로 보여줘요. 드래그로 회전, 스크롤로 확대해요. 노드를 누르면 연결된 노트가 강조돼요.' },
  free:          { ko: '자유',     light: false, hint: '노드를 끌어서 배치를 바꿀 수 있어요. 스크롤로 확대해요. 노드를 누르면 연결된 노트가 강조돼요.' },
  constellation: { ko: '별자리',   light: true,  hint: '핵심 주장을 원 위에 고정하고, 각 노트를 연결된 주장 쪽으로 끌어당겨요.' },
  hierarchy:     { ko: '계층',     light: true,  hint: '핵심 주장 · 노트 · 주제를 세 층으로 나눠 쌓아요.' },
  timeline:      { ko: '타임라인', light: true,  hint: '작성일 순서로 왼쪽(과거)에서 오른쪽(최근)으로 놓아요. 아래 막대로 기간을 좁혀요.' },
};
const LENSES = { all: '전체', topic: '주제별', cluster: '군집별', thesis: '핵심 주장별', source: '외부 vs 내 생각' };
const SPACING = { compact: { ko: '좁게', charge: -22, dist: 22, f: 0.7 }, normal: { ko: '보통', charge: -55, dist: 38, f: 1 }, wide: { ko: '넓게', charge: -130, dist: 64, f: 1.5 } };
const isMobile = () => window.matchMedia('(max-width: 860px)').matches;

/* ───────────── 상태 ───────────── */
const saved = (() => { try { return JSON.parse(localStorage.getItem('sb-prefs') || '{}'); } catch { return {}; } })();
const state = {
  view: VIEWS[saved.view] ? saved.view : (isMobile() ? 'free' : 'brain'),
  lens: LENSES[saved.lens] ? saved.lens : 'all',
  colorBy: saved.colorBy === 'topic' ? 'topic' : 'type',
  spacing: SPACING[saved.spacing] ? saved.spacing : 'normal',
  labels: saved.labels !== false,
  hiddenTypes: new Set(), hiddenEdges: new Set(),
  filterTopics: new Set(), filterTags: new Set(),
  range: [0, 1], hover: null, selected: null, history: [],
};
const savePrefs = () => { try { localStorage.setItem('sb-prefs', JSON.stringify({ view: state.view, lens: state.lens, colorBy: state.colorBy, spacing: state.spacing, labels: state.labels })); } catch { /* 저장 불가 환경 */ } };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const idOf = (x) => (typeof x === 'object' && x ? x.id : x);
const rgba = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const dayNum = (d) => (d ? Math.floor(Date.parse(d) / 864e5) : null);

let G = null; // 원본 그래프
// 기능 스위치 (config.json 의 features). 요구사항이 정해지면 true 로 켠다.
//  categories: 왼쪽 렌즈·주제·태그·핵심 주장 목록 / search: 검색창 / reader: 노트 본문 패널
let F = { categories: false, search: false, reader: false };
let byId = new Map(), nbr = new Map(), topicColorMap = new Map(), thesisZone = new Set(), dateDomain = [0, 1];
let g2 = null, g3 = null, data2 = null, data3 = null, pendingFit = true, bloom = null;

/* ───────────── 데이터 불러오기 ───────────── */
async function load() {
  try {
    showEmpty('그래프를 불러오는 중이에요…');
    G = await loadGraph();
    $('empty').hidden = true;
  } catch {
    showEmpty(LOCAL
      ? '그래프 데이터를 찾지 못했어요.<br>터미널에서 <b>npm run graph</b> 를 먼저 실행해 주세요.'
      : '그래프 데이터를 불러오지 못했어요.<br>아직 노트를 올리기 전이거나, 이 계정에 열람 권한이 없어요.<br>관리자에게 열람 명단 등록을 요청해 주세요.');
    return;
  }
  document.title = G.meta.title;
  $('site-title').textContent = G.meta.title;
  $('site-subtitle').textContent = G.meta.subtitle || '';
  $('stat-nodes').textContent = G.nodes.length.toLocaleString();
  $('stat-links').textContent = G.links.length.toLocaleString();
  $('built-at').textContent = `마지막 갱신 ${new Date(G.meta.builtAt).toLocaleString('ko-KR')}`;
  F = { ...F, ...(G.meta.features || {}) };
  document.querySelectorAll('[data-feature]').forEach((el) => { el.hidden = !F[el.dataset.feature]; });
  $('sec-category-placeholder').hidden = F.categories;
  if (!F.categories) state.lens = 'all';
  if (!G.nodes.length) { showEmpty('볼트에서 노트를 찾지 못했어요.<br>config.json 의 vaultPath 를 확인해 주세요.'); return; }

  byId = new Map(G.nodes.map((n) => [n.id, n]));
  for (const n of G.nodes) nbr.set(n.id, new Set());
  for (const l of G.links) { nbr.get(l.source)?.add(l.target); nbr.get(l.target)?.add(l.source); }

  // 주제 노드의 날짜 = 소속 노트 날짜의 중앙값 (타임라인 배치용)
  for (const n of G.nodes.filter((x) => x.type === 'topic')) {
    const ds = [...nbr.get(n.id)].map((id) => byId.get(id)?.date).filter(Boolean).sort();
    n.date = ds[Math.floor(ds.length / 2)] || null;
  }
  const days = G.nodes.map((n) => dayNum(n.date)).filter((x) => x != null);
  dateDomain = days.length ? [Math.min(...days), Math.max(...days)] : [0, 1];
  if (dateDomain[0] === dateDomain[1]) dateDomain[1] += 1;

  // 주제별 색상: 노트 수가 많은 주제부터 팔레트를 배정
  const topicCount = countBy(G.nodes.filter((n) => n.type !== 'topic').flatMap((n) => n.topics));
  [...topicCount.keys()].forEach((t, i) => topicColorMap.set(t, PALETTE[i % PALETTE.length]));

  // 핵심 주장에 직접 닿는 노드
  for (const n of G.nodes) if (n.type === 'thesis') { thesisZone.add(n.id); nbr.get(n.id).forEach((x) => byId.get(x)?.type !== 'topic' && thesisZone.add(x)); }

  buildSidebar(topicCount);
  setView(state.view, { initial: true });
  window.addEventListener('hashchange', onHash);
  onHash();
}

function countBy(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return new Map([...m.entries()].sort((a, b) => b[1] - a[1]));
}
function showEmpty(html) { const e = $('empty'); e.innerHTML = html; e.hidden = false; }

/* ───────────── 보이기·색·투명도 규칙 ───────────── */
const filterOn = () => state.filterTopics.size > 0 || state.filterTags.size > 0;
function matchesFilter(n) {
  const tOk = !state.filterTopics.size || (n.type === 'topic' ? state.filterTopics.has(n.title) : n.topics.some((t) => state.filterTopics.has(t)));
  const gOk = !state.filterTags.size || (n.type !== 'topic' && n.tags.some((t) => state.filterTags.has(t)));
  return tOk && gOk;
}
function inRange(n) {
  if (state.view !== 'timeline' || !n.date) return true;
  const t = (dayNum(n.date) - dateDomain[0]) / (dateDomain[1] - dateDomain[0]);
  return t >= state.range[0] - 1e-9 && t <= state.range[1] + 1e-9;
}
const nodeVisible = (n) => !state.hiddenTypes.has(n.type) && (!filterOn() || matchesFilter(n)) && inRange(n);
const linkVisible = (l) => {
  if (state.hiddenEdges.has(l.type)) return false;
  const s = byId.get(idOf(l.source)), t = byId.get(idOf(l.target));
  return s && t && nodeVisible(s) && nodeVisible(t);
};
const isDark = () => !VIEWS[state.view].light;

function nodeColor(n) {
  const grey = isDark() ? '#6b6a64' : '#a3a199';
  if (state.lens === 'cluster') return n.cluster < 0 ? grey : PALETTE[n.cluster % PALETTE.length];
  if (state.lens === 'source') return n.type === 'topic' ? grey : n.source === 'external' ? '#4fb3d9' : '#f3a712';
  if (state.colorBy === 'topic' || state.lens === 'topic') {
    const t = n.type === 'topic' ? n.title : n.topics[0];
    return (t && topicColorMap.get(t)) || grey;
  }
  return TYPES[n.type]?.[isDark() ? 'dark' : 'light'] || grey;
}
function nodeAlpha(n) {
  const focus = state.hover || state.selected;
  if (focus) return n.id === focus || nbr.get(focus)?.has(n.id) ? 1 : 0.12;
  if (state.lens === 'thesis') return thesisZone.has(n.id) ? 1 : 0.1;
  return 1;
}
function nodeRadius(n) {
  if (n.type === 'thesis') return 7;
  if (n.type === 'topic') return 4.5 + Math.min(4, Math.sqrt(n.degree) * 0.4);
  return Math.min(8, 2.2 + Math.sqrt(n.degree) * 0.85);
}
function linkStyle(l) {
  const s = idOf(l.source), t = idOf(l.target);
  const focus = state.hover || state.selected;
  const touches = focus && (s === focus || t === focus);
  const base = EDGES[l.type]?.color || '#999';
  if (focus) return { color: touches ? rgba(isDark() ? base : darken(base), 0.85) : rgba(isDark() ? '#ffffff' : '#000000', 0.025), width: touches ? 1.4 : 0.4 };
  if (state.lens === 'thesis') {
    const on = thesisZone.has(s) && thesisZone.has(t) && (l.type === 'thesis' || l.type === 'supports');
    return { color: on ? rgba(isDark() ? '#d6f24a' : '#6f8f00', 0.5) : rgba(isDark() ? '#ffffff' : '#000000', 0.03), width: on ? 0.9 : 0.4 };
  }
  const weak = l.type === 'mentions' || l.type === 'topic' || l.type === 'thesis';
  if (isDark()) return { color: weak ? 'rgba(235,232,220,0.10)' : rgba(base, 0.28), width: weak ? 0.4 : 0.7 };
  return { color: weak ? 'rgba(30,30,25,0.10)' : rgba(darken(base), 0.35), width: weak ? 0.4 : 0.7 };
}
function darken(hex) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v * 0.62); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join(''); }

/* ───────────── 2D 그래프 ───────────── */
function ensure2d() {
  if (g2) return g2;
  data2 = { nodes: G.nodes.map((n) => ({ ...n })), links: G.links.map((l) => ({ ...l })) };
  const el = $('graph2d');
  g2 = new ForceGraph(el)
    .graphData(data2)
    .backgroundColor('rgba(0,0,0,0)')
    .nodeId('id')
    .nodeRelSize(1)
    .nodeVal((n) => nodeRadius(n) ** 2)
    .nodeVisibility(nodeVisible)
    .linkVisibility(linkVisible)
    .nodeCanvasObject(drawNode)
    .nodePointerAreaPaint((n, color, ctx) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(n.x, n.y, nodeRadius(n) + 2, 0, 2 * Math.PI); ctx.fill(); })
    .linkColor((l) => linkStyle(l).color)
    .linkWidth((l) => linkStyle(l).width)
    .linkLineDash((l) => EDGES[l.type]?.dash || null)
    .onNodeHover((n) => { state.hover = n ? n.id : null; el.style.cursor = n ? 'pointer' : ''; showTip(n); })
    .onNodeClick((n) => openNote(n.id))
    .onBackgroundClick(() => { if (state.selected) closePanel(); })
    .onRenderFramePost(drawOverlay)
    .onEngineStop(() => { if (pendingFit) { pendingFit = false; g2.zoomToFit(500, 70, nodeVisible); } })
    .cooldownTicks(260)
    .d3VelocityDecay(0.32);
  applySpacing(g2);
  return g2;
}

function drawNode(n, ctx, scale) {
  const r = nodeRadius(n), c = nodeColor(n), a = nodeAlpha(n), dark = isDark();
  ctx.globalAlpha = a;
  if (dark && a > 0.5) { ctx.shadowColor = c; ctx.shadowBlur = n.type === 'thesis' ? 22 : 9; }
  ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fillStyle = c; ctx.fill();
  ctx.shadowBlur = 0;
  if (n.type === 'topic' && !dark) { ctx.lineWidth = 1.2 / scale; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  if (state.selected === n.id) { ctx.lineWidth = 2 / scale; ctx.strokeStyle = dark ? '#fff' : '#1b1b18'; ctx.beginPath(); ctx.arc(n.x, n.y, r + 3 / scale + 1, 0, 2 * Math.PI); ctx.stroke(); }

  const focus = state.hover || state.selected;
  const near = focus && (n.id === focus || nbr.get(focus)?.has(n.id));
  const show = state.labels && (near || n.type === 'thesis' || (n.type === 'topic' && scale > 0.9) || scale > 2.6 || (!dark && scale > 1.6 && n.degree > 6));
  if (show && a > 0.3) {
    const fs = (n.type === 'thesis' ? 12.5 : 11) / scale;
    ctx.font = `${n.type === 'thesis' ? 600 : 400} ${fs}px Pretendard Variable, Pretendard, Malgun Gothic, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const label = n.title.length > 34 ? n.title.slice(0, 33) + '…' : n.title;
    ctx.fillStyle = dark ? (n.type === 'thesis' ? 'rgba(236,246,190,0.95)' : 'rgba(236,234,226,0.78)') : (n.type === 'thesis' ? '#3f5200' : 'rgba(30,30,26,0.82)');
    ctx.fillText(label, n.x + r + 3 / scale, n.y);
  }
  ctx.globalAlpha = 1;
}

// 계층·타임라인의 층 이름, 별자리의 원, 타임라인 눈금
function drawOverlay(ctx, scale) {
  const v = state.view;
  if (v !== 'hierarchy' && v !== 'timeline' && v !== 'constellation') return;
  const f = SPACING[state.spacing].f;
  ctx.save();
  ctx.fillStyle = 'rgba(60,60,52,0.55)'; ctx.strokeStyle = 'rgba(60,60,52,0.12)';
  ctx.font = `500 ${11 / scale}px Pretendard Variable, sans-serif`; ctx.textBaseline = 'middle';
  if (v === 'constellation') {
    ctx.lineWidth = 1 / scale; ctx.setLineDash([4 / scale, 4 / scale]);
    ctx.beginPath(); ctx.arc(0, 0, ringRadius(), 0, 2 * Math.PI); ctx.stroke();
  } else {
    let minX = Infinity, maxX = -Infinity;
    for (const n of data2.nodes) if (nodeVisible(n)) { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); }
    if (!isFinite(minX)) { ctx.restore(); return; }
    const H = 230 * f;
    [['핵심 주장', -H], ['노트', 0], ['주제', H]].forEach(([t, y]) => {
      ctx.textAlign = 'right'; ctx.fillText(t, minX - 30, y);
      ctx.lineWidth = 1 / scale; ctx.beginPath(); ctx.moveTo(minX - 20, y); ctx.lineTo(maxX + 20, y); ctx.stroke();
    });
    if (v === 'timeline') {
      const W = timelineWidth(), y = H + 90 * f;
      const [d0, d1] = dateDomain;
      const months = (d1 - d0) / 30;
      const stepM = months > 48 ? 12 : months > 18 ? 3 : 1;
      const start = new Date(d0 * 864e5); start.setUTCDate(1);
      ctx.textAlign = 'center';
      for (let d = new Date(start); d.getTime() / 864e5 <= d1; d.setUTCMonth(d.getUTCMonth() + stepM)) {
        const x = ((d.getTime() / 864e5 - d0) / (d1 - d0)) * W - W / 2;
        if (x < -W / 2 - 1) continue;
        ctx.fillText(stepM === 12 ? `${d.getUTCFullYear()}` : `${String(d.getUTCFullYear()).slice(2)}.${d.getUTCMonth() + 1}`, x, y);
        ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 8); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

const ringRadius = () => 300 * SPACING[state.spacing].f;
const timelineWidth = () => Math.max(900, Math.min(3200, G.nodes.length * 6)) * SPACING[state.spacing].f;
const bandY = (n) => { const H = 230 * SPACING[state.spacing].f; return n.type === 'thesis' ? -H : n.type === 'topic' ? H : 0; };

// d3 방식의 사용자 정의 힘: 노드를 목표 좌표 쪽으로 당긴다
function pull(target, k) {
  let nodes = [];
  const force = (alpha) => {
    for (const n of nodes) {
      const t = target(n);
      if (!t) continue;
      if (t.x != null) n.vx += (t.x - n.x) * k * alpha;
      if (t.y != null) n.vy += (t.y - n.y) * k * alpha;
    }
  };
  force.initialize = (ns) => { nodes = ns; };
  return force;
}

function applyLayout2d() {
  const g = ensure2d();
  const nodes = data2.nodes;
  const node2 = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) { n.fx = undefined; n.fy = undefined; }
  g.d3Force('pull', null);
  g.d3Force('center')?.strength?.(1);

  if (state.view === 'constellation') {
    const theses = nodes.filter((n) => n.type === 'thesis');
    const R = ringRadius();
    theses.forEach((n, i) => { const a = (i / Math.max(1, theses.length)) * 2 * Math.PI - Math.PI / 2; n.fx = Math.cos(a) * R; n.fy = Math.sin(a) * R; n.x = n.fx; n.y = n.fy; });
    const anchor = new Map();
    for (const n of nodes) {
      if (n.type === 'thesis') continue;
      const ts = [...nbr.get(n.id)].map((id) => node2.get(id)).filter((x) => x?.type === 'thesis');
      if (ts.length) anchor.set(n.id, ts);
    }
    g.d3Force('pull', pull((n) => {
      const ts = anchor.get(n.id);
      if (!ts) return n.type === 'thesis' ? null : { x: 0, y: 0 };
      return { x: ts.reduce((s, t) => s + t.fx, 0) / ts.length * 0.78, y: ts.reduce((s, t) => s + t.fy, 0) / ts.length * 0.78 };
    }, 0.08));
  } else if (state.view === 'hierarchy') {
    g.d3Force('pull', pull((n) => ({ y: bandY(n) + (n.type === 'thesis' || n.type === 'topic' ? 0 : ((hash(n.id) % 140) - 70) * SPACING[state.spacing].f) }), 0.35));
  } else if (state.view === 'timeline') {
    const W = timelineWidth();
    for (const n of nodes) {
      const d = dayNum(n.date);
      if (d == null) continue;
      n.fx = ((d - dateDomain[0]) / (dateDomain[1] - dateDomain[0])) * W - W / 2;
    }
    g.d3Force('pull', pull((n) => ({ y: bandY(n) + (n.type === 'thesis' || n.type === 'topic' ? 0 : ((hash(n.id) % 160) - 80) * SPACING[state.spacing].f) }), 0.4));
  }
  pendingFit = true;
  g.d3ReheatSimulation();
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

function applySpacing(g) {
  const s = SPACING[state.spacing];
  g.d3Force('charge')?.strength(s.charge);
  g.d3Force('link')?.distance((l) => (l.type === 'topic' || l.type === 'thesis' ? s.dist * 1.6 : s.dist)).strength((l) => (l.type === 'topic' ? 0.04 : l.type === 'mentions' ? 0.12 : 0.3));
}

/* ───────────── 3D 그래프 (브레인) ───────────── */
function ensure3d() {
  if (g3) return g3;
  data3 = { nodes: G.nodes.map((n) => ({ ...n })), links: G.links.map((l) => ({ ...l })) };
  const el = $('graph3d');
  g3 = new ForceGraph3D(el, { controlType: 'orbit' })
    .graphData(data3)
    .backgroundColor('#000000') // 빛번짐 효과가 회색으로 바꾸지 않도록 완전한 검정
    .showNavInfo(false)
    .nodeId('id')
    .nodeRelSize(1.6)
    .nodeVal((n) => nodeRadius(n) ** 2 / 3)
    .nodeResolution(10)
    .nodeOpacity(0.95)
    .nodeVisibility(nodeVisible)
    .linkVisibility(linkVisible)
    .linkOpacity(G.nodes.length > 1000 ? 0.18 : 0.35)
    .linkWidth(0)
    .nodeLabel((n) => tipHtml(n))
    .onNodeHover((n) => { state.hover = n ? n.id : null; el.style.cursor = n ? 'pointer' : ''; refresh3d(); })
    .onNodeClick((n) => openNote(n.id))
    .onBackgroundClick(() => { if (state.selected) closePanel(); })
    .nodeThreeObjectExtend(true)
    .cooldownTicks(220)
    .onEngineStop(() => { if (pendingFit) { pendingFit = false; g3.zoomToFit(700, 40, nodeVisible); } });
  style3d();
  applySpacing(g3);
  try {
    // 노드가 많을수록 빛번짐을 줄여서 하얗게 뭉개지지 않게 한다
    const big = G.nodes.length;
    const strength = big > 1000 ? 0.45 : big > 400 ? 0.7 : 1.15;
    bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), strength, 0.45, big > 400 ? 0.2 : 0.08);
    g3.postProcessingComposer().addPass(bloom);
  } catch { /* 빛번짐 효과 없이 표시 */ }
  const ctl = g3.controls();
  if (ctl) {
    ctl.autoRotate = true; ctl.autoRotateSpeed = 0.35;
    el.addEventListener('pointerdown', () => { ctl.autoRotate = false; }, { once: true });
  }
  return g3;
}
function color3(n) {
  const a = nodeAlpha(n);
  return a < 0.5 ? rgba(nodeColor(n), 0.12) : nodeColor(n);
}
function style3d() {
  g3.nodeColor(color3)
    .linkColor((l) => linkStyle(l).color)
    .nodeThreeObject((n) => {
      if (!state.labels || (n.type !== 'thesis' && !(n.type === 'topic' && G.nodes.length < 300))) return null;
      const s = new SpriteText(n.title.length > 26 ? n.title.slice(0, 25) + '…' : n.title);
      s.color = n.type === 'thesis' ? '#ecf6be' : 'rgba(236,234,226,0.75)';
      s.textHeight = n.type === 'thesis' ? 3.6 : 2.6;
      s.fontFace = 'Pretendard Variable, Malgun Gothic, sans-serif';
      s.position.y = nodeRadius(n) + 5;
      return s;
    });
}
function refresh3d() {
  if (!g3) return;
  g3.nodeColor(color3).linkColor((l) => linkStyle(l).color);
}

/* ───────────── 보기 전환 ───────────── */
function setView(v, { initial = false } = {}) {
  if (VIEWS[v].three) {
    try { ensure3d(); } catch (e) {
      console.warn('3D 를 켤 수 없어 2D 로 보여줘요.', e);
      v = 'free';
    }
  }
  state.view = v;
  savePrefs();
  const three = !!VIEWS[v].three;
  $('graph3d').hidden = !three;
  $('graph2d').hidden = three;
  $('stage').classList.toggle('light', VIEWS[v].light);
  $('timeline-bar').hidden = v !== 'timeline';
  $('view-hint').textContent = VIEWS[v].hint;
  segActive('view-seg', v);
  resize();
  // 숨겨진 3D 는 그리기를 멈춰서 컴퓨터 부담을 줄인다
  if (three) { g3.resumeAnimation(); pendingFit = true; refresh3d(); if (!initial) g3.d3ReheatSimulation(); }
  else { g3?.pauseAnimation(); applyLayout2d(); }
  updateTimelineLabels();
}

function refresh() {
  if (g2) g2.nodeVisibility(nodeVisible).linkVisibility(linkVisible).nodeCanvasObject(drawNode);
  if (g3) g3.nodeVisibility(nodeVisible).linkVisibility(linkVisible);
  refresh3d();
}

function resize() {
  const el = $('stage');
  const w = el.clientWidth, h = el.clientHeight;
  if (g2) g2.width(w).height(h);
  if (g3) { g3.width(w).height(h); bloom?.setSize?.(w, h); }
}

/* ───────────── 왼쪽 패널 ───────────── */
function buildSidebar(topicCount) {
  // 렌즈
  $('lens-chips').innerHTML = Object.entries(LENSES).map(([k, v]) => `<button class="chip" data-k="${k}">${v}</button>`).join('');
  $('lens-chips').onclick = (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.lens = b.dataset.k; savePrefs(); chipActive('lens-chips', state.lens); refresh();
  };
  chipActive('lens-chips', state.lens);

  // 주제·태그
  const tagCount = countBy(G.nodes.filter((n) => n.type !== 'topic').flatMap((n) => n.tags));
  renderFilterChips('topic-chips', topicCount, state.filterTopics);
  renderFilterChips('tag-chips', tagCount, state.filterTags);
  $('clear-filter').onclick = () => { state.filterTopics.clear(); state.filterTags.clear(); renderFilterChips('topic-chips', topicCount, state.filterTopics); renderFilterChips('tag-chips', tagCount, state.filterTags); onFilterChange(); };

  // 노드 유형
  const typeCount = countBy(G.nodes.map((n) => n.type));
  $('type-legend').innerHTML = Object.entries(TYPES).filter(([k]) => typeCount.has(k)).map(([k, t]) =>
    `<li data-k="${k}"><span class="dot" style="background:${t.light}"></span><span class="name">${t.ko}<span class="en">${t.en}</span></span><span class="n">${typeCount.get(k)}</span></li>`).join('');
  $('type-legend').onclick = (e) => toggleLegend(e, state.hiddenTypes);

  // 연결 유형
  const edgeCount = countBy(G.links.map((l) => l.type));
  $('edge-legend').innerHTML = Object.entries(EDGES).filter(([k]) => edgeCount.has(k)).map(([k, t]) =>
    `<li data-k="${k}"><span class="ln${t.dash ? (k === 'mentions' ? ' dot2' : ' dash') : ''}" style="border-color:${darken(t.color)}"></span><span class="name">${t.ko}<span class="en">${k}</span></span><span class="n">${edgeCount.get(k)}</span></li>`).join('');
  $('edge-legend').onclick = (e) => toggleLegend(e, state.hiddenEdges);

  // 보기 / 색상 / 간격
  seg('view-seg', Object.fromEntries(Object.entries(VIEWS).map(([k, v]) => [k, v.ko])), state.view, (k) => setView(k));
  seg('color-seg', { type: '유형', topic: '주제' }, state.colorBy, (k) => { state.colorBy = k; savePrefs(); refresh(); });
  seg('spacing-seg', Object.fromEntries(Object.entries(SPACING).map(([k, v]) => [k, v.ko])), state.spacing, (k) => {
    state.spacing = k; savePrefs();
    if (g2) applySpacing(g2);
    if (g3) { applySpacing(g3); pendingFit = true; g3.d3ReheatSimulation(); }
    if (!VIEWS[state.view].three) applyLayout2d();
  });
  $('recenter').onclick = () => { if (VIEWS[state.view].three) g3.zoomToFit(600, 40, nodeVisible); else g2.zoomToFit(500, 70, nodeVisible); };
  const lbl = $('toggle-labels');
  lbl.textContent = state.labels ? '라벨 숨기기' : '라벨 보이기';
  lbl.onclick = () => { state.labels = !state.labels; savePrefs(); lbl.textContent = state.labels ? '라벨 숨기기' : '라벨 보이기'; if (g3) style3d(); refresh(); };

  // 핵심 주장 목록
  const theses = G.nodes.filter((n) => n.type === 'thesis').sort((a, b) => b.degree - a.degree);
  $('thesis-list').innerHTML = theses.length ? theses.map((n) => `<li data-id="${n.id}">${esc(n.title)}</li>`).join('') : '<li style="list-style:none;margin-left:-18px">아직 핵심 주장 노트가 없어요. 노트에 <code>type: thesis</code> 를 넣어 보세요.</li>';
  $('thesis-list').onclick = (e) => { const li = e.target.closest('li[data-id]'); if (li) { openNote(li.dataset.id); closeSidebarMobile(); } };

  // 타임라인 범위
  const mi = $('tl-min'), ma = $('tl-max');
  const onRange = () => {
    let a = +mi.value / 100, b = +ma.value / 100;
    if (a > b) [a, b] = [b, a];
    state.range = [a, b]; updateTimelineLabels(); refresh();
  };
  mi.oninput = onRange; ma.oninput = onRange;

  // 모바일 메뉴
  $('menu-btn').onclick = (e) => { e.stopPropagation(); $('app').classList.toggle('side-open'); };
  $('stage').addEventListener('pointerdown', closeSidebarMobile);
}
function closeSidebarMobile() { $('app').classList.remove('side-open'); }

function renderFilterChips(id, counts, set) {
  const el = $(id);
  const entries = [...counts.entries()];
  el.innerHTML = entries.length ? entries.map(([k, n]) => `<button class="chip${set.has(k) ? ' on' : ''}" data-k="${esc(k)}">${esc(k)}<span class="n">${n}</span></button>`).join('')
    + (entries.length > 12 ? `<button class="chip more">+${entries.length - 12} 더보기</button>` : '') : '<span class="hint" style="margin:0">없음</span>';
  el.classList.toggle('collapsed', entries.length > 12);
  el.onclick = (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.classList.contains('more')) { el.classList.remove('collapsed'); b.remove(); return; }
    const k = b.dataset.k;
    set.has(k) ? set.delete(k) : set.add(k);
    b.classList.toggle('on', set.has(k));
    onFilterChange();
  };
}
function onFilterChange() {
  $('clear-filter').hidden = !filterOn();
  refresh();
  pendingFit = true;
  if (VIEWS[state.view].three) g3.zoomToFit(600, 40, nodeVisible);
  else setTimeout(() => g2.zoomToFit(500, 70, nodeVisible), 50);
}
function toggleLegend(e, set) {
  const li = e.target.closest('li'); if (!li) return;
  const k = li.dataset.k;
  set.has(k) ? set.delete(k) : set.add(k);
  li.classList.toggle('off', set.has(k));
  refresh();
}
function chipActive(id, k) { $(id).querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); }
function seg(id, opts, cur, cb) {
  $(id).innerHTML = Object.entries(opts).map(([k, v]) => `<button data-k="${k}">${v}</button>`).join('');
  $(id).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; segActive(id, b.dataset.k); cb(b.dataset.k); };
  segActive(id, cur);
}
function segActive(id, k) { $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); }

function updateTimelineLabels() {
  const [d0, d1] = dateDomain;
  const f = (t) => new Date((d0 + t * (d1 - d0)) * 864e5).toISOString().slice(0, 10);
  $('tl-from').textContent = f(state.range[0]);
  $('tl-to').textContent = f(state.range[1]);
}

/* ───────────── 툴팁 ───────────── */
function tipHtml(n) {
  const t = TYPES[n.type];
  return `<div style="font-family:Pretendard Variable,sans-serif;max-width:300px;line-height:1.45"><b style="display:block;font-size:13.5px">${esc(n.title)}</b><span style="opacity:.7;font-size:11.5px">${t?.ko || n.type}${n.date ? ' · ' + n.date : ''}${n.type === 'topic' ? ` · 노트 ${n.degree}개` : ''}</span>${n.summary ? `<div style="font-size:12px;margin-top:4px;opacity:.85">${esc(n.summary.slice(0, 110))}${n.summary.length > 110 ? '…' : ''}</div>` : ''}</div>`;
}
let mouse = { x: 0, y: 0 };
$('stage').addEventListener('pointermove', (e) => {
  const r = $('stage').getBoundingClientRect();
  mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  const tip = $('tooltip');
  if (!tip.hidden) placeTip(tip);
});
function showTip(n) {
  const tip = $('tooltip');
  if (!n || isMobile()) { tip.hidden = true; return; }
  tip.innerHTML = tipHtml(n); tip.hidden = false; placeTip(tip);
}
function placeTip(tip) {
  const W = $('stage').clientWidth;
  const x = Math.min(mouse.x + 16, W - tip.offsetWidth - 12);
  tip.style.left = x + 'px'; tip.style.top = mouse.y + 16 + 'px';
}

/* ───────────── 검색 ───────────── */
const sIn = $('search'), sOut = $('search-results');
let sIdx = 0, sList = [];
sIn.addEventListener('input', () => {
  const q = sIn.value.trim().toLowerCase();
  if (!q || !G) { sOut.hidden = true; return; }
  const words = q.split(/\s+/);
  sList = G.nodes.map((n) => {
    const title = n.title.toLowerCase(), body = (n.search || '').toLowerCase();
    if (!words.every((w) => title.includes(w) || body.includes(w) || n.tags.some((t) => t.toLowerCase().includes(w)))) return null;
    let score = 0;
    for (const w of words) score += title.startsWith(w) ? 6 : title.includes(w) ? 4 : 1;
    if (n.type === 'thesis') score += 1;
    return { n, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || b.n.degree - a.n.degree).slice(0, 10).map((x) => x.n);
  sIdx = 0; renderSearch(q);
});
function renderSearch(q) {
  sOut.hidden = false;
  if (!sList.length) { sOut.innerHTML = `<li class="none">“${esc(q)}” 와 맞는 노트가 없어요</li>`; return; }
  sOut.innerHTML = sList.map((n, i) => `<li data-id="${n.id}" class="${i === sIdx ? 'active' : ''}"><span class="dot" style="background:${TYPES[n.type]?.light}"></span><span><span class="t">${esc(n.title)}</span><span class="s">${TYPES[n.type]?.ko || ''}${n.summary ? ' · ' + esc(n.summary.slice(0, 80)) : ''}</span></span></li>`).join('');
}
sIn.addEventListener('keydown', (e) => {
  if (sOut.hidden || !sList.length) { if (e.key === 'Escape') sIn.blur(); return; }
  if (e.key === 'ArrowDown') { sIdx = (sIdx + 1) % sList.length; renderSearch(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { sIdx = (sIdx - 1 + sList.length) % sList.length; renderSearch(); e.preventDefault(); }
  else if (e.key === 'Enter') { pick(sList[sIdx].id); }
  else if (e.key === 'Escape') { sOut.hidden = true; sIn.blur(); }
});
sOut.addEventListener('pointerdown', (e) => { const li = e.target.closest('li[data-id]'); if (li) { e.preventDefault(); pick(li.dataset.id); } });
sIn.addEventListener('blur', () => setTimeout(() => (sOut.hidden = true), 120));
function pick(id) { sOut.hidden = true; sIn.value = ''; sIn.blur(); openNote(id); }
document.addEventListener('keydown', (e) => {
  if (F.search && e.key === '/' && document.activeElement !== sIn) { e.preventDefault(); sIn.focus(); }
  if (e.key === 'Escape' && document.activeElement !== sIn && state.selected) closePanel();
});

/* ───────────── 노트 패널 ───────────── */
function onHash() {
  const m = location.hash.match(/^#\/note\/(.+)$/);
  if (m && byId.has(decodeURIComponent(m[1]))) openNote(decodeURIComponent(m[1]), { fromHash: true });
  else if (!m && state.selected) closePanel({ fromHash: true });
}

async function openNote(id, { fromHash = false, back = false } = {}) {
  const n = byId.get(id);
  if (!n) return;
  if (state.selected && state.selected !== id && !back) state.history.push(state.selected);
  state.selected = id;
  if (!fromHash) history.replaceState(null, '', '#/note/' + encodeURIComponent(id));
  if (!F.reader) { showNodeCard(n); focusNode(id); refresh(); return; }
  $('panel').hidden = false;
  $('panel-back').disabled = !state.history.length;
  focusNode(id);
  refresh();

  const t = TYPES[n.type];
  const chips = [...n.topics.map((x) => `<button class="chip" data-topic="${esc(x)}">${esc(x)}</button>`), ...n.tags.map((x) => `<button class="chip" data-tag="${esc(x)}">#${esc(x)}</button>`)].join('');
  const meta = [n.date, n.type !== 'topic' && (n.source === 'external' ? '외부 자료' : '내 생각'), n.folder, n.url && `<a href="${esc(n.url)}" target="_blank" rel="noopener">원문 링크 ↗</a>`].filter(Boolean).join('<span>·</span>');
  const body = $('panel-body');
  body.innerHTML = `
    <div class="p-type"><span class="dot" style="background:${t?.light}"></span>${t?.ko || n.type} · ${t?.en || ''}</div>
    <h2 class="p-title">${esc(n.title)}</h2>
    <div class="p-meta">${meta}</div>
    ${chips ? `<div class="p-chips">${chips}</div>` : ''}
    <div class="md" id="md">${n.type === 'topic' ? '' : '<p style="color:#8b8a82">불러오는 중…</p>'}</div>
    <div class="rel">${relatedHtml(n)}</div>`;
  body.scrollTop = 0;

  if (n.type === 'topic') { $('md').remove(); return; }
  try {
    const html = await loadNoteHtml(n.file);
    if (state.selected === id) $('md').innerHTML = html || '<p style="color:#8b8a82">본문이 비어 있어요.</p>';
  } catch {
    if (state.selected === id) $('md').innerHTML = '<p style="color:#8b8a82">본문을 불러오지 못했어요.</p>';
  }
}

function relatedHtml(n) {
  const groups = new Map();
  for (const l of G.links) {
    let dir, other;
    if (l.source === n.id) { dir = 'out'; other = l.target; } else if (l.target === n.id) { dir = 'in'; other = l.source; } else continue;
    const key = `${l.type}|${dir}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(byId.get(other));
  }
  if (!groups.size) return '<h4>연결</h4><p class="hint">아직 연결된 노트가 없어요.</p>';
  const order = Object.keys(EDGES);
  const keys = [...groups.keys()].sort((a, b) => order.indexOf(a.split('|')[0]) - order.indexOf(b.split('|')[0]) || (a.endsWith('out') ? -1 : 1));
  return '<h4>연결된 노트</h4>' + keys.map((k) => {
    const [type, dir] = k.split('|');
    const items = groups.get(k).filter(Boolean).sort((a, b) => b.degree - a.degree);
    return `<div class="rel-group"><div class="lab"><span class="ln" style="border-color:${darken(EDGES[type].color)}"></span>${EDGES[type][dir]} · ${items.length}</div>${items.map((x) => `<div class="rel-item" data-id="${x.id}"><span class="dot" style="background:${TYPES[x.type]?.light}"></span>${esc(x.title)}</div>`).join('')}</div>`;
  }).join('');
}

$('panel-body').addEventListener('click', (e) => {
  const a = e.target.closest('[data-id]');
  if (a) { e.preventDefault(); openNote(a.dataset.id); return; }
  const tp = e.target.closest('[data-topic]');
  if (tp) { const topic = G.nodes.find((x) => x.type === 'topic' && x.title === tp.dataset.topic); if (topic) openNote(topic.id); return; }
  const tg = e.target.closest('[data-tag]');
  if (tg) { state.filterTags.clear(); state.filterTags.add(tg.dataset.tag); document.querySelectorAll('#tag-chips .chip').forEach((b) => b.classList.toggle('on', b.dataset.k === tg.dataset.tag)); closePanel(); onFilterChange(); }
});
$('panel-close').onclick = () => closePanel();
$('panel-back').onclick = () => { const prev = state.history.pop(); if (prev) openNote(prev, { back: true }); };

function closePanel({ fromHash = false } = {}) {
  state.selected = null; state.history = [];
  $('panel').hidden = true;
  $('node-card').hidden = true;
  if (!fromHash) history.replaceState(null, '', location.pathname + location.search);
  refresh();
}

// 본문 패널을 끈 상태에서 노드를 누르면 보여주는 요약 카드 (그래프 속 위치·연결만 보여준다)
function showNodeCard(n) {
  const t = TYPES[n.type];
  const counts = new Map();
  for (const l of G.links) {
    if (l.source !== n.id && l.target !== n.id) continue;
    counts.set(l.type, (counts.get(l.type) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const rel = Object.keys(EDGES).filter((k) => counts.has(k))
    .map((k) => `<span><span style="color:${darken(EDGES[k].color)}">●</span> ${EDGES[k].ko} ${counts.get(k)}</span>`).join('');
  const card = $('node-card');
  card.innerHTML = `
    <button class="nc-close" aria-label="닫기">✕</button>
    <div class="nc-type"><span class="dot" style="background:${t?.light}"></span>${t?.ko || n.type} · ${t?.en || ''}${n.date ? ' · ' + n.date : ''}</div>
    <div class="nc-title">${esc(n.title)}</div>
    ${n.summary && n.type !== 'topic' ? `<div>${esc(n.summary.slice(0, 90))}${n.summary.length > 90 ? '…' : ''}</div>` : ''}
    <div class="nc-rel"><span><b>연결 ${total}</b></span>${rel}</div>`;
  card.hidden = false;
  card.querySelector('.nc-close').onclick = () => closePanel();
}

function focusNode(id) {
  if (VIEWS[state.view].three && g3) {
    const n = data3.nodes.find((x) => x.id === id);
    if (!n || n.x == null) return;
    const d = 90, r = Math.hypot(n.x, n.y, n.z) || 1;
    g3.controls().autoRotate = false;
    g3.cameraPosition({ x: n.x * (1 + d / r), y: n.y * (1 + d / r), z: n.z * (1 + d / r) }, n, 900);
  } else if (g2) {
    const n = data2.nodes.find((x) => x.id === id);
    if (!n || n.x == null) return;
    const panelW = !isMobile() && !$('panel').hidden ? $('panel').offsetWidth : 0;
    const z = Math.max(g2.zoom(), 2.2);
    g2.centerAt(n.x + panelW / 2 / z, n.y + (isMobile() ? $('stage').clientHeight * 0.3 / z : 0), 700);
    g2.zoom(z, 700);
  }
}

new ResizeObserver(resize).observe($('stage'));
// 그래프 라벨은 캔버스에 그려서, Pretendard 글자가 내려받아지면 다시 그려 준다
document.fonts?.addEventListener?.('loadingdone', () => { if (!G) return; if (g3) style3d(); refresh(); });
gate(load);
