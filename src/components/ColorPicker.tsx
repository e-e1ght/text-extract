import { useEffect, useRef, useState } from 'react';
import { RecentSwatches } from './ui';

/**
 * 포토샵식 색 고르기 — 채도·밝기 사각형 + 색상 막대 + 색 코드.
 *
 * 끄는 동안에는 미리보기만 바꾸고, 손을 뗄 때 한 번만 적용한다. 끄는 내내 적용하면
 * 글자에 서식이 수십 겹 쌓이고 되돌리기 기록도 끄는 걸음마다 남는다.
 */

type Hsv = { h: number; s: number; v: number };

function hexToHsv(hex: string): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { h: 0, s: 0, v: 0 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** 'rgb(…)' 같은 계산된 색도 #rrggbb 로 */
export function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(color);
  if (!m) return '#000000';
  return `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')}`;
}

/** 누른 채 끌면 0~1 좌표로 알려 준다 */
function track(event: React.PointerEvent<HTMLElement>, onMove: (x: number, y: number) => void, onEnd: () => void) {
  const box = event.currentTarget.getBoundingClientRect();
  const at = (e: { clientX: number; clientY: number }) => onMove(
    Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
    Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
  );
  at(event);
  const move = (e: PointerEvent) => at(e);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    onEnd();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

export function ColorPicker({ value, onPick, swatches = [] }: {
  value: string;
  /** 고른 색을 적용한다 (손을 뗄 때 · 견본을 누를 때 · 코드를 입력했을 때) */
  onPick: (hex: string) => void;
  swatches?: string[];
}) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(toHex(value)));
  const [code, setCode] = useState(toHex(value));
  const live = useRef(hsv);
  live.current = hsv;

  // 밖에서 대상이 바뀌면(다른 글을 고름) 그 색으로 맞춘다
  useEffect(() => {
    const next = hexToHsv(toHex(value));
    setHsv((prev) => (hsvToHex(prev) === toHex(value) ? prev : next));
    setCode(toHex(value));
  }, [value]);

  const hex = hsvToHex(hsv);
  const set = (next: Hsv) => {
    setHsv(next);
    setCode(hsvToHex(next));
  };
  const commit = () => onPick(hsvToHex(live.current));

  return (
    <div className="cp">
      <div
        className="cp-sv"
        style={{ background: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(event) => track(event, (x, y) => set({ ...live.current, s: x, v: 1 - y }), commit)}
      >
        <span className="cp-sv-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <div
        className="cp-hue"
        onPointerDown={(event) => track(event, (x) => set({ ...live.current, h: x * 360 }), commit)}
      >
        <span className="cp-hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
      <div className="cp-row">
        <span className="cp-now" style={{ background: hex }} title="지금 색" />
        <input
          className="cp-code"
          value={code}
          spellCheck={false}
          maxLength={7}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            /*
             * Enter 의 기본 동작을 반드시 막는다. 적용하면서 본문 선택을 되살리는데, 막지 않으면
             * 그 Enter 가 되살린 선택 위에서 '줄 바꾸기' 로 실행돼 고른 글이 빈 줄로 바뀐다.
             */
            event.preventDefault();
            const v = code.startsWith('#') ? code : `#${code}`;
            if (/^#[0-9a-f]{6}$/i.test(v)) {
              setHsv(hexToHsv(v));
              onPick(v.toLowerCase());
            }
          }}
          aria-label="색 코드 (Enter 로 적용)"
        />
        {swatches.map((color) => (
          <button key={color} type="button" className="swatch" style={{ background: color }} title={color}
            onClick={() => { setHsv(hexToHsv(color)); setCode(color); onPick(color); }} />
        ))}
      </div>
      <RecentSwatches compact onPick={(color) => { setHsv(hexToHsv(color)); setCode(color); onPick(color); }} />
    </div>
  );
}
