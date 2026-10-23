/**
 * 배경 무늬.
 *
 * 점·체크는 SVG <pattern> 한 칸이면 끝난다. 별은 레퍼런스처럼 크기·선 모양이 제각각이고
 * 하프톤(점 크기로 농담을 내는 인쇄 기법)과 번짐이 불규칙하게 섞여야 해서, 한 칸(타일)을
 * 미리 '계산' 해 둔다.
 *
 * 계산 결과는 그림(PNG)이 아니라 SVG 경로다.
 *  - 그림이면 크게 키우거나 2배로 저장할 때 점이 뭉개진다. 경로는 어떤 크기에서도 또렷하다.
 *  - 색은 fill 하나로 바뀐다. 색을 바꿀 때마다 다시 그릴 필요가 없다.
 *  - 회전은 patternTransform 이 맡는다. 무늬가 무한히 이어지므로 긴 결과물을 돌려도
 *    모서리가 비지 않는다 (큰 판을 돌려서 덮는 방식은 세로로 긴 결과물에서 모서리가 빈다).
 * 캔버스는 '번진 별 모양의 농도' 를 재는 데에만 쓴다.
 */

/** 별 타일 한 변 (타일 좌표, 간격 100% 일 때). 하프톤 간격(PITCH)으로 나누어떨어져야 이음매가 맞는다 */
export const STAR_TILE = 1032;
const PITCH = 12;
const ROW = PITCH / 2;
/** 점이 가장 클 때의 반지름. 이웃 점과 살짝 겹쳐 진한 곳이 메워지게 한다 */
const DOT_MAX = 4.7;
/** 이보다 옅은 농도는 점을 찍지 않는다 */
const FLOOR = 0.14;

export interface StarSolid {
  d: string;
  /** 0 이면 채우고, 아니면 이 굵기로 선을 긋는다 */
  stroke: number;
}

export interface StarField {
  /** 타일 한 변 — 간격을 벌리면 별 개수는 그대로 두고 타일만 넓힌다 */
  tile: number;
  solids: StarSolid[];
  /** 하프톤 점 전체를 한 경로로 묶은 것 */
  dots: string;
}

type Shape = 'fill' | 'outline' | 'double' | 'nested';
/** 무늬 한 개의 꼴 — 별, 또는 물방울(동그라미). 배치·하프톤·번짐은 똑같이 쓴다 */
export type Form = 'star' | 'circle';
type Render = 'solid' | 'halftone' | 'soft';

interface Star {
  form: Form;
  x: number;
  y: number;
  r: number;
  inner: number;
  rot: number;
  shape: Shape;
  render: Render;
  /** 번짐 반지름 (타일 좌표) */
  blur: number;
  /** 하프톤 농도 0~1 — 낮을수록 점이 작아져 옅게 보인다 */
  tone: number;
  line: number;
}

/** 시드가 같으면 늘 같은 수열 — 새로고침해도 별 배치가 그대로다 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, table: Array<[T, number]>): T {
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rand() * total;
  for (const [value, weight] of table) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return table[table.length - 1][0];
}

function starPoints(cx: number, cy: number, r: number, inner: number, rot: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * inner;
    const angle = rot + (i * Math.PI) / 5 - Math.PI / 2;
    pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return pts;
}

const f1 = (n: number) => Math.round(n * 10) / 10;

function shapeD(form: Form, cx: number, cy: number, r: number, inner: number, rot: number): string {
  if (form === 'circle') {
    return `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(r * 2)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-r * 2)} 0Z`;
  }
  const pts = starPoints(cx, cy, r, inner, rot);
  return `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`;
}

/** 별 하나를 이루는 '조각' 들 — 겹선·속 별까지 같은 규칙으로 그리고 재기 위함 */
function parts(star: Star): Array<{ r: number; stroke: number }> {
  const { r, line } = star;
  switch (star.shape) {
    case 'fill': return [{ r, stroke: 0 }];
    case 'outline': return [{ r, stroke: line }];
    case 'double': return [{ r, stroke: line }, { r: r * 0.6, stroke: line * 0.8 }];
    default: return [{ r, stroke: line }, { r: r * 0.4, stroke: 0 }];
  }
}

/** 타일 가장자리에 걸친 별은 맞은편에도 그려야 이어 붙였을 때 잘리지 않는다 */
export function wrapOffsets(x: number, y: number, reach: number, tile: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const dx of [-tile, 0, tile]) {
    for (const dy of [-tile, 0, tile]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx + reach < 0 || nx - reach > tile || ny + reach < 0 || ny - reach > tile) continue;
      out.push([dx, dy]);
    }
  }
  return out;
}

function placeStars(rand: () => number, form: Form, tile: number): Star[] {
  const stars: Star[] = [];
  // 큰 별부터 자리를 잡고, 작은 별이 틈을 메운다
  const sizes: number[] = [];
  for (let i = 0; i < 5; i += 1) sizes.push(120 + rand() * 70);
  for (let i = 0; i < 7; i += 1) sizes.push(70 + rand() * 45);
  for (let i = 0; i < 9; i += 1) sizes.push(26 + rand() * 30);

  for (const r of sizes) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const x = rand() * tile;
      const y = rand() * tile;
      // 이어 붙인 판 위에서의 거리 — 타일 경계 너머의 별과도 너무 겹치지 않게
      const clash = stars.some((other) => {
        const dx = Math.min(Math.abs(other.x - x), tile - Math.abs(other.x - x));
        const dy = Math.min(Math.abs(other.y - y), tile - Math.abs(other.y - y));
        return Math.hypot(dx, dy) < (other.r + r) * 0.92;
      });
      if (clash) continue;

      const small = r < 45;
      const shape = small
        ? pick<Shape>(rand, [['fill', 6], ['outline', 1]])
        : pick<Shape>(rand, [['fill', 3], ['outline', 3], ['double', 2], ['nested', 2]]);
      const render = pick<Render>(rand, [['solid', 1], ['halftone', 4], ['soft', 4]]);
      stars.push({
        form,
        x,
        y,
        r,
        inner: 0.44 + rand() * 0.1,
        rot: rand() * Math.PI * 2,
        shape,
        render,
        blur: render === 'soft' ? r * (0.08 + rand() * 0.16) : render === 'halftone' ? r * 0.03 : 0,
        tone: render === 'solid' ? 1 : 0.5 + rand() * 0.5,
        // 하프톤 선은 점 몇 줄은 지나가야 선으로 읽힌다 — 너무 가늘면 끊겨 보인다
        line: render === 'solid' ? Math.max(7, r * (0.12 + rand() * 0.06)) : Math.max(16, r * (0.18 + rand() * 0.1)),
      });
      break;
    }
  }
  return stars;
}

/** 상자 흐림 세 번 ≈ 가우스 흐림. 캔버스 filter 를 못 쓰는 브라우저도 있어 직접 한다 */
function boxBlur(alpha: Float32Array, w: number, h: number, radius: number): void {
  if (radius < 1) return;
  const tmp = new Float32Array(alpha.length);
  const pass = (src: Float32Array, dst: Float32Array, horizontal: boolean) => {
    const len = horizontal ? w : h;
    const lines = horizontal ? h : w;
    const span = radius * 2 + 1;
    for (let line = 0; line < lines; line += 1) {
      const at = (i: number) => (horizontal ? line * w + i : i * w + line);
      let sum = 0;
      for (let i = -radius; i <= radius; i += 1) sum += src[at(Math.min(len - 1, Math.max(0, i)))];
      for (let i = 0; i < len; i += 1) {
        dst[at(i)] = sum / span;
        sum += src[at(Math.min(len - 1, i + radius + 1))] - src[at(Math.max(0, i - radius))];
      }
    }
  };
  for (let k = 0; k < 3; k += 1) {
    pass(alpha, tmp, true);
    pass(tmp, alpha, false);
  }
}

/** 하프톤으로 그릴 별의 농도를 격자에 쌓는다 */
function accumulate(star: Star, grid: Float32Array, cols: number, rows: number): void {
  const pad = Math.ceil(star.blur * 3 + star.line + 4);
  const size = Math.ceil(star.r * 2 + pad * 2);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const c = size / 2;
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineJoin = 'round';
  for (const part of parts(star)) {
    ctx.beginPath();
    if (star.form === 'circle') ctx.arc(c, c, part.r, 0, Math.PI * 2);
    else starPoints(c, c, part.r, star.inner, star.rot).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    if (part.stroke) {
      ctx.lineWidth = part.stroke;
      ctx.stroke();
    } else {
      ctx.fill();
    }
  }

  const pixels = ctx.getImageData(0, 0, size, size).data;
  const alpha = new Float32Array(size * size);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = pixels[i * 4 + 3] / 255;
  boxBlur(alpha, size, size, Math.round(star.blur * 0.58));

  // 별이 덮는 범위의 격자점마다 농도를 잰다 (격자는 타일마다 되풀이되므로 나머지로 접는다)
  const left = star.x - c;
  const top = star.y - c;
  const j0 = Math.floor(top / ROW);
  const j1 = Math.ceil((top + size) / ROW);
  for (let j = j0; j <= j1; j += 1) {
    const y = j * ROW;
    const shift = (((j % 2) + 2) % 2) * ROW;
    const i0 = Math.floor((left - shift) / PITCH);
    const i1 = Math.ceil((left + size - shift) / PITCH);
    for (let i = i0; i <= i1; i += 1) {
      const x = i * PITCH + shift;
      const lx = Math.round(x - left);
      const ly = Math.round(y - top);
      if (lx < 0 || ly < 0 || lx >= size || ly >= size) continue;
      const a = alpha[ly * size + lx] * star.tone;
      if (a <= 0.01) continue;
      const cell = (((j % rows) + rows) % rows) * cols + (((i % cols) + cols) % cols);
      // 겹치는 별은 '덧칠' 처럼 합친다 — 더해서 1 을 넘기지 않는다
      grid[cell] = 1 - (1 - grid[cell]) * (1 - a);
    }
  }
}

const cached = new Map<string, StarField>();

/** 꼴마다 시드를 달리한다 — 별과 물방울의 배치가 똑같으면 바꿔 끼운 티가 난다 */
const SEED: Record<Form, number> = { star: 20261022, circle: 20261105 };

/**
 * 별 · 물방울 무늬 한 칸. (꼴, 간격) 마다 처음 한 번만 계산한다 (수백 ms).
 *
 * spread 는 간격 배율 — 별 개수·크기는 그대로 두고 타일만 넓혀 사이를 벌린다.
 * 타일을 그냥 띄워 놓으면 격자처럼 줄 맞춰 빈 곳이 생기므로, 넓힌 타일 안에 다시 흩뿌린다.
 */
export function shapeField(form: Form, spread = 1): StarField {
  const tile = Math.round((STAR_TILE * spread) / PITCH) * PITCH;
  const key = `${form}:${tile}`;
  const hit = cached.get(key);
  if (hit) return hit;
  const cols = tile / PITCH;
  const rows = tile / ROW;
  const rand = mulberry32(SEED[form]);
  const stars = placeStars(rand, form, tile);

  const solids: StarSolid[] = [];
  const grid = new Float32Array(cols * rows);
  for (const star of stars) {
    if (star.render === 'solid') {
      for (const [dx, dy] of wrapOffsets(star.x, star.y, star.r + star.line, tile)) {
        for (const part of parts(star)) {
          solids.push({ d: shapeD(star.form, star.x + dx, star.y + dy, part.r, star.inner, star.rot), stroke: part.stroke });
        }
      }
    } else {
      accumulate(star, grid, cols, rows);
    }
  }

  const dots: string[] = [];
  for (let j = 0; j < rows; j += 1) {
    const shift = (j % 2) * ROW;
    for (let i = 0; i < cols; i += 1) {
      /*
       * 옅은 꼬리는 잘라 낸다. 번진 별의 꼬리가 여럿 겹치면 바탕 전체에 잔 점이 깔려
       * 회색 안개처럼 보였다 — 레퍼런스는 별 사이가 깨끗하다.
       */
      const v = Math.max(0, (grid[j * cols + i] - FLOOR) / (1 - FLOOR));
      const r = DOT_MAX * v ** 0.7;
      if (r < 0.9) continue;
      const x0 = i * PITCH + shift;
      const y0 = j * ROW;
      for (const [dx, dy] of wrapOffsets(x0, y0, r, tile)) {
        const x = f1(x0 + dx - r);
        const y = f1(y0 + dy);
        const rr = f1(r);
        dots.push(`M${x} ${y}a${rr} ${rr} 0 1 0 ${f1(r * 2)} 0a${rr} ${rr} 0 1 0 ${f1(-r * 2)} 0`);
      }
    }
  }

  const field = { tile, solids, dots: dots.join('') };
  cached.set(key, field);
  return field;
}

/* ------------------------------------------------------------------ */
/* 타탄 체크 — 두 색의 띠를 가로·세로로 반투명하게 겹친다                 */
/* ------------------------------------------------------------------ */

/** 타탄 한 칸 (간격 100% 일 때, 타일 좌표) */
export const PLAID_TILE = 120;

export interface PlaidStripe {
  at: number;
  width: number;
  /** 1 = 무늬 색, 2 = 둘째 색 */
  tone: 1 | 2;
  opacity: number;
}

/**
 * 레퍼런스(청록 넓은 띠 + 갈색 중간 띠 + 짙은 가는 선)를 두 색으로 옮긴 것.
 * 가로·세로에 같은 띠를 깔면 겹친 자리가 저절로 진해져 체크의 농담이 생긴다.
 * 간격을 벌리면 띠는 그대로 두고 띠 묶음 사이의 바탕만 넓어진다.
 */
export function plaidStripes(spread: number): { tile: number; stripes: PlaidStripe[] } {
  const extra = PLAID_TILE * (spread - 1);
  // 넓은 띠 안의 가는 선 두 줄이 레퍼런스의 짙은 남색 선 역할을 한다 (겹쳐서 더 진해짐)
  const stripes: PlaidStripe[] = [
    { at: 0, width: 40, tone: 1, opacity: 0.5 },
    { at: 8, width: 3, tone: 1, opacity: 0.9 },
    { at: 29, width: 3, tone: 1, opacity: 0.9 },
    { at: 48, width: 16, tone: 2, opacity: 0.55 },
    { at: 55, width: 2, tone: 2, opacity: 1 },
    { at: 76, width: 22, tone: 1, opacity: 0.32 },
    { at: 104, width: 3, tone: 2, opacity: 0.8 },
  ];
  return { tile: PLAID_TILE + extra, stripes };
}

/* ------------------------------------------------------------------ */
/* 동그라미 — 손으로 오린 듯한 큰 원을 맞닿게 늘어놓은 무늬              */
/* ------------------------------------------------------------------ */

/** 한 변의 원 개수와 원 사이 거리 (간격 100% 일 때, 타일 좌표) */
const ROUND_COUNT = 6;
const ROUND_PITCH = 100;
/**
 * 원 반지름 — 거리의 절반보다 살짝 커서 이웃 원과 맞닿는다. 그래야 사이에 남는 자리가
 * 따로 떨어진 네 꼭지 별이 된다 (레퍼런스처럼). 간격을 벌려도 그대로다.
 */
const ROUND_R = 50.5;

/**
 * 원 하나. 둘레를 몇 개의 사인 물결로 살짝 일그러뜨려 손으로 오린 느낌을 낸다.
 * 점을 이은 뒤 Catmull-Rom 곡선으로 매끈하게 잇는다 (꺾인 자국이 보이지 않게).
 */
function wobblyCircle(cx: number, cy: number, r: number, rand: () => number): string {
  const n = 28;
  // 너무 크게 일그러뜨리면 원이 아니라 덩어리로 보인다 — 반지름의 1~2% 정도만
  const waves = [2, 3, 5].map((k) => ({ k, amp: (0.005 + rand() * 0.009) * r, phase: rand() * Math.PI * 2 }));
  const pts: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * Math.PI * 2;
    const rr = r + waves.reduce((sum, w) => sum + w.amp * Math.sin(w.k * t + w.phase), 0);
    pts.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t)]);
  }
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i + n - 1) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return `${d}Z`;
}

type Pt = [number, number];

const roundCache = new Map<number, { tile: number; d: string }>();

/**
 * 동그라미 한 타일의 원들. 그리는 쪽은 타일을 무늬 색으로 칠하고 그 위에 원을 바탕색으로 덮는다 —
 * 원 네 개 사이에 남은 자리가 네 꼭지 별처럼 보인다.
 * (구멍을 뚫는 evenodd 는 원끼리 겹친 자리가 다시 칠해져 원 사이에 실금이 생겼다.)
 * 간격을 벌리면 원은 그대로 두고 원 사이 거리만 넓어져 별이 굵어진다.
 */
export function roundField(spread = 1): { tile: number; d: string } {
  const pitch = Math.round(ROUND_PITCH * spread);
  const hit = roundCache.get(pitch);
  if (hit) return hit;
  const tile = pitch * ROUND_COUNT;
  const rand = mulberry32(20261023);
  let d = '';
  for (let j = 0; j < ROUND_COUNT; j += 1) {
    for (let i = 0; i < ROUND_COUNT; i += 1) {
      const x = (i + 0.5) * pitch;
      const y = (j + 0.5) * pitch;
      // 원마다 일그러짐이 달라야 손맛이 난다. 같은 원은 타일 가장자리 너머에도 똑같이 그린다
      const seed = Math.floor(rand() * 4294967296);
      for (const [dx, dy] of wrapOffsets(x, y, ROUND_R * 1.1, tile)) {
        d += wobblyCircle(x + dx, y + dy, ROUND_R, mulberry32(seed));
      }
    }
  }
  const field = { tile, d };
  roundCache.set(pitch, field);
  return field;
}

/** 무늬마다 100% 일 때 한 칸의 크기 (화면 px) */
export const PATTERN_BASE = {
  dots: 22, check: 48, stars: 760, bubbles: 760, plaid: 120, rounds: 360,
} as const;
