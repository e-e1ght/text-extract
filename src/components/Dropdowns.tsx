import { useEffect, useRef, useState } from 'react';
import { ensureWebFont } from '../lib/webfonts';

/**
 * 편집 패널·본문 탭에서 쓰는 드롭다운 둘.
 *
 * 목록은 떠 있는 상자가 아니라 **그 자리에서 아래로 펼친다**. 편집 패널은 넘치는 부분을
 * 잘라 내므로 떠 있는 목록은 잘리고, 펼치면 패널 높이도 저절로 맞춰진다.
 */

/** 바깥을 누르거나 Esc 를 누르면 닫는다 */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

const firstFamily = (stack: string) => (stack.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '');

/** 글꼴 고르기 — 목록의 글꼴 이름을 그 글꼴로 보여 준다 */
export function FontSelect({ value, options, onPick }: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  // 값은 'A, B, serif' 처럼 오기도 하고 계산된 'A, B' 로도 온다 — 첫 이름으로 맞춘다
  const current = options.find((o) => firstFamily(o.value) === firstFamily(value));

  // 펼칠 때 목록의 글꼴을 붙인다. 붙이기만 하고, 파일은 그 이름을 그릴 때 받는다.
  useEffect(() => { if (open) options.forEach((o) => ensureWebFont(o.value)); }, [open, options]);

  return (
    <div className={`dd${open ? ' is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className="dd-trigger"
        style={{ fontFamily: current?.value ?? value }}
        onClick={() => setOpen((v) => !v)}
        title="글꼴"
      >
        <span className="dd-text">{current?.label ?? firstFamily(value)}</span>
        <span className="dd-caret">▾</span>
      </button>
      {open ? (
        <div className="dd-list" role="listbox">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o === current}
              className={`dd-item${o === current ? ' is-active' : ''}`}
              style={{ fontFamily: o.value }}
              onClick={() => { onPick(o.value); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const SIZE_PRESETS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72];

/** 글자 크기 — 숫자를 치거나(Enter) 목록에서 고른다 */
export function SizeCombo({ value, onApply, min = 8, max = 200 }: {
  value: number;
  onApply: (size: number) => void;
  min?: number;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(String(value));
  const ref = useDismiss(open, () => setOpen(false));
  useEffect(() => { setText(String(value)); }, [value]);

  const apply = (raw: string | number) => {
    const n = Math.round(Number(raw) * 10) / 10;
    if (!Number.isFinite(n) || n < min || n > max) return;
    setText(String(n));
    onApply(n);
  };

  return (
    <div className={`dd dd-size${open ? ' is-open' : ''}`} ref={ref}>
      <div className="dd-combo">
        <input
          type="number"
          min={min}
          max={max}
          value={text}
          aria-label="글자 크기"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            // 본문 선택을 되살려 적용한다 — Enter 가 본문에서 줄 바꾸기로 실행되지 않게 막는다
            event.preventDefault();
            apply(text);
          }}
        />
        <span className="dd-unit">px</span>
        <button type="button" className="dd-caret-btn" title="크기 목록" onClick={() => setOpen((v) => !v)}>▾</button>
      </div>
      {open ? (
        <div className="dd-list dd-list-grid" role="listbox">
          {SIZE_PRESETS.map((size) => (
            <button
              key={size}
              type="button"
              role="option"
              aria-selected={size === value}
              className={`dd-item${size === value ? ' is-active' : ''}`}
              onClick={() => { apply(size); setOpen(false); }}
            >
              {size}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
