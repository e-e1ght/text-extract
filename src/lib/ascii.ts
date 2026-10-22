/**
 * 이미지를 아스키 아트로.
 *
 * 그림을 '가로 글자 수 × 세로 줄 수' 크기로 줄인 뒤, 칸마다 밝기를 재서 진한 곳일수록
 * 빽빽한 글자를 놓는다. 글자 한 칸은 세로로 길쭉하므로(대략 폭 0.6 : 높이 1) 줄 수를
 * 그만큼 줄여야 그림이 위아래로 늘어나지 않는다.
 */

/** 옅은 것 → 진한 것. 너무 길면 오히려 지저분해 보여 열 단계만 쓴다 */
const RAMP = ' .:-=+*#%@';

export const ASCII_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", "Courier New", monospace';
export const ASCII_LINE_HEIGHT = 1;

let charAspect: number | null = null;

/** 이 브라우저의 고정폭 글꼴에서 글자 폭 ÷ 줄 높이 */
function measureAspect(): number {
  if (charAspect !== null) return charAspect;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 0.6;
  ctx.font = `100px ${ASCII_FONT}`;
  const width = ctx.measureText('M'.repeat(10)).width / 10 / 100;
  charAspect = width > 0.3 && width < 1 ? width / ASCII_LINE_HEIGHT : 0.6;
  return charAspect;
}

const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let pending = images.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
      img.src = url;
    });
    images.set(url, pending);
    // 실패한 것은 다음에 다시 시도할 수 있게 빼 둔다
    pending.catch(() => images.delete(url));
  }
  return pending;
}

export function imageToAscii(
  img: HTMLImageElement,
  { columns, contrast, invert }: { columns: number; contrast: number; invert: boolean },
): string {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return '';
  const cols = Math.max(4, Math.round(columns));
  const rows = Math.max(1, Math.round(cols * (h / w) * measureAspect()));

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;

  const last = RAMP.length - 1;
  const lines: string[] = [];
  for (let y = 0; y < rows; y += 1) {
    let line = '';
    for (let x = 0; x < cols; x += 1) {
      const i = (y * cols + x) * 4;
      const a = data[i + 3] / 255;
      // 사람 눈이 느끼는 밝기. 투명한 곳은 '빈 바탕' 으로 본다 —
      // 보통은 흰 바탕, 반전이면 검은 바탕으로 쳐야 글자 없이 비어 나온다
      const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      const seen = invert ? a * lum : 1 - a * (1 - lum);
      const v = Math.min(1, Math.max(0, (seen - 0.5) * contrast + 0.5));
      const ink = invert ? v : 1 - v;
      line += RAMP[Math.round(ink * last)];
    }
    // 끝의 빈칸도 남긴다 — 그래야 글 상자가 그림 크기 그대로라 가운데 맞춤이 흔들리지 않는다
    lines.push(line);
  }
  return lines.join('\n');
}
