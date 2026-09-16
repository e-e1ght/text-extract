/**
 * 본문 글꼴을 고른 뒤에 받아 온다.
 *
 * 한글 글꼴은 한 벌이 수 MB 다. 여덟 벌을 미리 걸어 두면
 * - 첫 화면이 그만큼 늦고,
 * - 이미지로 저장할 때 html-to-image 가 **쓰지도 않는 글꼴까지** 전부
 *   base64 로 그림 안에 끼워 넣어 저장이 크게 느려진다.
 * 그래서 고른 글꼴만 그때 link 를 붙인다.
 */
import { resetFontCache } from './exporters';

/** FONT_OPTIONS 의 value 에서 따온 첫 글꼴 이름 → 구글 폰트 주소 */
const GOOGLE_FONTS: Record<string, string> = {
  'Noto Sans KR': 'Noto+Sans+KR:wght@300;400;500;700',
  'Noto Serif KR': 'Noto+Serif+KR:wght@300;400;600;700',
  'Nanum Gothic': 'Nanum+Gothic:wght@400;700;800',
  'Nanum Myeongjo': 'Nanum+Myeongjo:wght@400;700;800',
  'Gowun Dodum': 'Gowun+Dodum',
  'Gowun Batang': 'Gowun+Batang:wght@400;700',
  'IBM Plex Sans KR': 'IBM+Plex+Sans+KR:wght@300;400;500;700',
  Hahmlet: 'Hahmlet:wght@300;400;600',
};

const loaded = new Set<string>();

/** `'Noto Sans KR', sans-serif` 같은 값에서 첫 이름만 꺼낸다. */
function firstFamily(stack: string): string {
  return (stack.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '');
}

/** 이 글꼴 묶음에 구글 폰트가 있으면 붙인다. 이미 붙였으면 아무것도 하지 않는다. */
export function ensureWebFont(stack: string): void {
  const family = firstFamily(stack);
  const query = GOOGLE_FONTS[family];
  if (!query || loaded.has(family)) return;
  loaded.add(family);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  link.dataset.teFont = family;
  // 내보내기용 글꼴 CSS 를 미리 만들어 두므로, 글꼴이 늘면 다시 만들게 한다.
  link.addEventListener('load', () => { void resetFontCache(); }, { once: true });
  document.head.appendChild(link);
}
