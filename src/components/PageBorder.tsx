import type { CSSProperties } from 'react';
import type { BorderStyle, PageBorder as Border } from '../types';

/**
 * 결과물 가장자리를 두르는 테두리.
 *
 * CSS border 는 파선 길이를 고를 수 없고 일점쇄선이 없어 SVG 로 긋는다.
 * 무늬 길이는 굵기에 비례시킨다 — 그래야 굵게 해도 같은 모양으로 보인다.
 * 배경 위 · 글 아래 층에 깔리므로 글에는 손대지 않는다.
 */

/** 굵기 w 일 때의 선 무늬 (그리기, 비우기, …) */
function dashOf(style: BorderStyle, w: number): { dash?: string; cap: 'butt' | 'round' } {
  switch (style) {
    case 'dashed': return { dash: `${w * 3} ${w * 2.5}`, cap: 'butt' };
    case 'longdash': return { dash: `${w * 9} ${w * 4}`, cap: 'butt' };
    // 길이 0 + 둥근 끝 = 동그란 점
    case 'dotted': return { dash: `0 ${w * 2.4}`, cap: 'round' };
    case 'dashdot': return { dash: `${w * 9} ${w * 3} 0 ${w * 3}`, cap: 'round' };
    default: return { cap: 'butt' };
  }
}

/**
 * 가장자리에서 inset 만큼 들어간 판 위에, 판 가장자리에서 offset 만큼 들어간 곳을 중심으로 긋는 선 하나.
 *
 * svg 판은 늘 정수 자리(inset)에 둔다. 예전에는 선의 중심(inset + 굵기/2)에 판을 놓았는데,
 * 굵기 1px 이면 판이 0.5px 자리에 서고, 저장할 때 그 자리가 1px 로 반올림돼 선이 반 칸 밀렸다 —
 * 안쪽 거리 0 이면 아래·오른쪽 선이 결과물 밖으로 밀려 잘렸다. 그래서 반 칸은 판 안의 좌표로만 준다.
 * 사각형 크기는 'calc(100% - …)' 라 속성 대신 CSS 로 준다 (SVG2 의 x · y · width · height 속성).
 */
function Line({ inset, offset, w, style, color, radius }: {
  inset: number; offset: number; w: number; style: BorderStyle; color: string; radius: number;
}) {
  const { dash, cap } = dashOf(style, w);
  return (
    <svg
      className="page-border-line"
      style={{ left: inset, top: inset, width: `calc(100% - ${inset * 2}px)`, height: `calc(100% - ${inset * 2}px)` }}
    >
      <rect
        width="100%"
        height="100%"
        style={{
          x: `${offset}px`,
          y: `${offset}px`,
          width: `calc(100% - ${offset * 2}px)`,
          height: `calc(100% - ${offset * 2}px)`,
        } as CSSProperties}
        rx={Math.max(0, radius - inset - offset)}
        fill="none"
        stroke={color}
        strokeWidth={w}
        strokeDasharray={dash}
        strokeLinecap={cap}
      />
    </svg>
  );
}

export function PageBorder({ border, radius }: { border: Border; radius: number }) {
  if (!border.enabled || border.width <= 0) return null;
  const { width: w, inset, style, color, opacity } = border;
  // 판은 정수 자리에 — 안쪽 거리의 소수 부분은 선 중심 쪽으로 넘긴다
  const base = Math.floor(inset);
  const center = inset - base + w / 2;
  return (
    <div className="page-border" style={{ opacity }} aria-hidden="true">
      {style === 'double' ? (
        <>
          {/* 겹선 — 같은 굵기 두 줄, 사이는 굵기의 두 배 남짓 */}
          <Line inset={base} offset={center} w={w} style="solid" color={color} radius={radius} />
          <Line inset={base} offset={center + w * 3} w={w} style="solid" color={color} radius={radius} />
        </>
      ) : (
        <Line inset={base} offset={center} w={w} style={style} color={color} radius={radius} />
      )}
    </div>
  );
}

export const BORDER_STYLES: Array<{ value: BorderStyle; label: string }> = [
  { value: 'solid', label: '실선' },
  { value: 'dashed', label: '파선' },
  { value: 'longdash', label: '긴 파선' },
  { value: 'dotted', label: '점선' },
  { value: 'double', label: '겹선' },
  { value: 'dashdot', label: '일점쇄선' },
];

/** 고르는 단추 안의 작은 견본 */
export function BorderSample({ style }: { style: BorderStyle }) {
  const w = 2;
  const { dash, cap } = dashOf(style === 'double' ? 'solid' : style, w);
  const line = (y: number) => (
    <line x1={3} x2={53} y1={y} y2={y} stroke="currentColor" strokeWidth={w}
      strokeDasharray={dash} strokeLinecap={cap} />
  );
  return (
    <svg className="border-sample" viewBox="0 0 56 12" aria-hidden="true">
      {style === 'double' ? <>{line(3)}{line(9)}</> : line(6)}
    </svg>
  );
}

/** 선 모양 고르기 — 페이지 테두리 · 본문 구분선 · 이미지 슬롯 테두리가 함께 쓴다 */
export function BorderStylePicker({ value, onChange, label = '선 모양' }: {
  value: BorderStyle; onChange: (style: BorderStyle) => void; label?: string;
}) {
  return (
    <div className="field">
      <div className="field-label"><span>{label}</span></div>
      <div className="button-group border-styles">
        {BORDER_STYLES.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.label}
            className={value === option.value ? 'is-active' : ''}
            onClick={() => onChange(option.value)}
          >
            <BorderSample style={option.value} />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
