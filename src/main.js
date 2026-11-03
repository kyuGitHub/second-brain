// 글꼴: Pretendard 를 프로젝트 안에 포함 (인터넷 없이도 동작, 필요한 글자 묶음만 불러옴)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import ForceGraph from 'force-graph';
import { gate } from './auth.js';
import { loadGraph, loadNoteHtml, loadHistory, LOCAL } from './data.js';
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/* ───────────── 설정값 ───────────── */
const TYPES = {
  // dark = 어두운 화면(브레인·자유)의 별빛 색. 참고 사이트처럼 크림색이 바탕, 나머지는 포인트 색
  thesis:     { ko: '핵심 주장', en: 'Thesis',     dark: '#c9f23e', light: '#6f8f00' },
  semantic:   { ko: '개념',     en: 'Semantic',   dark: '#fff0d4', light: '#3d3d38' },
  procedural: { ko: '방법',     en: 'Procedural', dark: '#5aa9ff', light: '#2f6fd6' },
  episodic:   { ko: '경험',     en: 'Episodic',   dark: '#ff9a3c', light: '#cf6410' },
  reflective: { ko: '회고',     en: 'Reflective', dark: '#b07cff', light: '#7a4fd0' },
  entity:     { ko: '개체',     en: 'Entity',     dark: '#7fe3ff', light: '#13877a' },
  topic:      { ko: '주제',     en: 'Topic',      dark: '#b9dcff', light: '#c43c6e' },
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
  parent:         { ko: '상위 요구사항', color: '#f3a712', out: '하위 요구사항',        in: '상위 요구사항' },
  index:          { ko: '허브 포함', color: '#d6f24a', out: '허브에 담긴 노트',     in: '이 노트를 담은 허브' },
  meeting:        { ko: '회의에서 다룸', color: '#ffa057', out: '이 회의에서 다룬 노트', in: '이 노트를 다룬 회의' },
  evidence:       { ko: '근거 회의', color: '#ff8a5b', out: '근거가 된 회의',       in: '이 회의를 근거로 한 노트' },
  related:        { ko: '관련 요구사항', color: '#9a988f', out: '관련 요구사항',     in: '관련 요구사항(역방향)', dash: [1, 2] },
  mentions:       { ko: '언급',     color: '#9a988f', out: '본문에서 언급한 노트', in: '이 노트를 언급한 곳 (백링크)', dash: [1, 2] },
  topic:          { ko: '주제',     color: '#ff7aa8', out: '주제',                in: '이 주제의 노트', dash: [3, 3] },
  thesis:         { ko: '핵심 주장', color: '#d6f24a', out: '연결된 핵심 주장',    in: '이 주장에 속한 노트', dash: [3, 3] },
};
const PALETTE = ['#e4572e', '#f3a712', '#a8c256', '#29bf97', '#4fb3d9', '#6a7fdb', '#b06ad9', '#e86fa8', '#c9b18a', '#7fd1b9', '#f78c6b', '#9fa8ff'];
const VIEWS = {
  table:         { ko: '표', light: true, table: true, hint: '요구사항을 표로 봐요. 머리글을 누르면 정렬되고, 왼쪽 카테고리를 고르면 표가 걸러져요. CSV로 내려받을 수 있어요.' },
  brain:         { ko: '브레인 3D', light: false, three: true, hint: '전체 기억을 3D 별자리로 보여줘요. 드래그로 회전, 스크롤로 확대해요. 노드를 누르면 연결된 노트가 강조돼요.' },
  free:          { ko: '자유',     light: false, hint: '노드를 끌어서 배치를 바꿀 수 있어요. 스크롤로 확대해요. 노드를 누르면 연결된 노트가 강조돼요.' },
  constellation: { ko: '별자리',   light: true,  hint: '중심 노드(대분류)를 원 위에 고정하고, 각 노트를 연결된 중심 쪽으로 끌어당겨요.' },
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
  range: [0, 1], hover: null, selected: null,
  stack: [], panel: null,            // 오른쪽 패널: 현재 화면과 뒤로 가기 기록
  scheme: saved.scheme || null, cat: null, catSet: null, expanded: new Set(), // 카테고리 선택
};
const savePrefs = () => { try { localStorage.setItem('sb-prefs', JSON.stringify({ view: state.view, lens: state.lens, colorBy: state.colorBy, spacing: state.spacing, labels: state.labels, scheme: state.scheme })); } catch { /* 저장 불가 환경 */ } };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const idOf = (x) => (typeof x === 'object' && x ? x.id : x);
const rgba = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const dayNum = (d) => (d ? Math.floor(Date.parse(d) / 864e5) : null);

let G = null; // 원본 그래프
// 기능 스위치 (config.json 의 features). 요구사항이 정해지면 true 로 켠다.
//  categories: 왼쪽 렌즈·주제·태그·핵심 주장 목록 / search: 검색창 / reader: 노트 본문 패널
let F = { categories: false, search: false, reader: false };
let reqIndex = new Map(); // 요구사항ID(대문자) → 노드
let HISTORY = [], lastChange = new Map(); // 변경 이력, 노트 key → 가장 최근 변경 { at, fields }
const keyOf = (n) => (n.props?.['요구사항ID'] ? 'req:' + n.props['요구사항ID'] : 'id:' + n.id); // scripts/history.mjs 와 같은 규칙
let labelAlways = new Set(); // 항상 이름을 보여줄 노드 (연결이 많은 색인)
let byId = new Map(), nbr = new Map(), topicColorMap = new Map(), thesisZone = new Set(), dateDomain = [0, 1];
let g2 = null, g3 = null, data2 = null, data3 = null, pendingFit = true, bloom = null;

/* ───────────── 데이터 불러오기 ───────────── */
async function load() {
  try {
    showEmpty('그래프를 불러오는 중이에요…');
    G = await loadGraph();
    $('empty').hidden = true;
  } catch (err) {
    const detail = esc(err?.message || err?.error || String(err || ''));
    showEmpty(LOCAL
      ? '그래프 데이터를 찾지 못했어요.<br>터미널에서 <b>npm run graph</b> 를 먼저 실행해 주세요.'
      : '그래프 데이터를 불러오지 못했어요.<br>아직 노트를 올리기 전이거나, 이 계정에 열람 권한이 없어요.<br>관리자에게 열람 명단 등록을 요청해 주세요.'
        + (detail ? `<br><span style="opacity:.55;font-size:12px">(${detail})</span>` : ''));
    return;
  }
  document.title = G.meta.title;
  $('site-title').textContent = G.meta.title;
  $('site-subtitle').textContent = G.meta.subtitle || '';
  {
    const auxIds = new Set(G.nodes.filter((n) => n.aux).map((n) => n.id));
    $('stat-nodes').textContent = (G.nodes.length - auxIds.size).toLocaleString();
    $('stat-links').textContent = G.links.filter((l) => !auxIds.has(l.source) && !auxIds.has(l.target)).length.toLocaleString();
  }
  // 데이터 신선도: 마지막 업로드가 언제인지, 하루가 넘으면 경고
  {
    const ageH = (Date.now() - Date.parse(G.meta.builtAt)) / 36e5;
    const ago = ageH < 1 ? '1시간 이내' : ageH < 24 ? `${Math.floor(ageH)}시간 전` : `${Math.floor(ageH / 24)}일 전`;
    const stale = ageH > 24;
    $('built-at').textContent = `마지막 업로드 ${new Date(G.meta.builtAt).toLocaleString('ko-KR')}`;
    const badge = document.createElement('span');
    badge.className = 'fresh' + (stale ? ' stale' : '');
    badge.textContent = stale ? `업로드 ${ago} · 최신이 아닐 수 있어요` : `업로드 ${ago}`;
    badge.title = `마지막 업로드 ${new Date(G.meta.builtAt).toLocaleString('ko-KR')}`;
    document.querySelector('.sb-head .stats')?.after(badge);
  }
  F = { ...F, ...(G.meta.features || {}) };
  document.querySelectorAll('[data-feature]').forEach((el) => { el.hidden = !F[el.dataset.feature]; });
  if (!F.categories) state.lens = 'all';
  // config.json 의 typeLabels 로 노드 유형 이름을 바꾼다 (예: thesis → 색인(MOC))
  for (const [k, v] of Object.entries(G.meta.typeLabels || {})) if (TYPES[k]) { TYPES[k].ko = v; TYPES[k].en = ''; }
  if (G.meta.typeLabels?.topic) { EDGES.topic.ko = G.meta.typeLabels.topic; EDGES.topic.out = G.meta.typeLabels.topic; EDGES.topic.in = `이 ${G.meta.typeLabels.topic}의 노트`; }
  LENSES.thesis = `${TYPES.thesis.ko}별`;
  if (!G.nodes.some((n) => n.type === 'thesis' && !n.aux)) delete LENSES.thesis;
  LENSES.topic = `${TYPES.topic.ko}별`;
  if (!G.nodes.some((n) => n.source === 'external')) delete LENSES.source;
  if (!LENSES[state.lens]) state.lens = 'all';
  if (!G.nodes.length) { showEmpty('볼트에서 노트를 찾지 못했어요.<br>config.json 의 vaultPath 를 확인해 주세요.'); return; }

  byId = new Map(G.nodes.map((n) => [n.id, n]));
  reqIndex = new Map(G.nodes.filter((n) => n.props?.['요구사항ID']).map((n) => [String(n.props['요구사항ID']).toUpperCase(), n]));
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

  // 큰 그래프: 저장된 보기가 없으면 2D 로 시작하고, 빽빽한 연결(관련 요구사항·언급)은 기본 숨김
  if (!saved.view) state.view = G.nodes.some((n) => n.props?.['요구사항ID']) ? 'table' : (G.nodes.length > 800 ? 'free' : state.view);
  if (G.links.length > 3000 && !saved.edgesTouched) ['related', 'mentions'].forEach((k) => state.hiddenEdges.add(k));

  // 색인이 많으면 연결이 많은 상위 25개만 항상 이름을 보여준다 (나머지는 확대하면 보임)
  const hubs = G.nodes.filter((n) => n.type === 'thesis' && !n.aux).sort((a, b) => b.degree - a.degree);
  labelAlways = new Set((hubs.length > 40 ? hubs.slice(0, 25) : hubs).map((n) => n.id));

  buildSidebar(topicCount);
  setView(state.view, { initial: true });
  window.addEventListener('hashchange', onHash);
  onHash();
  loadHistory().then((h) => {
    HISTORY = Array.isArray(h) ? h : [];
    lastChange = new Map();
    for (const e of HISTORY) {
      for (const c of e.changed || []) if (!lastChange.has(c.k)) lastChange.set(c.k, { at: e.at, kind: '변경', fields: c.fields });
      for (const c of e.added || []) if (!lastChange.has(c.k)) lastChange.set(c.k, { at: e.at, kind: '추가' });
    }
    if (VIEWS[state.view].table) renderTable();
    if (state.panel?.kind === 'overview') openOverview({ back: true });
  });
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
const nodeVisible = (n) => !n.aux && !state.hiddenTypes.has(n.type) && (!state.catSet || state.catSet.has(n.id)) && (!filterOn() || matchesFilter(n)) && inRange(n);
const linkVisible = (l) => {
  // 숨긴 유형이라도 지금 고른(또는 마우스를 올린) 노드에 닿는 연결은 보여준다
  const focus = state.hover || state.selected;
  if (state.hiddenEdges.has(l.type) && !(focus && (idOf(l.source) === focus || idOf(l.target) === focus))) return false;
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
    .linkLineDash((l) => (G.links.length > 3000 ? null : EDGES[l.type]?.dash || null)) // 점선은 느려서 연결이 많으면 실선
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
  // 빛번짐(그림자)은 비싸서 노드가 많으면 큰 노드에만 쓴다
  if (dark && a > 0.5 && (G.nodes.length < 500 || labelAlways.has(n.id))) { ctx.shadowColor = c; ctx.shadowBlur = n.type === 'thesis' ? 5 : 2; }
  ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fillStyle = c; ctx.fill();
  ctx.shadowBlur = 0;
  if (dark && r > 2.5 && a > 0.5) { ctx.beginPath(); ctx.arc(n.x, n.y, r * 0.42, 0, 2 * Math.PI); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); }
  if (n.type === 'topic' && !dark) { ctx.lineWidth = 1.2 / scale; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  if (state.selected === n.id) { ctx.lineWidth = 2 / scale; ctx.strokeStyle = dark ? '#fff' : '#1b1b18'; ctx.beginPath(); ctx.arc(n.x, n.y, r + 3 / scale + 1, 0, 2 * Math.PI); ctx.stroke(); }

  const focus = state.hover || state.selected;
  const near = focus && (n.id === focus || nbr.get(focus)?.has(n.id));
  const show = state.labels && (near || labelAlways.has(n.id) || (n.type === 'thesis' && scale > 1.4) || (n.type === 'topic' && scale > 0.9) || scale > 2.6 || (!dark && scale > 1.6 && n.degree > 6));
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
    let theses = nodes.filter((n) => n.type === 'thesis' && !n.aux);
    if (!theses.length) theses = nodes.filter((n) => n.type === 'topic');
    const anchorIds = new Set(theses.map((n) => n.id));
    const R = ringRadius();
    theses.forEach((n, i) => { const a = (i / Math.max(1, theses.length)) * 2 * Math.PI - Math.PI / 2; n.fx = Math.cos(a) * R; n.fy = Math.sin(a) * R; n.x = n.fx; n.y = n.fy; });
    const anchor = new Map();
    for (const n of nodes) {
      if (anchorIds.has(n.id)) continue;
      const ts = [...nbr.get(n.id)].map((id) => node2.get(id)).filter((x) => x && anchorIds.has(x.id));
      if (ts.length) anchor.set(n.id, ts);
    }
    g.d3Force('pull', pull((n) => {
      const ts = anchor.get(n.id);
      if (!ts) return anchorIds.has(n.id) ? null : { x: 0, y: 0 };
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
  const m = g === g3 ? 3.4 : 1; // 3D 는 더 넓게 퍼뜨려야 별끼리 겹쳐 하얗게 뭉치지 않는다
  g.d3Force('charge')?.strength(s.charge * m);
  const is3 = g === g3;
  g.d3Force('link')?.distance((l) => (l.type === 'topic' || l.type === 'thesis' ? s.dist * (is3 ? 4.5 : 1.6) : l.type === 'parent' && is3 ? s.dist * 4 : s.dist * (is3 ? 2 : 1)))
    .strength((l) => (state.hiddenEdges.has(l.type) ? 0.005 : l.type === 'topic' ? 0.04 : l.type === 'parent' && is3 ? 0.05 : l.type === 'mentions' ? 0.12 : 0.3)); // 숨긴 연결은 거의 당기지 않고, 3D 에서는 하위 요구사항 묶음을 넓게 // 숨긴 연결은 배치에서도 거의 당기지 않게
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
    .nodeVal((n) => 2 + Math.min(12, n.degree / 6)) // 마우스 판정용 (보이지 않는 구의 크기)
    .nodeVisibility(nodeVisible)
    .linkVisibility(linkVisible)
    .linkWidth(0)
    .nodeLabel((n) => tipHtml(n, true))
    .onNodeHover((n) => { state.hover = n ? n.id : null; el.style.cursor = n ? 'pointer' : ''; refresh3d(); })
    .onNodeClick((n) => openNote(n.id))
    .onBackgroundClick(() => { if (state.selected) closePanel(); })
    .nodeThreeObjectExtend(false)
    .cooldownTicks(220)
    .onEngineStop(() => { if (pendingFit) { pendingFit = false; fillView3d(); } });
  style3d();
  applySpacing(g3);
  try {
    // 별(스프라이트)이 스스로 빛나므로 빛번짐은 은은하게
    const big = G.nodes.length;
    bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth, el.clientHeight), big > 800 ? 0.1 : 0.2, 0.15, 0.7); // 문턱을 높여 옅은 선은 번지지 않게
    g3.postProcessingComposer().addPass(bloom);
  } catch { /* 빛번짐 효과 없이 표시 */ }
  const ctl = g3.controls();
  if (ctl) {
    ctl.autoRotate = true; ctl.autoRotateSpeed = 0.3;
    el.addEventListener('pointerdown', () => { ctl.autoRotate = false; }, { once: true });
  }
  return g3;
}

// 참고 사이트처럼 그물망이 화면을 가득 채우도록, 전체가 들어오게 맞춘 뒤 한 번 더 다가간다
function fillView3d() {
  g3.zoomToFit(600, 10, nodeVisible);
  setTimeout(() => {
    const bb = g3.getGraphBbox(nodeVisible); if (!bb) return;
    const c = { x: (bb.x[0] + bb.x[1]) / 2, y: (bb.y[0] + bb.y[1]) / 2, z: (bb.z[0] + bb.z[1]) / 2 };
    const p = g3.camera().position, k = 0.78;
    g3.cameraPosition({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k, z: c.z + (p.z - c.z) * k }, c, 1400);
  }, 650);
}

// 별 하나 = 흰 중심 → 색 → 투명으로 번지는 빛 (색마다 한 장만 만들어 재사용)
const glowTex = new Map();
function glowTexture(hex) {
  if (glowTex.has(hex)) return glowTex.get(hex);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.26, rgba(hex, 1));
  g.addColorStop(0.36, rgba(hex, 0.45));
  g.addColorStop(0.46, rgba(hex, 0.05));
  g.addColorStop(0.58, rgba(hex, 0));
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  glowTex.set(hex, t); return t;
}
// 별 크기 = 화면 높이 대비 비율 (거리와 상관없이 일정: 보통 약 9px, 허브 약 20px)
const starSize = (n) => (n.type === 'topic' ? 0.019 : n.type === 'thesis' ? 0.017 : 0.0088 + Math.min(0.008, Math.sqrt(n.degree) * 0.001));
function starAlpha(n) { return nodeAlpha(n) < 0.5 ? 0.1 : n.type === 'topic' || n.type === 'thesis' ? 1 : 0.9; }

// 연결선: 출발 노드의 색으로 아주 옅게 (색·투명도마다 재질 하나)
const lineMats = new Map();
function lineMat(hex, op) {
  const key = hex + op;
  if (!lineMats.has(key)) lineMats.set(key, new THREE.LineBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: op, depthWrite: false })); // 더하기 혼합이면 수백 개 선이 모이는 허브가 하얗게 타서 일반 혼합
  return lineMats.get(key);
}
function link3dMat(l) {
  const s = byId.get(idOf(l.source)), t = byId.get(idOf(l.target));
  const focus = state.hover || state.selected;
  const hex = nodeColor(s?.type === 'topic' && t ? t : s || t);
  if (focus) return (idOf(l.source) === focus || idOf(l.target) === focus) ? lineMat(hex, 0.75) : lineMat(hex, 0.025);
  if (l.type === 'topic') return lineMat(hex, 0.025); // 대분류 → 노트 바큇살은 아주 옅게
  if (l.type === 'parent') return lineMat(hex, 0.045);
  const weak = l.type === 'mentions' || l.type === 'related';
  return lineMat(hex, weak ? 0.06 : 0.13);
}

function style3d() {
  g3.linkMaterial(link3dMat)
    .nodeThreeObject((n) => {
      const grp = new THREE.Group();
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(nodeColor(n)), depthWrite: false, transparent: true, opacity: starAlpha(n) })); // 일반 혼합: 별이 겹쳐도 하얗게 타지 않음
      sp.material.sizeAttenuation = false;
      const sz = starSize(n); sp.scale.set(sz, sz, 1);
      grp.add(sp); n.__sp = sp; n.__hex = nodeColor(n);
      // 이름은 대분류·허브만, 작고 옅은 회색으로 (참고 사이트처럼 별 옆에 조용히)
      if (state.labels && (n.type === 'topic' || labelAlways.has(n.id))) {
        const t = new SpriteText(n.title.length > 24 ? n.title.slice(0, 23) + '…' : n.title);
        t.color = 'rgba(214,211,200,0.85)'; t.fontFace = 'Pretendard Variable, Malgun Gothic, sans-serif'; t.fontWeight = '500';
        t.textHeight = 0.016; // 화면 높이 대비 크기 (거리와 상관없이 약 13px)
        t.material.sizeAttenuation = false; t.material.depthWrite = false; t.material.depthTest = false;
        t.center.set(-0.08, 0.5); // 별 오른쪽에 붙여서
        t.renderOrder = 10;
        grp.add(t); n.__label = t;
      }
      return grp;
    });
}
function refresh3d() {
  if (!g3) return;
  for (const n of data3.nodes) {
    const sp = n.__sp; if (!sp) continue;
    const hex = nodeColor(n);
    if (hex !== n.__hex) { sp.material.map = glowTexture(hex); sp.material.needsUpdate = true; n.__hex = hex; }
    sp.material.opacity = starAlpha(n);
    if (n.__label) n.__label.material.opacity = starAlpha(n) < 1 ? 0.15 : 1;
  }
  g3.linkMaterial(link3dMat);
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
  const three = !!VIEWS[v].three, table = !!VIEWS[v].table;
  $('graph3d').hidden = !three;
  $('graph2d').hidden = three || table;
  $('table-view').hidden = !table;
  $('stage').classList.toggle('light', VIEWS[v].light);
  $('timeline-bar').hidden = v !== 'timeline';
  $('view-hint').textContent = VIEWS[v].hint;
  segActive('view-seg', v);
  resize();
  // 숨겨진 3D 는 그리기를 멈춰서 컴퓨터 부담을 줄인다
  if (three) { g3.resumeAnimation(); pendingFit = true; refresh3d(); if (!initial) g3.d3ReheatSimulation(); }
  else if (table) { g3?.pauseAnimation(); g2?.pauseAnimation?.(); renderTable(); }
  else { g3?.pauseAnimation(); g2?.resumeAnimation?.(); applyLayout2d(); }
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

  // 카테고리 트리
  initCategories();

  // 노드 유형
  const typeCount = countBy(G.nodes.filter((n) => !n.aux).map((n) => n.type));
  $('type-legend').innerHTML = Object.entries(TYPES).filter(([k]) => typeCount.has(k)).map(([k, t]) =>
    `<li data-k="${k}"><span class="dot" style="background:${t.light}"></span><span class="name">${t.ko}<span class="en">${t.en}</span></span><span class="n">${typeCount.get(k)}</span></li>`).join('');
  $('type-legend').onclick = (e) => toggleLegend(e, state.hiddenTypes);

  // 연결 유형
  const edgeCount = countBy(G.links.map((l) => l.type));
  $('edge-legend').innerHTML = Object.entries(EDGES).filter(([k]) => edgeCount.has(k)).map(([k, t]) =>
    `<li data-k="${k}"><span class="ln${t.dash ? (k === 'mentions' ? ' dot2' : ' dash') : ''}" style="border-color:${darken(t.color)}"></span><span class="name">${t.ko}<span class="en">${k}</span></span><span class="n">${edgeCount.get(k)}</span></li>`).join('');
  $('edge-legend').onclick = (e) => toggleLegend(e, state.hiddenEdges);
  $('edge-legend').querySelectorAll('li').forEach((li) => li.classList.toggle('off', state.hiddenEdges.has(li.dataset.k)));

  // 보기 / 색상 / 간격
  seg('view-seg', Object.fromEntries(Object.entries(VIEWS).map(([k, v]) => [k, v.ko])), state.view, (k) => setView(k));
  seg('color-seg', { type: '유형', topic: '주제' }, state.colorBy, (k) => { state.colorBy = k; savePrefs(); refresh(); });
  seg('spacing-seg', Object.fromEntries(Object.entries(SPACING).map(([k, v]) => [k, v.ko])), state.spacing, (k) => {
    state.spacing = k; savePrefs();
    if (g2) applySpacing(g2);
    if (g3) { applySpacing(g3); pendingFit = true; g3.d3ReheatSimulation(); }
    if (!VIEWS[state.view].three && !VIEWS[state.view].table) applyLayout2d();
  });
  $('recenter').onclick = () => { if (VIEWS[state.view].table) return; if (VIEWS[state.view].three) fillView3d(); else g2?.zoomToFit(500, 70, nodeVisible); };
  const lbl = $('toggle-labels');
  lbl.textContent = state.labels ? '라벨 숨기기' : '라벨 보이기';
  lbl.onclick = () => { state.labels = !state.labels; savePrefs(); lbl.textContent = state.labels ? '라벨 숨기기' : '라벨 보이기'; if (g3) style3d(); refresh(); };

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
  refresh();
  pendingFit = true;
  if (VIEWS[state.view].table) renderTable();
  else if (VIEWS[state.view].three) g3?.zoomToFit(600, 40, nodeVisible);
  else setTimeout(() => g2?.zoomToFit(500, 70, nodeVisible), 50);
}
function toggleLegend(e, set) {
  const li = e.target.closest('li'); if (!li) return;
  if (set === state.hiddenEdges) { saved.edgesTouched = true; }
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

/* ───────────── 카테고리 트리 ───────────── */
const catDefs = () => G?.meta?.categories || [];
const catLabel = (name) => String(name).replace(/^\d+_/, ''); // "10_회의록&인터뷰" → "회의록&인터뷰"
const pathKey = (scheme, path) => scheme + '::' + path.join('\u0001');
let catTree = null;

function initCategories() {
  const defs = catDefs();
  if (!defs.length) { document.querySelectorAll('[data-feature="categories"]').forEach((el) => { if (el.querySelector('#cat-tree')) el.hidden = true; }); return; }
  if (!defs.some((d) => d.key === state.scheme)) state.scheme = defs[0].key;
  const tabs = $('cat-scheme');
  tabs.innerHTML = defs.map((d) => `<button type="button" role="tab" data-k="${esc(d.key)}">${esc(d.label)}</button>`).join('');
  tabs.onclick = (e) => { const b = e.target.closest('button'); if (!b || b.dataset.k === state.scheme) return; setScheme(b.dataset.k); clearCat(); if (state.panel?.kind === 'list') closePanel(); };
  $('cat-clear').onclick = () => { clearCat(); if (state.panel?.kind === 'list') closePanel(); };
  $('cat-tree').onclick = (e) => {
    const row = e.target.closest('.ct-row'); if (!row) return;
    const path = JSON.parse(row.dataset.path);
    if (e.target.closest('.ct-tog')) { toggleExpand(path); return; }
    if (!path.length) { clearCat(); if (state.panel?.kind === 'list') closePanel(); return; }
    const same = state.cat && state.cat.scheme === state.scheme && pathKey(state.scheme, state.cat.path) === pathKey(state.scheme, path);
    if (same && state.panel?.kind === 'list') { clearCat(); closePanel(); return; }
    selectCat(path);
    closeSidebarMobile();
  };
  $('cat-tree').onkeydown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.ct-row'); if (!row) return;
    e.preventDefault(); row.click();
  };
  setScheme(state.scheme);
}

function setScheme(key) {
  state.scheme = key; savePrefs();
  $('cat-scheme').querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b.dataset.k === key); b.setAttribute('aria-selected', String(b.dataset.k === key)); });
  buildTree();
}

function buildTree() {
  const root = { name: '', ids: new Set(), children: new Map() };
  for (const n of G.nodes) {
    if (n.type === 'topic') continue;
    for (const p of n.cats?.[state.scheme] || []) {
      let node = root; root.ids.add(n.id);
      for (const part of p) {
        if (!node.children.has(part)) node.children.set(part, { name: part, ids: new Set(), children: new Map() });
        node = node.children.get(part); node.ids.add(n.id);
      }
    }
  }
  catTree = root;
  renderTree();
}

function findCat(path) {
  let node = catTree;
  for (const part of path) { node = node?.children.get(part); if (!node) return null; }
  return node;
}

function renderTree() {
  const byName = state.scheme === 'folder' || state.scheme === 'domain';
  const sortKids = (m) => [...m.values()].sort((a, b) => (a.name === '(미분류)') - (b.name === '(미분류)')
    || (byName ? a.name.localeCompare(b.name, 'ko', { numeric: true }) : b.ids.size - a.ids.size || a.name.localeCompare(b.name, 'ko')));
  const selKey = state.cat && state.cat.scheme === state.scheme ? pathKey(state.scheme, state.cat.path) : null;
  const rows = (node, path, depth) => sortKids(node.children).map((c) => {
    const p = [...path, c.name], key = pathKey(state.scheme, p);
    const open = state.expanded.has(key);
    const kids = c.children.size;
    return `<div class="ct-item" role="treeitem" ${kids ? `aria-expanded="${open}"` : ''} aria-selected="${key === selKey}">
      <div class="ct-row${key === selKey ? ' on' : ''}" tabindex="0" data-path="${esc(JSON.stringify(p))}" style="padding-left:${6 + depth * 14}px">
        ${kids ? `<button type="button" class="ct-tog" aria-label="${open ? '접기' : '펼치기'}">${open ? '▾' : '▸'}</button>` : '<span class="ct-sp"></span>'}
        <span class="ct-name" title="${esc(c.name)}">${esc(catLabel(c.name))}</span><span class="ct-n">${c.ids.size}</span>
      </div>
      ${kids && open ? `<div class="ct-kids" role="group">${rows(c, p, depth + 1)}</div>` : ''}
    </div>`;
  }).join('');
  $('cat-tree').innerHTML = `<div class="ct-row ct-all${selKey ? '' : ' on'}" tabindex="0" data-path="[]"><span class="ct-sp"></span><span class="ct-name">전체 ${esc(catDefs().find((d) => d.key === state.scheme)?.label || '문서')}</span><span class="ct-n">${catTree.ids.size}</span></div>` + rows(catTree, [], 0);
  $('cat-clear').hidden = !state.cat;
}

function toggleExpand(path) {
  const key = pathKey(state.scheme, path);
  state.expanded.has(key) ? state.expanded.delete(key) : state.expanded.add(key);
  renderTree();
}

// 카테고리를 고르면: 그래프는 그 분류의 노트(+연결된 대분류 노드)만, 오른쪽엔 문서 목록
function applyCat(scheme, path) {
  if (scheme !== state.scheme) setScheme(scheme);
  const node = findCat(path);
  if (!node) { clearCat(); return false; }
  state.cat = { scheme, path };
  const set = new Set(node.ids);
  for (const id of node.ids) for (const nb of nbr.get(id) || []) if (byId.get(nb)?.type === 'topic') set.add(nb);
  state.catSet = set;
  for (let i = 1; i < path.length; i++) state.expanded.add(pathKey(scheme, path.slice(0, i))); // 상위 항목 펼치기
  renderTree();
  onFilterChange();
  return true;
}
function selectCat(path) {
  if (!applyCat(state.scheme, path)) return;
  setHash('#/cat/' + [state.scheme, ...path].map(encodeURIComponent).join('/'));
  if (VIEWS[state.view].table) return; // 표 보기에서는 표가 걸러지는 것으로 충분
  listLimit = 200; openList();
}
function setHash(h) { try { history.replaceState(null, '', h || location.pathname + location.search); } catch { /* 무시 */ } }
function clearCat() {
  state.cat = null; state.catSet = null;
  if (location.hash.startsWith('#/cat/')) setHash('');
  renderTree();
  onFilterChange();
}

/* ───────────── 문서 목록 (카테고리별로 글 보기) ───────────── */
let listLimit = 200, listSort = 'id', listQuery = '', listFilter = { 결과: 'all', 유형: 'all' };
let listCtx = null; // { eyebrow, title, ids }
function openList({ back = false } = {}) {
  if (!state.cat || !F.reader) return;
  const def = catDefs().find((d) => d.key === state.cat.scheme);
  listCtx = { eyebrow: `카테고리 · ${def?.label || ''}`, titleHtml: state.cat.path.map((p) => esc(catLabel(p))).join(' <span class="crumb">›</span> '), ids: [...(findCat(state.cat.path)?.ids || [])] };
  showListPanel({ kind: 'list', scheme: state.cat.scheme, path: state.cat.path }, back);
}
function openCustomList(eyebrow, title, ids, { back = false } = {}) {
  listCtx = { eyebrow, titleHtml: esc(title), ids };
  showListPanel({ kind: 'custom', eyebrow, title, ids }, back);
}
function showListPanel(entry, back) {
  if (!back && state.panel && !(state.panel.kind === entry.kind && JSON.stringify(state.panel) === JSON.stringify(entry))) state.stack.push(state.panel);
  state.panel = entry;
  state.selected = null;
  $('node-card').hidden = true;
  if (/^#\/(note|req)\//.test(location.hash)) setHash(state.cat ? '#/cat/' + [state.cat.scheme, ...state.cat.path].map(encodeURIComponent).join('/') : '');
  $('panel').hidden = false;
  $('panel-back').disabled = !state.stack.length;
  listQuery = '';
  listLimit = 200;
  listFilter = { 결과: 'all', 유형: 'all' };
  $('panel-body').innerHTML = `
    <div class="p-type">${esc(listCtx.eyebrow)}</div>
    <h2 class="p-title">${listCtx.titleHtml}</h2>
    <div class="list-tools">
      <input type="search" id="list-q" placeholder="이 목록에서 찾기" autocomplete="off" />
      <div class="seg list-sort" role="group" aria-label="정렬">
        <button type="button" data-sort="id">ID순</button><button type="button" data-sort="name">이름순</button><button type="button" data-sort="links">연결 많은 순</button>
      </div>
      <div class="list-filters" id="list-filters"></div>
    </div>
    <div id="list-box"></div>`;
  $('list-q').oninput = (e) => { listQuery = e.target.value.trim().toLowerCase(); listLimit = 200; renderList(); };
  renderList();
  $('panel-body').scrollTop = 0;
  refresh();
}
function renderList() {
  const box = $('list-box'); if (!box || !listCtx) return;
  let items = listCtx.ids.map((id) => byId.get(id)).filter(Boolean);
  // 요구사항이 들어 있는 목록이면 처리결과·개발유형 필터를 보여준다
  const fbox = $('list-filters');
  const reqItems = items.filter((n) => n.props?.['요구사항ID']);
  if (fbox) {
    if (reqItems.length) {
      const cnt = (f) => countBy(reqItems.map(f));
      const res = cnt((n) => (n.props['처리결과'] === '취소선' ? '취소' : '유지'));
      const dev = cnt((n) => n.props['개발유형'] || '미지정');
      const chips = (group, map) => ['all', ...map.keys()].map((k) => `<button type="button" class="chip${listFilter[group] === k ? ' on' : ''}" data-lf="${group}" data-v="${esc(k)}">${k === 'all' ? '전체' : esc(k)}${k === 'all' ? '' : `<span class="n">${map.get(k)}</span>`}</button>`).join('');
      fbox.innerHTML = `<div class="lf-row"><span class="lf-l">처리결과</span>${chips('결과', res)}</div><div class="lf-row"><span class="lf-l">개발유형</span>${chips('유형', dev)}</div>`;
    } else fbox.innerHTML = '';
  }
  if (listFilter.결과 !== 'all') items = items.filter((n) => (n.props?.['처리결과'] === '취소선' ? '취소' : '유지') === listFilter.결과 && n.props?.['요구사항ID']);
  if (listFilter.유형 !== 'all') items = items.filter((n) => (n.props?.['개발유형'] || '미지정') === listFilter.유형 && n.props?.['요구사항ID']);
  if (listQuery) items = items.filter((n) => (n.title + ' ' + Object.values(n.props || {}).join(' ')).toLowerCase().includes(listQuery));
  const idKey = (n) => n.props?.['요구사항ID'] || '\uffff' + n.title;
  const cmp = {
    id: (a, b) => idKey(a).localeCompare(idKey(b), 'en', { numeric: true }),
    name: (a, b) => a.title.localeCompare(b.title, 'ko', { numeric: true }),
    recent: (a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.title.localeCompare(b.title, 'ko'),
    links: (a, b) => b.degree - a.degree || a.title.localeCompare(b.title, 'ko'),
  }[listSort];
  items.sort(cmp);
  document.querySelectorAll('.list-sort button').forEach((b) => b.classList.toggle('on', b.dataset.sort === listSort));
  const shown = items.slice(0, listLimit);
  box.innerHTML = `<div class="list-count">문서 ${items.length.toLocaleString()}개</div>`
    + (items.length ? shown.map((n) => {
      const sub = (n.props?.['요구사항ID']
        ? [n.props['요구사항ID'], n.props['대분류'], n.props['중분류'], n.props['개발유형']]
        : [n.docType, n.date]).filter(Boolean).map(esc).join(' · ');
      const cancel = n.props?.['처리결과'] === '취소선';
      return `<button type="button" class="li-item${cancel ? ' cancel' : ''}" data-id="${n.id}">
        <span class="dot" style="background:${TYPES[n.type]?.light}"></span>
        <span class="li-main"><span class="li-t">${esc(n.title)}</span><span class="li-s">${sub}</span></span>
        ${cancel ? '<span class="li-badge">취소</span>' : ''}
      </button>`;
    }).join('') : '<p class="hint">조건에 맞는 문서가 없어요.</p>')
    + (items.length > shown.length ? `<button type="button" class="ghost-btn more-btn" data-more="1">${(items.length - shown.length).toLocaleString()}개 더 보기</button>` : '');
}

// 노트 속성표 (요구사항ID, 업무, 대분류 등 프런트매터 값)
function propsHtml(n) {
  const entries = Object.entries(n.props || {}).filter(([k]) => k !== 'updated');
  if (!entries.length) return '';
  return `<dl class="props">${entries.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}

/* ───────────── 개요 (첫 화면) ───────────── */
function openOverview({ back = false } = {}) {
  if (!F.reader || !G) return;
  if (!back && state.panel && state.panel.kind !== 'overview') state.stack.push(state.panel);
  state.panel = { kind: 'overview' };
  state.selected = null;
  $('node-card').hidden = true;
  $('panel').hidden = false;
  $('panel-back').disabled = !state.stack.length;

  const notes = G.nodes.filter((n) => n.type !== 'topic' && !n.aux);
  const reqs = notes.filter((n) => n.props?.['요구사항ID']);
  const meetings = notes.filter((n) => n.cats?.mtg?.length);
  const devCount = countBy(reqs.map((n) => n.props['개발유형'] || '미지정'));
  const linkTypesOf = new Map(notes.map((n) => [n.id, new Set()]));
  for (const l of G.links) {
    if (l.type === 'topic') continue;
    linkTypesOf.get(l.source)?.add(l.type + ':out');
    linkTypesOf.get(l.target)?.add(l.type + ':in');
  }
  const hasMeeting = (n) => { const t = linkTypesOf.get(n.id); return t.has('evidence:out') || t.has('meeting:in'); };
  const reqNoMeeting = reqs.filter((n) => !hasMeeting(n));
  const nonMeeting = notes.filter((n) => n.type !== 'episodic');
  const covered = nonMeeting.filter(hasMeeting).length;
  const orphans = notes.filter((n) => !linkTypesOf.get(n.id).size);
  const brokenNotes = notes.filter((n) => n.broken > 0);
  const brokenSum = brokenNotes.reduce((a, n) => a + n.broken, 0);
  const noDomain = reqs.filter((n) => !n.props?.['대분류']);
  const cancelled = reqs.filter((n) => n.props?.['처리결과'] === '취소선');
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  const bizCount = countBy(reqs.flatMap((n) => (n.cats?.req || []).map((p) => p[0])));
  const maxBiz = Math.max(1, ...bizCount.values());
  const typeCount = countBy(notes.map((n) => n.docType || '(없음)'));
  const viewed = loadRecent().map((id) => byId.get(id)).filter(Boolean);
  const recent = viewed.length ? viewed.slice(0, 8) : notes.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.title.localeCompare(b.title, 'ko')).slice(0, 8);

  window.__ov = { reqNoMeeting, orphans, brokenNotes, noDomain, cancelled }; // 점검 목록 열기용
  const tile = (n, label, sub = '') => `<div class="ov-tile"><div class="ov-n">${n.toLocaleString()}</div><div class="ov-l">${label}</div>${sub ? `<div class="ov-s">${sub}</div>` : ''}</div>`;
  const check = (key, label, n, total, note) => `<button type="button" class="ov-check" data-ov="${key}" ${n ? '' : 'disabled'}>
      <span class="ov-check-l">${label}<span class="ov-check-s">${note}</span></span>
      <span class="ov-check-n${n ? ' warn' : ''}">${n.toLocaleString()}${total ? `<small> / ${total.toLocaleString()}</small>` : ''}</span></button>`;

  $('panel-body').innerHTML = `
    <div class="p-type">개요 · 마지막 갱신 ${new Date(G.meta.builtAt).toLocaleString('ko-KR')}</div>
    <h2 class="p-title">${esc(G.meta.subtitle || G.meta.title)}</h2>
    <div class="ov-tiles">
      ${tile(reqs.length, '요구사항', `유지 ${reqs.length - cancelled.length} · 취소 ${cancelled.length}`)}
      ${tile(meetings.length, '회의록·인터뷰', `업무회의 ${typeCount.get('회의록') || 0} · 인터뷰 ${(typeCount.get('인터뷰') || 0) + (typeCount.get('개발사인터뷰') || 0)}`)}
      ${tile(devCount.get('신규') || 0, '신규 개발')}
      ${tile((devCount.get('기존변경') || 0) + (devCount.get('기존유지') || 0), '기존 변경·유지', `개발유형 미지정 ${devCount.get('미지정') || 0}`)}
    </div>

    <h3 class="ov-h">업무 영역별 요구사항</h3>
    <div class="ov-bars">${[...bizCount.entries()].map(([k, v]) => `
      <button type="button" class="ov-bar" data-biz="${esc(k)}"><span class="ov-bar-l">${esc(k)}</span>
        <span class="ov-bar-track"><span style="width:${pct(v, maxBiz)}%"></span></span><span class="ov-bar-n">${v}</span></button>`).join('')}
    </div>

    ${changesOverviewHtml()}

    <h3 class="ov-h">추적성</h3>
    <div class="ov-meter"><div class="ov-meter-bar"><span style="width:${pct(covered, nonMeeting.length)}%"></span></div>
      <p>회의·인터뷰와 이어진 문서 <b>${pct(covered, nonMeeting.length)}%</b> (${covered.toLocaleString()} / ${nonMeeting.length.toLocaleString()})</p></div>

    <h3 class="ov-h">데이터 점검 <span class="ov-h-s">눌러서 목록 보기</span></h3>
    <div class="ov-checks">
      ${check('reqNoMeeting', '회의 근거가 없는 요구사항', reqNoMeeting.length, reqs.length, '회의록·인터뷰와 연결되지 않음')}
      ${check('noDomain', '대분류가 비어 있는 요구사항', noDomain.length, reqs.length, '카테고리에서 업무 바로 아래에 보임')}
      ${check('brokenNotes', '깨진 링크가 있는 문서', brokenNotes.length, 0, `없는 노트를 가리키는 링크 ${brokenSum.toLocaleString()}개`)}
      ${check('orphans', '아무 연결도 없는 문서', orphans.length, 0, '그래프에서 혼자 떨어져 있음')}
      ${check('cancelled', '취소된 요구사항', cancelled.length, 0, '처리결과: 취소선')}
    </div>

    <h3 class="ov-h">${viewed.length ? '최근 본 문서' : '최근 수정'}</h3>
    <div class="ov-recent">${recent.map((n) => `<button type="button" class="li-item" data-id="${n.id}"><span class="dot" style="background:${TYPES[n.type]?.light}"></span>
      <span class="li-main"><span class="li-t">${esc(n.title)}</span><span class="li-s">${[n.docType, n.date].filter(Boolean).map(esc).join(' · ')}</span></span></button>`).join('')}</div>`;
  $('panel-body').scrollTop = 0;
  refresh();
}

$('panel-body').addEventListener('click', (e) => {
  const ov = e.target.closest('[data-ov]');
  if (ov) {
    const labels = { reqNoMeeting: '회의 근거가 없는 요구사항', noDomain: '대분류가 비어 있는 요구사항', brokenNotes: '깨진 링크가 있는 문서', orphans: '아무 연결도 없는 문서', cancelled: '취소된 요구사항' };
    const list = window.__ov?.[ov.dataset.ov] || [];
    openCustomList('데이터 점검', labels[ov.dataset.ov], list.map((n) => n.id));
    return;
  }
  const hc = e.target.closest('[data-hist]');
  if (hc) {
    const h = HISTORY[Number(hc.dataset.hist)]; if (!h) return;
    const keys = new Set([...(h.added || []), ...(h.changed || [])].map((c) => c.k));
    const ids = G.nodes.filter((n) => !n.aux && keys.has(keyOf(n))).map((n) => n.id);
    openCustomList('변경 이력', `${fmtWhen(h.at)} 업로드에서 추가·변경된 문서`, ids);
    return;
  }
  const biz = e.target.closest('[data-biz]');
  if (biz && catDefs().some((d) => d.key === 'req')) { if (applyCat('req', [biz.dataset.biz])) openList(); }
});

/* ───────────── 변경 이력 ───────────── */
const fmtWhen = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); };
function changesOverviewHtml() {
  if (!HISTORY.length) return `<h3 class="ov-h">최근 변경</h3><p class="hint" style="margin:0">아직 변경 이력이 없어요. 다음 업로드부터 추가·변경·삭제가 기록돼요.</p>`;
  const rows = HISTORY.slice(0, 6).map((h, i) => h.baseline
    ? `<div class="hist-row base"><span class="hist-when">${esc(fmtWhen(h.at))}</span><span class="hist-base">기록 시작 · 문서 ${(h.total || 0).toLocaleString()}개</span></div>`
    : `<button type="button" class="hist-row" data-hist="${i}" ${h.added.length + h.changed.length ? '' : 'disabled'}><span class="hist-when">${esc(fmtWhen(h.at))}</span>
        <span class="hist-counts"><span class="c-add">+${h.added.length}</span><span class="c-chg">~${h.changed.length}</span><span class="c-del">−${h.removed.length}</span></span></button>`).join('');
  return `<h3 class="ov-h">최근 변경 <span class="ov-h-s">업로드별 · 추가 / 변경 / 삭제</span></h3><div class="hist-list">${rows}</div>`;
}
function historyHtml(n) {
  if (n.type === 'topic' || n.aux) return '';
  const k = keyOf(n);
  const items = [];
  for (const h of HISTORY) {
    if (h.baseline) continue;
    const c = (h.changed || []).find((x) => x.k === k);
    if (c) items.push({ at: h.at, html: c.fields.map((f) => f.f === '본문' ? '<li><b>본문</b>이 바뀌었어요</li>'
      : `<li><b>${esc(f.f)}</b> <span class="h-from">${esc(f.from || '(빈 값)')}</span> → <span class="h-to">${esc(f.to || '(빈 값)')}</span></li>`).join('') });
    else if ((h.added || []).some((x) => x.k === k)) items.push({ at: h.at, html: '<li>새로 추가됐어요</li>' });
  }
  const since = HISTORY.length ? fmtWhen(HISTORY[HISTORY.length - 1].at) : '';
  return `<div class="hist"><h4>변경 이력</h4>${items.length
    ? items.slice(0, 20).map((it) => `<div class="hist-item"><div class="hist-when">${esc(fmtWhen(it.at))}</div><ul>${it.html}</ul></div>`).join('')
    : `<p class="hint" style="margin:0">${HISTORY.length ? `${esc(since)} 이후 기록된 변경이 없어요.` : '변경 이력은 다음 업로드부터 기록돼요.'}</p>`}</div>`;
}

/* ───────────── 요구사항 표 ───────────── */
const T_COLS = [
  { k: 'id', label: '요구사항 ID', get: (n) => n.props?.['요구사항ID'] || '' },
  { k: 'name', label: '요구사항명', get: (n) => n.props?.['요구정의명'] || n.title.replace(/^REQ-[A-Z]+-\d+\s*/, '') },
  { k: 'biz', label: '업무', get: (n) => n.props?.['업무'] || '' },
  { k: 'd1', label: '대분류', get: (n) => n.props?.['대분류'] || '' },
  { k: 'd2', label: '중분류', get: (n) => n.props?.['중분류'] || '' },
  { k: 'dev', label: '개발유형', get: (n) => n.props?.['개발유형'] || '' },
  { k: 'res', label: '처리결과', get: (n) => (n.props?.['처리결과'] === '취소선' ? '취소' : n.props?.['처리결과'] || '') },
  { k: 'links', label: '연결', get: (n) => n.degree, num: true },
  { k: 'chg', label: '최근 변경', get: (n) => (lastChange.get(keyOf(n))?.at || '').slice(0, 10) },
];
let tSort = { k: 'id', dir: 1 }, tQuery = '', tRes = 'all', tDev = 'all', tChg = 'all';
function tableRows() {
  let rows = G.nodes.filter((n) => !n.aux && n.props?.['요구사항ID'] && (!state.catSet || state.catSet.has(n.id)));
  if (tRes !== 'all') rows = rows.filter((n) => T_COLS[6].get(n) === tRes);
  if (tDev !== 'all') rows = rows.filter((n) => (T_COLS[5].get(n) || '미지정') === tDev);
  if (tChg !== 'all') { const since = new Date(Date.now() - Number(tChg) * 864e5).toISOString(); rows = rows.filter((n) => (lastChange.get(keyOf(n))?.at || '') >= since); }
  if (tQuery) rows = rows.filter((n) => (n.title + ' ' + Object.values(n.props || {}).join(' ') + ' ' + (n.search || '')).toLowerCase().includes(tQuery));
  const col = T_COLS.find((c) => c.k === tSort.k);
  rows.sort((a, b) => (col.num ? col.get(a) - col.get(b) : String(col.get(a)).localeCompare(String(col.get(b)), 'ko', { numeric: true })) * tSort.dir
    || T_COLS[0].get(a).localeCompare(T_COLS[0].get(b), 'en', { numeric: true }));
  return rows;
}
function renderTable() {
  const box = $('table-view'); if (!box || !G || !VIEWS[state.view].table) return;
  const all = G.nodes.filter((n) => !n.aux && n.props?.['요구사항ID']);
  const scope = state.cat ? state.cat.path.map(catLabel).join(' › ') : '전체 요구사항';
  const rows = tableRows();
  const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  const devs = [...countBy(all.map((n) => T_COLS[5].get(n) || '미지정')).keys()];
  const focusedQ = document.activeElement?.id === 't-q';
  box.innerHTML = `
    <div class="t-head">
      <div><div class="t-eyebrow">요구사항 표${state.cat && state.cat.scheme !== 'req' ? ' · 회의록 분류는 표에 적용되지 않아요' : ''}</div><h2 class="t-title">${esc(scope)}</h2></div>
      <div class="t-tools">
        <input type="search" id="t-q" placeholder="표 안에서 찾기" value="${esc(tQuery)}" autocomplete="off" />
        <select id="t-res" aria-label="처리결과">${opt('all', tRes, '처리결과 전체')}${opt('유지', tRes, '유지')}${opt('취소', tRes, '취소')}</select>
        <select id="t-dev" aria-label="개발유형">${opt('all', tDev, '개발유형 전체')}${devs.map((d) => opt(d, tDev, d)).join('')}</select>
        <select id="t-chg" aria-label="최근 변경">${opt('all', tChg, '변경 전체')}${opt('7', tChg, '최근 7일 변경')}${opt('30', tChg, '최근 30일 변경')}</select>
        <button type="button" class="ghost-btn" id="t-csv">CSV 내려받기</button>
      </div>
    </div>
    <div class="t-count">${rows.length.toLocaleString()}건${rows.length !== all.length ? ` / 전체 ${all.length.toLocaleString()}건` : ''}</div>
    <div class="t-wrap"><table class="req-table">
      <thead><tr>${T_COLS.map((c) => `<th data-k="${c.k}" class="${c.num ? 'num' : ''}" aria-sort="${tSort.k === c.k ? (tSort.dir > 0 ? 'ascending' : 'descending') : 'none'}">${c.label}${tSort.k === c.k ? (tSort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((n) => `<tr data-id="${n.id}" class="${T_COLS[6].get(n) === '취소' ? 'cancel' : ''}${state.selected === n.id ? ' on' : ''}" tabindex="0">${T_COLS.map((c) => `<td class="${c.num ? 'num' : ''} c-${c.k}">${esc(c.get(n))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>${rows.length ? '' : '<p class="hint" style="padding:16px">조건에 맞는 요구사항이 없어요.</p>'}</div>`;
  const q = $('t-q');
  q.oninput = () => { tQuery = q.value.trim().toLowerCase(); clearTimeout(q._t); q._t = setTimeout(renderTable, 180); };
  if (focusedQ) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  $('t-res').onchange = (e) => { tRes = e.target.value; renderTable(); };
  $('t-dev').onchange = (e) => { tDev = e.target.value; renderTable(); };
  $('t-chg').onchange = (e) => { tChg = e.target.value; renderTable(); };
  $('t-csv').onclick = () => downloadCsv(rows);
}
$('table-view').addEventListener('click', (e) => {
  const th = e.target.closest('th[data-k]');
  if (th) { tSort = { k: th.dataset.k, dir: tSort.k === th.dataset.k ? -tSort.dir : 1 }; renderTable(); return; }
  const tr = e.target.closest('tr[data-id]');
  if (tr) openNote(tr.dataset.id);
});
$('table-view').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const tr = e.target.closest('tr[data-id]'); if (tr) openNote(tr.dataset.id);
});
function downloadCsv(rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [T_COLS.map((c) => q(c.label)).join(','), ...rows.map((n) => T_COLS.map((c) => q(c.get(n))).join(','))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }); // 엑셀에서 한글이 깨지지 않도록 BOM
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  // 한글 파일 이름은 일부 브라우저에서 'download' 로 바뀌어서 영문으로 둔다
  a.download = `RIS_requirements_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`${rows.length.toLocaleString()}건을 CSV로 내려받았어요`);
}

/* ───────────── 작은 도우미들 ───────────── */
// 요구사항의 분류 경로: ADMIN › 주택담보대출 › 심사 (누르면 그 분류로)
function crumbHtml(n) {
  const p = n.cats?.req?.[0];
  if (!p || !p.length) return '';
  return `<nav class="p-crumb" aria-label="분류 경로">${p.map((x, i) => `<button type="button" data-crumb="${esc(JSON.stringify(p.slice(0, i + 1)))}">${esc(catLabel(x))}</button>`).join('<span>›</span>')}</nav>`;
}
// 본문 속 "REQ-AP-123" 같은 글자를 그 요구사항으로 가는 링크로 바꾼다
function linkifyIds(root, selfId) {
  const re = /\bREQ-[A-Z]{1,5}-\d{1,5}\b/g;
  const has = /\bREQ-[A-Z]{1,5}-\d{1,5}\b/; // test 용 (g 플래그가 없어야 매번 처음부터 찾음)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.parentElement.closest('a, code, pre') || !has.test(t.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
  for (const t of texts) {
    const frag = document.createDocumentFragment(); let last = 0; const v = t.nodeValue;
    v.replace(re, (m, off) => {
      const target = reqIndex.get(m.toUpperCase());
      if (!target || target.id === selfId) return m;
      frag.append(v.slice(last, off));
      const a = document.createElement('a'); a.className = 'wl'; a.dataset.id = target.id; a.textContent = m; frag.append(a);
      last = off + m.length; return m;
    });
    if (last) { frag.append(v.slice(last)); t.replaceWith(frag); }
  }
}
// 최근 본 문서 (이 브라우저에만 저장)
function loadRecent() { try { return JSON.parse(localStorage.getItem('sb-recent') || '[]'); } catch { return []; } }
function rememberRecent(id) { try { localStorage.setItem('sb-recent', JSON.stringify([id, ...loadRecent().filter((x) => x !== id)].slice(0, 12))); } catch { /* 저장 불가 */ } }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
let toastTimer = null;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

/* ───────────── 툴팁 ───────────── */
function tipHtml(n, dark = isDark()) {
  const t = TYPES[n.type];
  const sub = n.props?.['요구사항ID'] ? [n.props['업무'], n.props['대분류'], n.props['중분류']].filter(Boolean).join(' › ') : (n.date || '');
  const summary = n.type === 'topic' ? `연결된 노트 ${n.degree}개` : (n.summary || '');
  return `<div class="tip${dark ? ' tip-dark' : ''}"><div class="tip-eyebrow"><span class="dot" style="background:${dark ? t?.dark : t?.light}"></span>${esc(t?.ko || n.type)}${sub ? ' · ' + esc(sub) : ''}</div>
    <b class="tip-title">${esc(n.title)}</b>${summary ? `<div class="tip-body">${esc(summary.slice(0, 140))}${summary.length > 140 ? '…' : ''}</div>` : ''}
    ${F.reader ? '<div class="tip-foot">누르면 본문이 열려요</div>' : ''}</div>`;
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
  tip.innerHTML = tipHtml(n); tip.classList.toggle('dark', isDark()); tip.hidden = false; placeTip(tip);
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
    const rid = String(n.props?.['요구사항ID'] || '').toLowerCase();
    const rname = String(n.props?.['요구정의명'] || '').toLowerCase();
    if (!words.every((w) => title.includes(w) || rid.includes(w) || rname.includes(w) || body.includes(w) || n.tags.some((t) => t.toLowerCase().includes(w)))) return null;
    let score = 0;
    for (const w of words) {
      if (rid && (rid === w || rid.endsWith('-' + w))) score += 20;   // "REQ-AP-508" 또는 "508"
      else if (rid.includes(w)) score += 10;
      score += title.startsWith(w) ? 6 : title.includes(w) ? 4 : rname.includes(w) ? 3 : 1;
    }
    if (rid) score += 1;
    if (n.type === 'thesis') score += 1;
    return { n, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || b.n.degree - a.n.degree).slice(0, 10).map((x) => x.n);
  sIdx = 0; renderSearch(q);
});
function renderSearch(q) {
  sOut.hidden = false;
  if (!sList.length) { sOut.innerHTML = `<li class="none">“${esc(q)}” 와 맞는 노트가 없어요</li>`; return; }
  sOut.innerHTML = sList.map((n, i) => `<li data-id="${n.id}" class="${i === sIdx ? 'active' : ''}"><span class="dot" style="background:${TYPES[n.type]?.light}"></span><span><span class="t">${esc(n.title)}</span><span class="s">${n.aux ? '<span class="aux-tag">참고 자료</span> ' : ''}${n.props?.['요구사항ID'] ? [n.props['업무'], n.props['대분류'], n.props['중분류'], n.props['처리결과'] === '취소선' ? '취소' : ''].filter(Boolean).map(esc).join(' › ') : (TYPES[n.type]?.ko || '') + (n.summary ? ' · ' + esc(n.summary.slice(0, 80)) : '')}</span></span></li>`).join('');
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
  if (e.key === 'Escape' && document.activeElement !== sIn && (state.selected || state.panel)) closePanel();
});

/* ───────────── 노트 패널 ───────────── */
function onHash() {
  const h = location.hash;
  let m;
  if ((m = h.match(/^#\/req\/(.+)$/))) {
    const n = reqIndex.get(decodeURIComponent(m[1]).toUpperCase());
    if (n) { openNote(n.id, { fromHash: true }); return; }
  }
  if ((m = h.match(/^#\/note\/(.+)$/)) && byId.has(decodeURIComponent(m[1]))) { openNote(decodeURIComponent(m[1]), { fromHash: true }); return; }
  if ((m = h.match(/^#\/cat\/(.+)$/))) {
    const [scheme, ...path] = m[1].split('/').map(decodeURIComponent);
    if (catDefs().some((d) => d.key === scheme) && path.length && applyCat(scheme, path)) { if (!VIEWS[state.view].table) openList(); return; }
  }
  if (state.selected) closePanel({ fromHash: true });
}

async function openNote(id, { fromHash = false, back = false } = {}) {
  const n = byId.get(id);
  if (!n) return;
  if (!back && state.panel && !(state.panel.kind === 'note' && state.panel.id === id)) state.stack.push(state.panel);
  state.panel = { kind: 'note', id };
  state.selected = id;
  if (!fromHash) setHash(n.props?.['요구사항ID'] ? '#/req/' + encodeURIComponent(n.props['요구사항ID']) : '#/note/' + encodeURIComponent(id));
  rememberRecent(id);
  if (!F.reader) { showNodeCard(n); focusNode(id); refresh(); return; }
  document.querySelectorAll('.req-table tr.on').forEach((r) => r.classList.remove('on'));
  document.querySelector(`.req-table tr[data-id="${id}"]`)?.classList.add('on');
  $('panel').hidden = false;
  $('panel-back').disabled = !state.stack.length;
  focusNode(id);
  refresh();

  const t = TYPES[n.type];
  const chips = [...n.topics.map((x) => `<button class="chip" data-topic="${esc(x)}">${esc(x)}</button>`), ...n.tags.map((x) => `<button class="chip" data-tag="${esc(x)}">#${esc(x)}</button>`)].join('');
  const meta = [n.date && `수정 ${n.date}`, n.docType, n.folder && n.folder.replace(/^\d+_/, ''), n.url && `<a href="${esc(n.url)}" target="_blank" rel="noopener">원문 링크 ↗</a>`].filter(Boolean).join('<span>·</span>');
  const body = $('panel-body');
  body.innerHTML = `
    <div class="p-type"><span class="dot" style="background:${t?.light}"></span>${t?.ko || n.type}${t?.en ? ' · ' + t.en : ''}</div>
    <h2 class="p-title">${esc(n.title)}</h2>
    ${crumbHtml(n)}
    <div class="p-meta">${meta}<span>·</span><button type="button" class="link-btn copy-link">링크 복사</button></div>
    ${n.props?.['처리결과'] === '취소선' ? '<div class="badge-cancel">취소된 요구사항</div>' : ''}
    ${chips ? `<div class="p-chips">${chips}</div>` : ''}
    ${propsHtml(n)}
    ${(() => { const c = lastChange.get(keyOf(n)); if (!c) return ''; const what = c.kind === '추가' ? '새로 추가됨' : c.fields.map((f) => f.f).join(', ') + ' 변경'; return `<div class="last-chg"><span>최근 변경</span> ${esc(fmtWhen(c.at))} · ${esc(what)} <a class="link-btn" href="#" data-goto-hist="1">이력 보기</a></div>`; })()}
    ${n.props?.['요구사항ID'] && !G.links.some((l) => (l.source === n.id && l.type === 'evidence') || (l.target === n.id && l.type === 'meeting'))
      ? '<div class="hint-box">근거 회의가 연결되지 않은 요구사항이에요. 옵시디언에서 <code>근거회의: "[[회의록 이름]]"</code> 을 채우면 다음 업로드부터 연결돼요.</div>' : ''}
    <div class="md" id="md">${n.type === 'topic' ? '' : '<p style="color:#8b8a82">불러오는 중…</p>'}</div>
    ${historyHtml(n)}
    <div class="rel">${relatedHtml(n)}</div>`;
  body.scrollTop = 0;

  if (n.type === 'topic') { $('md').remove(); return; }
  try {
    const html = await loadNoteHtml(n.file);
    if (state.selected === id) { $('md').innerHTML = html || '<p style="color:#8b8a82">본문이 비어 있어요.</p>'; linkifyIds($('md'), n.id); }
  } catch {
    if (state.selected === id) $('md').innerHTML = '<p style="color:#8b8a82">본문을 불러오지 못했어요.</p>';
  }
}

function relatedHtml(n) {
  const groups = new Map();
  for (const l of G.links) {
    let dir, other;
    if (l.source === n.id) { dir = 'out'; other = l.target; } else if (l.target === n.id) { dir = 'in'; other = l.source; } else continue;
    const key = l.type === 'related' ? 'related|both' : `${l.type}|${dir}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(byId.get(other));
  }
  if (!groups.size) return '<h4>연결</h4><p class="hint">아직 연결된 노트가 없어요.</p>';
  // 요구사항을 볼 때 중요한 순서: 상위 → 하위 → 근거 회의 → 다룬 회의 → 관련 요구사항 → 나머지
  const priority = ['parent|in', 'parent|out', 'evidence|out', 'meeting|in', 'related|both', 'topic|out'];
  const order = Object.keys(EDGES);
  const rank = (k) => { const i = priority.indexOf(k); return i >= 0 ? i : 100 + order.indexOf(k.split('|')[0]) * 2 + (k.endsWith('out') ? 0 : 1); };
  const keys = [...groups.keys()].sort((a, b) => rank(a) - rank(b));
  const item = (x) => `<div class="rel-item${x.aux ? ' aux' : ''}" data-id="${x.id}"><span class="dot" style="background:${TYPES[x.type]?.light}"></span><span class="rel-t">${esc(x.title)}</span>${x.aux ? '<span class="aux-tag">참고</span>' : ''}</div>`;
  const idSort = (a, b) => String(a.props?.['요구사항ID'] || '~' + a.title).localeCompare(String(b.props?.['요구사항ID'] || '~' + b.title), 'en', { numeric: true });
  return '<h4>연결된 노트</h4>' + keys.map((k) => {
    const [type, dir] = k.split('|');
    const items = [...new Map(groups.get(k).filter(Boolean).map((x) => [x.id, x])).values()].sort(idSort);
    const label = dir === 'both' ? EDGES[type].out : EDGES[type][dir];
    const head = items.slice(0, 8).map(item).join('');
    const rest = items.length > 8 ? `<details class="rel-more"><summary>${items.length - 8}개 더 보기</summary>${items.slice(8).map(item).join('')}</details>` : '';
    return `<div class="rel-group"><div class="lab"><span class="ln" style="border-color:${darken(EDGES[type].color)}"></span>${label} · ${items.length}</div>${head}${rest}</div>`;
  }).join('');
}

$('panel-body').addEventListener('click', (e) => {
  const a = e.target.closest('[data-id]');
  if (a) { e.preventDefault(); openNote(a.dataset.id); return; }
  const tp = e.target.closest('[data-topic]');
  if (tp) { const topic = G.nodes.find((x) => x.type === 'topic' && x.title === tp.dataset.topic); if (topic) openNote(topic.id); return; }
  const tg = e.target.closest('[data-tag]');
  if (tg) { if (catDefs().some((d) => d.key === 'tag')) { setScheme('tag'); selectCat(tg.dataset.tag.split('/')); } return; }
  const more = e.target.closest('[data-more]');
  if (more) { listLimit += 200; renderList(); return; }
  if (e.target.closest('[data-goto-hist]')) { e.preventDefault(); document.querySelector('#panel-body .hist')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  const cr = e.target.closest('[data-crumb]');
  if (cr) { const path = JSON.parse(cr.dataset.crumb); if (applyCat('req', path)) { setHash('#/cat/' + ['req', ...path].map(encodeURIComponent).join('/')); if (!VIEWS[state.view].table) openList(); else toast(`표를 "${path.map(catLabel).join(' › ')}" 로 걸렀어요`); } return; }
  if (e.target.closest('.copy-link')) { copyText(location.href).then((ok) => toast(ok ? '링크를 복사했어요' : '주소창의 링크를 복사해 주세요')); return; }
  const lf = e.target.closest('[data-lf]');
  if (lf) { listFilter[lf.dataset.lf] = lf.dataset.v; listLimit = 200; renderList(); return; }
  const srt = e.target.closest('[data-sort]');
  if (srt) { listSort = srt.dataset.sort; renderList(); }
});
$('panel-close').onclick = () => closePanel();
$('panel-wide').onclick = () => {
  const wide = $('panel').classList.toggle('wide');
  $('panel-wide').textContent = wide ? '좁게' : '넓게';
  $('panel-wide').setAttribute('aria-pressed', String(wide));
};
$('open-overview').onclick = () => { openOverview(); closeSidebarMobile(); };
$('panel-back').onclick = () => {
  const prev = state.stack.pop();
  if (!prev) return;
  if (prev.kind === 'list') { applyCat(prev.scheme, prev.path); openList({ back: true }); }
  else if (prev.kind === 'custom') openCustomList(prev.eyebrow, prev.title, prev.ids, { back: true });
  else if (prev.kind === 'overview') openOverview({ back: true });
  else openNote(prev.id, { back: true });
};

function closePanel({ fromHash = false } = {}) {
  state.selected = null; state.stack = []; state.panel = null;
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
    <div class="nc-type"><span class="dot" style="background:${t?.light}"></span>${t?.ko || n.type}${t?.en ? ' · ' + t.en : ''}${n.date ? ' · ' + n.date : ''}</div>
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
// 오른쪽 패널이 열리면 표가 그만큼 비켜서 가려지지 않게 한다
const fitTable = () => { const open = !$('panel').hidden && !isMobile(); $('table-view').style.right = open ? $('panel').offsetWidth + 'px' : '0'; };
new MutationObserver(fitTable).observe($('panel'), { attributes: true, attributeFilter: ['hidden', 'class'] });
window.addEventListener('resize', fitTable);
// 그래프 라벨은 캔버스에 그려서, Pretendard 글자가 내려받아지면 다시 그려 준다
document.fonts?.addEventListener?.('loadingdone', () => { if (!G) return; if (g3) style3d(); refresh(); });
gate(load);
