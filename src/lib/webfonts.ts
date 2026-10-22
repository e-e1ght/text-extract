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

const NOONNU = 'https://cdn.jsdelivr.net/gh/projectnoonnu';
const face = (family: string, url: string, weight: string | number) => {
  const format = url.endsWith('.woff2') ? 'woff2' : 'woff';
  return `@font-face{font-family:'${family}';src:url('${url}') format('${format}');font-weight:${weight};font-display:swap;}`;
};

/**
 * 구글이 아닌 글꼴 — @font-face 를 직접 붙이거나(css), 글꼴 쪽이 내 주는 CSS 를 불러온다(cssUrl).
 * 붙이는 것만으로는 내려받지 않는다: 브라우저는 그 글꼴로 글자를 그릴 때에야 파일을 받는다.
 */
const CSS_FONTS: Record<string, { css?: string; cssUrl?: string }> = {
  Aggravo: {
    css: face('Aggravo', `${NOONNU}/noonfonts_2108@1.1/SBAggroL.woff`, 300)
      + face('Aggravo', `${NOONNU}/noonfonts_2108@1.1/SBAggroM.woff`, 500)
      + face('Aggravo', `${NOONNU}/noonfonts_2108@1.1/SBAggroB.woff`, 700),
  },
  Mona12: { cssUrl: 'https://cdn.jsdelivr.net/gh/MonadABXY/mona-font/web/mona.css' },
  Galmuri11: {
    cssUrl: 'https://cdn.jsdelivr.net/npm/galmuri@latest/dist/galmuri.css',
    css: face('Galmuri11', `${NOONNU}/2506-1@1.0/Galmuri11-Bold.woff2`, 700),
  },
  JoseonGulim: { css: face('JoseonGulim', `${NOONNU}/noonfonts_20-04@1.0/ChosunGu.woff`, 'normal') },
  IsYun: { css: face('IsYun', `${NOONNU}/noonfonts_2202-2@1.0/LeeSeoyun.woff`, 'normal') },
  ChosunIlboMyungjo: { css: face('ChosunIlboMyungjo', `${NOONNU}/noonfonts_one@1.0/Chosunilbo_myungjo.woff`, 'normal') },
  Ridibatang: { css: face('Ridibatang', `${NOONNU}/noonfonts_twelve@1.0/RIDIBatang.woff`, 'normal') },
  BookkMyungjo: {
    css: face('BookkMyungjo', `${NOONNU}/noonfonts_2302@1.0/BookkMyungjo-Lt.woff2`, 400)
      + face('BookkMyungjo', `${NOONNU}/noonfonts_2302@1.0/BookkMyungjo-Bd.woff2`, 700),
  },
  Presentation: {
    css: ['1Thin', '2ExtraLight', '3Light', '4Regular', '5Medium', '6SemiBold', '7Bold', '8ExtraBold', '9Black']
      .map((name, i) => face('Presentation', `${NOONNU}/2404@1.0/Freesentation-${name}.woff2`, (i + 1) * 100))
      .join(''),
  },
};

const loaded = new Set<string>();

/** `'Noto Sans KR', sans-serif` 같은 값에서 첫 이름만 꺼낸다. */
function firstFamily(stack: string): string {
  return (stack.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '');
}

/** 이 글꼴 묶음에 구글 폰트가 있으면 붙인다. 이미 붙였으면 아무것도 하지 않는다. */
export function ensureWebFont(stack: string): void {
  const family = firstFamily(stack);
  if (loaded.has(family)) return;

  const extra = CSS_FONTS[family];
  if (extra) {
    loaded.add(family);
    if (extra.cssUrl) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = extra.cssUrl;
      link.dataset.teFont = family;
      link.addEventListener('load', () => { void resetFontCache(); }, { once: true });
      document.head.appendChild(link);
    }
    if (extra.css) {
      const style = document.createElement('style');
      style.dataset.teFont = family;
      style.textContent = extra.css;
      document.head.appendChild(style);
    }
    // 글꼴 규칙이 늘었으니 저장용 글꼴 CSS 를 다시 만들게 한다
    resetFontCache();
    return;
  }

  const query = GOOGLE_FONTS[family];
  if (!query) return;
  loaded.add(family);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  link.dataset.teFont = family;
  // 내보내기용 글꼴 CSS 를 미리 만들어 두므로, 글꼴이 늘면 다시 만들게 한다.
  link.addEventListener('load', () => { void resetFontCache(); }, { once: true });
  document.head.appendChild(link);
}
