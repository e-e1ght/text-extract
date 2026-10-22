import { useEffect, useRef, useState } from 'react';
import { STICKER_LOOK } from '../defaults';
import { outlinedSticker } from '../lib/stickerOutline';
import { useStore } from '../store';
import type { Sticker } from '../types';

/** '#rrggbb' + 불투명도 → rgba() */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * 스티커 그림 — 외곽선을 두르면 캔버스로 만든 그림으로 바꿔 끼운다(lib/stickerOutline).
 * 외곽선만큼 그림이 커지므로 그만큼 바깥으로 넓혀 그려, 스티커 자리·크기는 그대로 둔다.
 * 그림자는 drop-shadow 라 네모가 아니라 외곽선까지 포함한 그림 모양을 따라 진다.
 */
function StickerImage({ sticker }: { sticker: Sticker }) {
  const look = { ...STICKER_LOOK, ...sticker };
  const ref = useRef<HTMLImageElement | null>(null);
  const [outlined, setOutlined] = useState<{ key: string; src: string } | null>(null);
  const width = look.outline ? look.outlineWidth : 0;
  const key = `${look.outlineColor}|${width}|${sticker.width}|${sticker.url.length}`;

  useEffect(() => {
    if (!width) return undefined;
    let alive = true;
    // 크기 손잡이를 끄는 동안 매번 다시 그리지 않게 잠깐 기다린다 (그동안은 예전 그림을 늘려 쓴다)
    const timer = window.setTimeout(() => {
      const box = ref.current?.parentElement;
      if (!box) return;
      outlinedSticker(sticker.url, look.outlineColor, width, box.offsetWidth)
        .then((src) => { if (alive) setOutlined({ key, src }); })
        .catch(() => {});
    }, outlined ? 160 : 0);
    return () => { alive = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const useOutline = width > 0 && outlined;
  const d = look.shadowDistance / Math.SQRT2;
  return (
    <img
      ref={ref}
      src={useOutline ? outlined.src : sticker.url}
      alt=""
      draggable={false}
      style={{
        ...(useOutline ? { width: `calc(100% + ${width * 2}px)`, margin: -width, maxWidth: 'none' } : null),
        filter: look.shadow
          ? `drop-shadow(${d}px ${d}px ${look.shadowBlur}px ${withAlpha(look.shadowColor, look.shadowOpacity)})`
          : undefined,
      }}
    />
  );
}

/**
 * 본문 위에 얹는 이미지.
 * 미리보기에서 바로 끌어 옮기고, 오른쪽 아래 손잡이로 크기를,
 * 위쪽 손잡이로 각도를 바꾼다.
 * 위치·크기는 결과물 너비 대비 % 라 확대·축소를 해도 흔들리지 않는다.
 */
export function Stickers({ zoom }: { zoom: number }) {
  const { settings, set, selectedSticker, setSelectedSticker } = useStore();
  const drag = useRef<
    { mode: 'move' | 'resize'; x: number; y: number; start: Sticker }
    | { mode: 'rotate'; cx: number; cy: number; base: number; start: Sticker }
    | null
  >(null);

  if (settings.stickers.length === 0) return null;

  const update = (id: string, patch: Partial<Sticker>) => {
    set('stickers', settings.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  /** 화면 좌표에서 중심을 향한 각도 (deg). 12시가 0. */
  const angleTo = (cx: number, cy: number, x: number, y: number) =>
    (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;

  const onMove = (event: React.PointerEvent, sticker: Sticker) => {
    const state = drag.current;
    if (!state) return;

    if (state.mode === 'rotate') {
      const now = angleTo(state.cx, state.cy, event.clientX, event.clientY);
      let next = state.start.rotation + (now - state.base);
      // Shift 를 누르면 15도 단위로 맞춘다
      if (event.shiftKey) next = Math.round(next / 15) * 15;
      update(sticker.id, { rotation: Math.round(next * 10) / 10 });
      return;
    }

    const host = (event.currentTarget as HTMLElement).closest('.te-capture') as HTMLElement | null;
    if (!host) return;

    // 화면상 이동량을 확대 배율로 나눠, 실제 결과물 기준 값으로 되돌린다.
    const dx = ((event.clientX - state.x) / zoom / host.offsetWidth) * 100;
    const dy = ((event.clientY - state.y) / zoom / host.offsetHeight) * 100;

    if (state.mode === 'move') {
      update(sticker.id, {
        x: Math.min(120, Math.max(-20, state.start.x + dx)),
        y: Math.min(120, Math.max(-20, state.start.y + dy)),
      });
    } else {
      update(sticker.id, { width: Math.min(200, Math.max(3, state.start.width + dx)) });
    }
  };

  return (
    <div className="sticker-layer">
      {settings.stickers.map((sticker) => (
        <div
          key={sticker.id}
          className={`sticker${selectedSticker === sticker.id ? ' is-selected' : ''}`}
          style={{
            left: `${sticker.x}%`,
            top: `${sticker.y}%`,
            width: `${sticker.width}%`,
            opacity: sticker.opacity,
            transform: `rotate(${sticker.rotation}deg)`,
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setSelectedSticker(sticker.id);
            drag.current = { mode: 'move', x: event.clientX, y: event.clientY, start: sticker };
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => onMove(event, sticker)}
          onPointerUp={(event) => {
            drag.current = null;
            (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { drag.current = null; }}
        >
          <StickerImage sticker={sticker} />
          {selectedSticker === sticker.id ? (
            <>
              <span className="sticker-outline" data-export-ignore="true" />
              <span
                className="sticker-handle"
                data-export-ignore="true"
                title="끌어서 크기 조절"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  drag.current = { mode: 'resize', x: event.clientX, y: event.clientY, start: sticker };
                  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => { event.stopPropagation(); onMove(event, sticker); }}
                onPointerUp={(event) => {
                  drag.current = null;
                  (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
                }}
              />
              <span
                className="sticker-rotate"
                data-export-ignore="true"
                title="끌어서 각도 조절 (Shift: 15도 단위) · 더블클릭하면 0도"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  // 회전은 이미지 중심을 기준으로 잰다 — 손잡이가 아니라 중심이 축이다.
                  const box = (event.currentTarget as HTMLElement)
                    .closest('.sticker')!.getBoundingClientRect();
                  const cx = box.left + box.width / 2;
                  const cy = box.top + box.height / 2;
                  drag.current = {
                    mode: 'rotate',
                    cx,
                    cy,
                    base: angleTo(cx, cy, event.clientX, event.clientY),
                    start: sticker,
                  };
                  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => { event.stopPropagation(); onMove(event, sticker); }}
                onPointerUp={(event) => {
                  drag.current = null;
                  (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => { drag.current = null; }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  update(sticker.id, { rotation: 0 });
                }}
              />
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
