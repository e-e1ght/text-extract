import { useEffect, useId, useMemo, useState } from 'react';
import { ASCII_FONT, ASCII_LINE_HEIGHT, imageToAscii, loadImage } from '../lib/ascii';
import { PATTERN_BASE, STAR_TILE, shapeField } from '../lib/patterns';
import type { PatternKind } from '../types';

interface PatternProps {
  kind: PatternKind;
  /** 배율 (%) */
  scale: number;
  color: string;
  angle: number;
  opacity: number;
}

/** 무늬 한 칸의 내용. 좌표는 각 무늬의 '기본 칸' 기준이다 */
function Tile({ kind }: { kind: PatternKind }) {
  if (kind === 'dots') {
    // 땡땡이 — 엇갈려 놓아야 줄무늬처럼 보이지 않는다
    const s = PATTERN_BASE.dots;
    const r = s * 0.16;
    return (
      <>
        <circle cx={s / 4} cy={s / 4} r={r} />
        <circle cx={(s * 3) / 4} cy={(s * 3) / 4} r={r} />
      </>
    );
  }
  if (kind === 'check') {
    const half = PATTERN_BASE.check / 2;
    return (
      <>
        <rect x={0} y={0} width={half} height={half} />
        <rect x={half} y={half} width={half} height={half} />
      </>
    );
  }
  // 별과 물방울은 같은 계산기로 꼴만 바꿔 만든다
  const field = shapeField(kind === 'bubbles' ? 'circle' : 'star');
  return (
    <>
      <path d={field.dots} />
      {field.solids.map((solid, i) => (
        solid.stroke
          ? <path key={i} d={solid.d} fill="none" stroke="currentColor" strokeWidth={solid.stroke} strokeLinejoin="round" />
          : <path key={i} d={solid.d} />
      ))}
    </>
  );
}

/**
 * 무늬를 깐 판. 부모를 꽉 채운다.
 * 회전은 patternTransform 으로 한다 — 무늬가 무한히 이어지므로 아무리 긴 결과물이어도
 * 돌린 뒤 모서리가 비지 않는다.
 */
export function PatternFill({ kind, scale, color, angle, opacity }: PatternProps) {
  const id = `te-pat-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const computed = kind === 'stars' || kind === 'bubbles';
  const base = computed ? STAR_TILE : PATTERN_BASE[kind];
  // 별·물방울은 계산한 칸(STAR_TILE)을 화면 크기(PATTERN_BASE)로 줄여 쓴다
  const k = ((computed ? PATTERN_BASE[kind] / STAR_TILE : 1) * scale) / 100;
  return (
    <svg className="bg-pattern" width="100%" height="100%" aria-hidden="true" style={{ color }}>
      <defs>
        <pattern
          id={id}
          patternUnits="userSpaceOnUse"
          width={base}
          height={base}
          patternTransform={`rotate(${angle}) scale(${k})`}
        >
          <g fill="currentColor">
            <Tile kind={kind} />
          </g>
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
