// 화면에 넣는 HTML 을 한 번 걸러서 스크립트·위험한 링크가 실행되지 않게 한다.
// - 노트 본문: 옵시디언에서 만든 HTML (마크다운 변환 결과)
// - AI 답변: Claude 가 쓴 마크다운 → HTML. 외부 이미지·이상한 링크는 아예 뺀다
import DOMPurify from 'dompurify';

const SAFE_URL = /^(?:(?:https?|mailto):|#|data\/|\.{0,2}\/)/i; // http(s)·메일·문서 안 링크·상대 경로만

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  for (const attr of ['href', 'src']) {
    const v = node.getAttribute?.(attr);
    if (v != null && !SAFE_URL.test(v.trim())) node.removeAttribute(attr);
  }
  if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') || '')) {
    node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer');
  }
});

// 노트 본문
export const cleanNote = (html) => DOMPurify.sanitize(String(html || ''), {
  ADD_ATTR: ['data-id', 'target'], FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
});

// AI 답변: 이미지·외부 자원을 쓰는 태그는 빼고 글·표·목록·링크만
export const cleanAnswer = (html) => DOMPurify.sanitize(String(html || ''), {
  FORBID_TAGS: ['img', 'picture', 'video', 'audio', 'source', 'iframe', 'style', 'form', 'input', 'button', 'svg', 'math'],
  FORBID_ATTR: ['style', 'srcset'],
});

// 주소 칸(프런트매터 url 등)에 쓸 수 있는 링크인지
export const safeHref = (u) => (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '');

// CSV 칸이 = + - @ 탭·줄바꿈으로 시작하면 엑셀이 수식으로 실행하므로 앞에 ' 를 붙인다
export const csvCell = (v) => { const s = String(v ?? ''); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; };
