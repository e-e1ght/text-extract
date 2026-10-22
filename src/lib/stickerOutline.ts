/**
 * 스티커 외곽선.
 *
 * 스티커는 대개 배경을 오려 낸 PNG 라 네모 테두리가 아니라 그림 모양을 따라 둘러야 한다.
 * CSS 로는 모양을 따라 굵게 두를 방법이 없어(drop-shadow 를 여러 겹 쌓으면 굵을수록 들쭉날쭉),
 * 캔버스에서 그림을 한 색으로 칠해 둘레로 조금씩 밀어 찍어 부풀린 뒤 원본을 얹는다.
 * 결과는 그냥 이미지라 저장본에도 그대로 나온다.
 */
import { loadImage } from './ascii';

const cache = new Map<string, Promise<string>>();

/** 화면 1px 당 작업 픽셀 — 2배로 만들어 두면 2배 저장에서도 선이 뭉개지지 않는다 */
const WORK_SCALE = 2;
const MAX_WORK = 2400;

/**
 * 외곽선을 두른 그림의 data URL.
 * thickness 는 화면 px. 그림 둘레로 그만큼 커지므로 쓰는 쪽에서 그만큼 바깥으로 넓혀 그린다.
 */
export function outlinedSticker(url: string, color: string, thickness: number, displayWidth: number): Promise<string> {
  const work = Math.max(16, Math.min(MAX_WORK, Math.round(displayWidth * WORK_SCALE)));
  const key = `${color}|${thickness}|${work}|${url}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = loadImage(url).then((img) => draw(img, color, thickness * (work / displayWidth), work));
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
    // 크기를 끄는 동안 쌓이지 않게 오래된 것부터 버린다
    if (cache.size > 24) cache.delete(cache.keys().next().value as string);
  }
  return pending;
}

/** r 은 작업 해상도에서의 선 굵기 */
function draw(img: HTMLImageElement, color: string, r: number, work: number): string {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const w = work;
  const h = Math.max(1, Math.round((nh / nw) * work));

  const tint = document.createElement('canvas');
  tint.width = w;
  tint.height = h;
  const t = tint.getContext('2d');
  if (!t) return img.src;
  t.drawImage(img, 0, 0, w, h);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = color;
  t.fillRect(0, 0, w, h);

  const pad = Math.ceil(r);
  const out = document.createElement('canvas');
  out.width = w + pad * 2;
  out.height = h + pad * 2;
  const o = out.getContext('2d');
  if (!o) return img.src;
  /*
   * 반지름 r 의 원 둘레로 한 색 그림을 촘촘히 찍는다 (이웃한 두 점 사이가 1.5px 넘지 않게).
   * 바깥 둘레만 찍으면 점처럼 작은 조각 안쪽이 비므로 안쪽 둘레 둘을 더 찍는다.
   */
  [1, 2 / 3, 1 / 3].forEach((part) => {
    const ring = r * part;
    const steps = Math.max(8, Math.ceil((2 * Math.PI * ring) / 1.5));
    for (let i = 0; i < steps; i += 1) {
      const a = (i / steps) * Math.PI * 2;
      o.drawImage(tint, pad + Math.cos(a) * ring, pad + Math.sin(a) * ring);
    }
  });
  o.drawImage(img, pad, pad, w, h);
  return out.toDataURL('image/png');
}

