import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ASCII_FONT, ASCII_LINE_HEIGHT, imageToAscii, loadImage } from '../lib/ascii';
import {
  PATTERN_BASE, PLAID_TILE, STAR_TILE, cellField, plaidStripes, shapeField,
} from '../lib/patterns';
import type { PatternKind } from '../types';

interface PatternProps {
  kind: PatternKind;
  /** 배율 (%) */
  scale: number;
  color: string;
  /** 둘째 색 — 타탄 체크만 쓴다 */
  color2?: string;
  angle: number;
  opacity: number;
  /** 무늬 사이 간격 (%). 무늬 하나하나의 크기는 그대로 두고 사이만 벌린다 */
  gap?: number;
}

/** 간격을 다루지 않는 무늬 — 바둑판은 칸끼리 맞닿아 있어 벌릴 사이가 없다 */
export const PATTERN_NO_GAP: PatternKind[] = ['check'];

/** 물결 칸의 타일 — 간격은 선 굵기라 타일 크기는 늘 같다 */
const CELL_TILE = cellField(1).tile;

/**
 * 별·물방울은 간격마다 다시 계산하므로(수백 ms) 25% 단위로 묶는다.
 * 슬라이더를 끄는 동안 값마다 계산하면 화면이 끊긴다.
 */
const starSpread = (gap: number) => Math.max(1, Math.round(gap / 25) * 25) / 100;

/** 무늬 한 칸의 크기(타일 좌표)와 내용 */
function tileOf(kind: PatternKind, gap: number, color2: string): { size: number; body: ReactNode } {
  const spread = Math.max(1, gap / 100);
  if (kind === 'dots') {
    // 땡땡이 — 엇갈려 놓아야 줄무늬처럼 보이지 않는다. 점 크기는 간격과 무관하다
    const s = PATTERN_BASE.dots;
    const size = s * spread;
    const r = s * 0.16;
    return {
      size,
      body: (
        <>
          <circle cx={size / 4} cy={size / 4} r={r} />
          <circle cx={(size * 3) / 4} cy={(size * 3) / 4} r={r} />
        </>
      ),
    };
  }
  if (kind === 'check') {
    const half = PATTERN_BASE.check / 2;
    return {
      size: PATTERN_BASE.check,
      body: (
        <>
          <rect x={0} y={0} width={half} height={half} />
          <rect x={half} y={half} width={half} height={half} />
        </>
      ),
    };
  }
  if (kind === 'plaid') {
    const { tile, stripes } = plaidStripes(spread);
    return {
      size: tile,
      body: (
        <>
          {stripes.map((stripe, i) => {
            const fill = stripe.tone === 2 ? color2 : 'currentColor';
            return (
              <g key={i} fill={fill} opacity={stripe.opacity}>
                <rect x={stripe.at} y={0} width={stripe.width} height={tile} />
                <rect x={0} y={stripe.at} width={tile} height={stripe.width} />
              </g>
            );
          })}
        </>
      ),
    };
  }
  if (kind === 'cells') {
    const field = cellField(spread);
    return { size: field.tile, body: <path d={field.d} fillRule="evenodd" /> };
  }
  // 별과 물방울은 같은 계산기로 꼴만 바꿔 만든다
  const field = shapeField(kind === 'bubbles' ? 'circle' : 'star', starSpread(gap));
  return {
    size: field.tile,
    body: (
      <>
        <path d={field.dots} />
        {field.solids.map((solid, i) => (
          solid.stroke
            ? <path key={i} d={solid.d} fill="none" stroke="currentColor" strokeWidth={solid.stroke} strokeLinejoin="round" />
            : <path key={i} d={solid.d} />
        ))}
      </>
    ),
  };
}

/** 타일 좌표 → 화면 px 배율 (100% 기준). 간격을 벌려도 무늬 자체는 같은 크기로 보이게 */
function unitScale(kind: PatternKind): number {
  if (kind === 'stars' || kind === 'bubbles') return PATTERN_BASE[kind] / STAR_TILE;
  if (kind === 'plaid') return PATTERN_BASE.plaid / PLAID_TILE;
  if (kind === 'cells') return PATTERN_BASE.cells / CELL_TILE;
  return 1;
}

/**
 * 무늬를 깐 판. 부모를 꽉 채운다.
 * 회전은 patternTransform 으로 한다 — 무늬가 무한히 이어지므로 아무리 긴 결과물이어도
 * 돌린 뒤 모서리가 비지 않는다.
 */
export function PatternFill({
  kind, scale, color, color2 = color, angle, opacity, gap = 100,
}: PatternProps) {
  const id = `te-pat-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { size, body } = useMemo(
    () => tileOf(kind, PATTERN_NO_GAP.includes(kind) ? 100 : gap, color2),
    [kind, gap, color2],
  );
  const k = (unitScale(kind) * scale) / 100;
  return (
    <svg className="bg-pattern" width="100%" height="100%" aria-hidden="true" style={{ color }}>
      <defs>
        <pattern
          id={id}
          patternUnits="userSpaceOnUse"
          width={size}
          height={size}
          patternTransform={`rotate(${angle}) scale(${k})`}
        >
          <g fill="currentColor">{body}</g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </svg>
  );
}

interface AsciiProps {
  url: string;
  color: string;
  columns: number;
  fontSize: number;
  contrast: number;
  invert: boolean;
  x: number;
  y: number;
}

/** 이미지를 글자로 바꿔 깐 판. (x, y) 는 배경 이미지와 같은 규칙의 위치(%) */
/** 아트를 실제로 그리는 글자 크기 — 정수이고 커야 저장할 때 크기 오차가 작다 */
const ASCII_BASE_SIZE = 50;

export function AsciiArt({ url, color, columns, fontSize, contrast, invert, x, y }: AsciiProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let alive = true;
    setImg(null);
    if (!url) return undefined;
    loadImage(url).then((loaded) => { if (alive) setImg(loaded); }).catch(() => {});
    return () => { alive = false; };
  }, [url]);

  const text = useMemo(
    () => (img ? imageToAscii(img, { columns, contrast, invert }) : ''),
    [img, columns, contrast, invert],
  );
  if (!text) return null;

  /*
   * 글자 크기를 그대로 주지 않고 큰 크기로 그린 뒤 줄인다. 저장할 때 html-to-image 가 글자 크기를
   * '내림 − 0.1px' 로 바꿔 쓰는데, 아트는 6.8px 같은 소수 크기라 5.9px 로 13% 작게 저장돼
   * 오른쪽이 비었다. 50px 로 그리면 그 오차가 0.2% 라 보이지 않는다.
   */
  const scale = fontSize / ASCII_BASE_SIZE;
  return (
    <pre
      className="bg-ascii"
      aria-hidden="true"
      style={{
        /*
         * 위치 규칙은 배경 이미지(background-position)와 같다: 0% 면 글 상자의 왼쪽(위) 끝이
         * 판의 왼쪽(위) 끝에, 100% 면 오른쪽(아래) 끝끼리 맞는다. 판보다 큰 아트도 끝까지 옮길 수 있다.
         * (예전에는 가운데 자리를 0~100% 로 묶어, 판보다 큰 아트는 맨 위까지 못 올렸다.)
         * translate 의 % 는 줄이기 전 크기 기준이라 줄인 비율을 곱한다.
         */
        left: `${x}%`,
        top: `${y}%`,
        transformOrigin: '0 0',
        transform: `translate(${-x * scale}%, ${-y * scale}%) scale(${scale})`,
        color,
        fontSize: `${ASCII_BASE_SIZE}px`,
        lineHeight: ASCII_LINE_HEIGHT,
        fontFamily: ASCII_FONT,
      }}
    >
      {text}
    </pre>
  );
}
