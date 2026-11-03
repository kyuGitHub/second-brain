// 옵시디언 볼트(마크다운 폴더)를 읽어서 웹사이트용 그래프 데이터(public/data)를 만든다.
// 실행: npm run graph
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data');

// 노트 유형. 프런트매터 type 에 영어 또는 한글로 적으면 된다.
const TYPE_ALIASES = {
  semantic: 'semantic', 개념: 'semantic', 지식: 'semantic',
  episodic: 'episodic', 경험: 'episodic', 사례: 'episodic', 회의: 'episodic',
  procedural: 'procedural', 방법: 'procedural', 플레이북: 'procedural', 체크리스트: 'procedural',
  reflective: 'reflective', 회고: 'reflective', 생각: 'reflective',
  thesis: 'thesis', 핵심주장: 'thesis',
  근거회의: 'evidence', 근거: 'evidence', 회의록: 'evidence', // 요구사항 → 근거가 된 회의
  상위요구사항: 'parent', 원문: 'refines', 원칙: 'thesis',
  entity: 'entity', 개체: 'entity', 인물: 'entity', 도구: 'entity', 서비스: 'entity',
};

// 프런트매터에 적는 관계 키 → 그래프 연결 유형
const RELATION_KEYS = {
  supports: 'supports', 뒷받침: 'supports',
  extends: 'extends', 확장: 'extends',
  contradicts: 'contradicts', 반박: 'contradicts',
  requires: 'requires', 전제: 'requires',
  refines: 'refines', 다듬음: 'refines',
  instantiates: 'instantiates', 사례로보여줌: 'instantiates',
  composes: 'composes', 구성: 'composes',
  triggered_by: 'triggered-by', 'triggered-by': 'triggered-by', 계기: 'triggered-by',
  thesis: 'thesis', 핵심주장: 'thesis',
  근거회의: 'evidence', 근거: 'evidence', 회의록: 'evidence', // 요구사항 → 근거가 된 회의
  상위요구사항: 'parent', 원문: 'refines',
};

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);

export function loadConfig() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
  // 이 PC에서만 다른 값(예: Mac 의 볼트 경로)은 config.local.json 에 적는다 (Git 에 안 올라감)
  const localPath = path.join(ROOT, 'config.local.json');
  if (fs.existsSync(localPath)) Object.assign(cfg, JSON.parse(fs.readFileSync(localPath, 'utf8')));
  // 우선순위: 환경변수 SB_VAULT > (SB_USE_SOURCE=1 이면 원본 볼트 sourcePath) > 저장소 안 vault 폴더(vaultPath)
  const vault = process.env.SB_VAULT || (process.env.SB_USE_SOURCE === '1' && cfg.sourcePath) || cfg.vaultPath;
  cfg.vaultAbs = path.resolve(ROOT, vault);
  return cfg;
}

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
// "퍼널, 전환율" 처럼 쉼표로 적은 목록도 나눠서 읽는다 (위키링크는 그대로 둔다)
const asList = (v) => asArray(v).flatMap((x) => (typeof x === 'string' && !x.includes('[[') ? x.split(',') : [x])).map((x) => String(x).trim()).filter(Boolean);
const stripLink = (s) => String(s).trim().replace(/^\[\[|\]\]$/g, '').split('|')[0].split('#')[0].trim();
const shortHash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const toDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
};
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function walk(dir, exclude, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || exclude.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, exclude, files);
    else files.push(p);
  }
  return files;
}

// 코드 블록 안의 내용은 링크·태그 해석에서 빼기 위해 잠시 치워 둔다.
function maskCode(md) {
  const blocks = [];
  const masked = md.replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => {
    blocks.push(m);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  return { masked, restore: (s) => s.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]) };
}

// 라벨 전파 방식의 간단한 군집(클러스터) 계산
function computeClusters(nodes, links) {
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const l of links) {
    if (l.type === 'topic' || l.type === 'thesis') continue; // 주제 연결은 군집을 하나로 뭉개므로 제외
    adj.get(l.source)?.push(l.target);
    adj.get(l.target)?.push(l.source);
  }
  const label = new Map(nodes.map((n, i) => [n.id, i]));
  const order = nodes.map((n) => n.id).sort();
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;
    for (const id of order) {
      const nb = adj.get(id);
      if (!nb.length) continue;
      const count = new Map();
      for (const x of nb) count.set(label.get(x), (count.get(label.get(x)) || 0) + 1);
      let best = label.get(id), bestC = -1;
      for (const [lab, c] of count) if (c > bestC || (c === bestC && lab < best)) { best = lab; bestC = c; }
      if (best !== label.get(id)) { label.set(id, best); changed = true; }
    }
    if (!changed) break;
  }
  // 크기 순으로 0,1,2... 번호를 다시 매긴다. 2개 미만인 군집은 -1(미분류)
  const sizes = new Map();
  for (const v of label.values()) sizes.set(v, (sizes.get(v) || 0) + 1);
  const ranked = [...sizes.entries()].filter(([, s]) => s >= 2).sort((a, b) => b[1] - a[1]).map(([l]) => l);
  const remap = new Map(ranked.map((l, i) => [l, i]));
  for (const n of nodes) n.cluster = remap.has(label.get(n.id)) ? remap.get(label.get(n.id)) : -1;
}

export function build({ quiet = false } = {}) {
  const t0 = Date.now();
  const cfg = loadConfig();
  if (!fs.existsSync(cfg.vaultAbs)) {
    throw new Error(`볼트 폴더를 찾을 수 없어요: ${cfg.vaultAbs}\nconfig.json 의 vaultPath 를 옵시디언 볼트 경로로 바꿔 주세요.`);
  }
  const exclude = new Set(cfg.exclude || []);
  const all = walk(cfg.vaultAbs, exclude);
  const mdFiles = all.filter((f) => f.toLowerCase().endsWith('.md'));
  const attachments = new Map(); // 파일명(소문자) → 절대경로
  for (const f of all) if (IMAGE_EXT.has(path.extname(f).toLowerCase())) attachments.set(path.basename(f).toLowerCase(), f);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'notes'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

  // 1단계: 노트 메타데이터 수집
  // 설정에서 읽는 값들
  const include = (cfg.includeFolders || []).map((f) => f.replace(/\/+$/, '') + '/');
  const hideWhere = cfg.hideWhere || {};
  const typeMap = Object.fromEntries(Object.entries(cfg.typeMap || {}).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, ''), v]));
  const F = { topics: ['topics', 'topic', '주제'], tags: ['tags', 'tag'], dates: ['date', 'created', '작성일'], ...(cfg.fields || {}) };
  const pick = (fm, keys) => keys.flatMap((k) => asList(fm[k]));
  const catDefs = cfg.categories || [];
  const propFields = cfg.propFields || [];

  const notes = [];
  const hiddenNames = new Set(); // 사이트에서 뺀 노트 이름 (이 노트를 가리키는 링크는 깨진 링크로 세지 않음)
  for (const file of mdFiles) {
    const relPath = path.relative(cfg.vaultAbs, file).split(path.sep).join('/');
    if (include.length && !include.some((f) => relPath.startsWith(f))) continue; // 지정한 폴더만
    const raw = fs.readFileSync(file, 'utf8');
    let parsed;
    try { parsed = matter(raw); } catch (e) {
      console.warn(`  ! 프런트매터 오류로 건너뜀: ${path.relative(cfg.vaultAbs, file)} (${e.message.split('\n')[0]})`);
      continue;
    }
    const fm = parsed.data || {};
    if (fm.publish === false || fm.private === true) continue;
    if (cfg.publishMode === 'flag' && fm.publish !== true) continue;
    // 숨길 값 (예: 처리결과 = 숨김)
    if (Object.entries(hideWhere).some(([k, vals]) => asList(fm[k]).some((v) => vals.includes(v)))) continue;
    // 숨김 규칙 (예: type 이 MOC 이고 파일 이름이 00_ 로 시작하는 자동 색인)
    const baseName = path.basename(file, path.extname(file));
    if ((cfg.hideRules || []).some((r) => (!r.type || String(fm.type || '').trim() === r.type) && (!r.titlePrefix || baseName.startsWith(r.titlePrefix)))) {
      hiddenNames.add(baseName.toLowerCase()); hiddenNames.add(relPath.replace(/\.md$/i, '').toLowerCase());
      continue;
    }

    const rel = path.relative(cfg.vaultAbs, file).split(path.sep).join('/');
    const base = path.basename(file, path.extname(file));
    // 분류용 폴더 경로: 지정 폴더(예: 1_위키) 아래부터
    const root = include.find((f) => rel.startsWith(f)) || '';
    const folderParts = rel.slice(root.length).split('/').slice(0, -1);
    const topFolder = folderParts[0] || rel.split('/').slice(0, -1)[0] || '';
    const docType = String(fm.type || '').trim();
    const rawType = docType.toLowerCase().replace(/\s+/g, '');
    const type = typeMap[rawType] || TYPE_ALIASES[rawType] || (cfg.folderTypes || {})[topFolder] || cfg.defaultType || 'semantic';
    // 카테고리: 분류 기준마다 [경로] 목록
    const cats = {};
    // 보조 자료: 목록·그래프에는 안 보이고 검색·링크·통계에만 쓰는 노트
    //  (주요 폴더 밖의 노트, 또는 auxRules 에 맞는 노트 — 예: type 이 MOC 인 색인)
    const scopeName = folderParts[0] || '';
    const primary = cfg.primaryScopes || [];
    const aux = (primary.length && !primary.includes(scopeName)) ||
      (cfg.auxRules || []).some((r) => (!r.type || docType === r.type) && (!r.titlePrefix || base.startsWith(r.titlePrefix)));
    for (const d of catDefs) {
      if (aux || (d.scope && d.scope !== scopeName)) { cats[d.key] = []; continue; } // 이 분류에 속하지 않는 노트
      let paths;
      if (d.field === '$folder') { const fp = d.scope ? folderParts.slice(1) : folderParts; paths = [fp.length ? fp : ['(최상위)']]; }
      else if (Array.isArray(d.field)) {
        const p = []; for (const f of d.field) { const v = asList(fm[f])[0]; if (!v) break; p.push(String(v)); }
        paths = [p];
      } else paths = asList(fm[d.field]).map(stripLink).filter(Boolean).map((v) => (d.split ? v.split(d.split).map((x) => x.trim()).filter(Boolean) : [v]));
      cats[d.key] = paths.filter((p) => p.length).length ? paths.filter((p) => p.length) : [['(미분류)']];
    }
    const props = {};
    for (const f of propFields) { const v = asList(fm[f]).map((x) => (x instanceof Date ? x.toISOString().slice(0, 10) : String(x))).join(', '); if (v) props[f] = v.slice(0, 200); }
    const stat = fs.statSync(file);
    notes.push({
      id: 'n-' + shortHash(rel),
      rel, base, fm, body: parsed.content,
      title: String(fm.title || base),
      aliases: asList(fm.aliases || fm.alias),
      type,
      folder: topFolder, docType, cats, props, aux,
      topics: [...new Set(pick(fm, F.topics).map(stripLink).filter(Boolean))],
      tags: [...new Set(pick(fm, F.tags).map((t) => t.replace(/^#/, '')).filter(Boolean))],
      date: toDate(F.dates.map((k) => fm[k]).find(Boolean)) || toDate(stat.mtime),
      source: fm.source === 'external' || fm.출처 === '외부' || ((fm.url || fm.source_url) && fm.source !== 'mine') ? 'external' : 'mine',
      url: fm.url || fm.source_url || null,
    });
  }

  // 링크 이름 → 노트 찾기 (파일명, 제목, 별칭, 경로 모두 허용)
  const lookup = new Map();
  const register = (k, n) => { const key = k.toLowerCase(); if (!lookup.has(key)) lookup.set(key, n); };
  for (const n of notes) {
    register(n.rel.replace(/\.md$/i, ''), n);
    register(n.base, n);
    register(n.title, n);
    n.aliases.forEach((a) => register(a, n));
  }
  const resolve = (name) => lookup.get(stripLink(name).toLowerCase()) || lookup.get(stripLink(name).split('/').pop().toLowerCase());

  // 2단계: 연결(엣지) 만들기
  const links = [];
  const seen = new Set();
  const addLink = (source, target, type) => {
    if (!source || !target || source === target) return;
    const key = `${source}|${target}|${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ source, target, type });
  };
  const topicNodes = new Map();
  const topicId = (name) => {
    if (!topicNodes.has(name)) topicNodes.set(name, { id: 't-' + shortHash(name), title: name, type: 'topic', topics: [name], tags: [], date: null, source: 'mine', folder: '', cats: {}, props: {} });
    return topicNodes.get(name).id;
  };

  const brokenLinks = [];
  for (const n of notes) {
    for (const [key, type] of Object.entries(RELATION_KEYS)) {
      for (const v of asArray(n.fm[key])) {
        const t = resolve(String(v));
        if (t) addLink(n.id, t.id, type);
        else brokenLinks.push(`${n.rel} → ${key}: ${v}`);
      }
    }
    for (const tp of n.topics) addLink(n.id, topicId(tp), 'topic');
  }

  // 3단계: 본문 변환 (위키링크, 이미지 임베드, 인라인 태그, 콜아웃)
  const typedPairs = new Set(links.map((l) => `${l.source}|${l.target}`));
  const copiedAssets = new Set();
  for (const n of notes) {
    const { masked, restore } = maskCode(n.body);
    let md = masked;

    // ![[이미지.png]] 임베드
    md = md.replace(/!\[\[([^\]]+)\]\]/g, (m, inner) => {
      const [file, alt] = inner.split('|');
      const src = attachments.get(path.basename(file.trim()).toLowerCase());
      if (!src) {
        const t = resolve(file);
        return t ? `<a class="wl" data-id="${t.id}">${escapeHtml(t.title)}</a>` : '';
      }
      const name = shortHash(src) + path.extname(src).toLowerCase();
      if (!copiedAssets.has(name)) { fs.copyFileSync(src, path.join(OUT, 'assets', name)); copiedAssets.add(name); }
      const width = alt && /^\d+$/.test(alt.trim()) ? ` width="${alt.trim()}"` : '';
      return `<img src="data/assets/${name}" alt=""${width} loading="lazy">`;
    });

    // [[링크|별칭]] 위키링크 → 본문 언급(mentions) 연결
    md = md.replace(/\[\[([^\]]+)\]\]/g, (m, inner) => {
      const [target, alias] = inner.split('|');
      const label = (alias || target.split('#')[0] || target).trim();
      const t = resolve(target);
      if (!t) {
        const key = stripLink(target).toLowerCase();
        if (hiddenNames.has(key) || hiddenNames.has(key.split('/').pop())) return `<span class="wl hidden-note">${escapeHtml(label)}</span>`;
        n.broken = (n.broken || 0) + 1; return `<span class="wl broken">${escapeHtml(label)}</span>`;
      }
      if (!typedPairs.has(`${n.id}|${t.id}`)) addLink(n.id, t.id, 'mentions');
      return `<a class="wl" data-id="${t.id}">${escapeHtml(label)}</a>`;
    });

    // 본문의 #태그
    md = md.replace(/(^|[\s(])#([\p{L}\p{N}_\-/]*[\p{L}_\-/][\p{L}\p{N}_\-/]*)/gu, (m, pre, tag) => {
      if (!n.tags.includes(tag)) n.tags.push(tag);
      return `${pre}<span class="tag">#${escapeHtml(tag)}</span>`;
    });
    md = md.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
    md = restore(md);

    let html = marked.parse(md, { gfm: true, breaks: true });
    // 옵시디언 콜아웃 > [!note] 제목
    html = html.replace(/<blockquote>\s*<p>\[!(\w+)\][+-]?\s*([^<\n]*)(?:<br>|\n)?/g, (m, kind, title) =>
      `<blockquote class="callout callout-${kind.toLowerCase()}"><div class="callout-title">${title || kind}</div><p>`);

    const plain = n.body.replace(/^#.*$/gm, '').replace(/!\[\[[^\]]*\]\]/g, '').replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (m, a, b) => b || a)
      .replace(/[*_>`#=\-]/g, '').replace(/\s+/g, ' ').trim();
    n.summary = String(n.fm.summary || n.fm.요약 || plain.slice(0, 160));
    n.searchText = (n.title + ' ' + n.aliases.join(' ') + ' ' + Object.values(n.props).join(' ') + ' ' + plain).slice(0, 1500);
    n.file = shortHash(n.id) + '.json';
    // 변경 감지용 본문 지문. 업로드할 때 이전 업로드와 비교한다
    n.fp = shortHash(html); // 본문 지문 (제목·속성은 따로 비교)
    fs.writeFileSync(path.join(OUT, 'notes', n.file), JSON.stringify({ html }));
  }

  // 3.5단계: 본문 언급(mentions)에 의미 붙이기 — 출발 노트의 종류로 연결 유형을 정한다
  // 예: 색인(MOC) → 노트 = 색인 포함, 회의록 → 노트 = 회의에서 다룸, 상위요구사항 → 노트 = 상위 요구사항
  const noteById = new Map(notes.map((n) => [n.id, n]));
  for (const l of links) {
    if (l.type !== 'mentions') continue;
    const src = noteById.get(l.source);
    if (!src) continue;
    const tgt = noteById.get(l.target);
    const has = (n, f) => n && asList(n.fm[f]).length > 0;
    const rule = (cfg.linkRules || []).find((r) =>
      (!r.sourceType || r.sourceType === src.type) &&
      (!r.targetType || r.targetType === tgt?.type) &&
      (!r.bothHave || (has(src, r.bothHave) && has(tgt, r.bothHave))) &&
      (!r.sourceField || asList(src.fm[r.sourceField]).map(String).includes(String(r.equals))));
    if (rule) l.type = rule.as;
  }

  // 4단계: 노드 목록 정리 + 군집 계산
  const nodes = [
    ...notes.map((n) => ({
      id: n.id, title: n.title, type: n.type, folder: n.folder, docType: n.docType, cats: n.cats, props: n.props, topics: n.topics, tags: n.tags,
      date: n.date, source: n.source, url: n.url, summary: n.summary, file: n.file, search: n.searchText, broken: n.broken || 0, aux: n.aux || undefined, fp: n.fp,
    })),
    ...topicNodes.values(),
  ];
  computeClusters(nodes, links);
  const degree = new Map();
  for (const l of links) for (const id of [l.source, l.target]) degree.set(id, (degree.get(id) || 0) + 1);
  nodes.forEach((n) => (n.degree = degree.get(n.id) || 0));

  const graph = {
    meta: {
      title: cfg.siteTitle || 'Second Brain',
      subtitle: cfg.siteSubtitle || '',
      builtAt: new Date().toISOString(),
      noteCount: notes.length,
      features: cfg.features || {},
      typeLabels: cfg.typeLabels || {},
      categories: catDefs.map((d) => ({ key: d.key, label: d.label })),
    },
    nodes,
    links,
  };
  fs.writeFileSync(path.join(OUT, 'graph.json'), JSON.stringify(graph));

  if (!quiet) {
    console.log(`✔ 그래프 생성 완료: 노트 ${notes.length}개, 노드 ${nodes.length}개, 연결 ${links.length}개 (${Date.now() - t0}ms)`);
    console.log(`  볼트: ${cfg.vaultAbs}`);
    if (brokenLinks.length) console.log(`  ! 찾지 못한 관계 링크 ${brokenLinks.length}개:\n    ` + brokenLinks.slice(0, 10).join('\n    '));
  }
  return graph;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { build(); } catch (e) { console.error('✖ ' + e.message); process.exit(1); }
}
