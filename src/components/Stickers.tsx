import { useRef } from 'react';
import { useStore } from '../store';
import type { Sticker } from '../types';

/**
 * 본문 위에 얹는 이미지.
 * 미리보기에서 바로 끌어 옮기고, 오른쪽 아래 손잡이로 크기를 바꾼다.
 * 위치·크기는 결과물 너비 대비 % 라 확대·축소를 해도 흔들리지 않는다.
 */
export function Stickers({ zoom }: { zoom: number }) {
  const { settings, set, selectedSticker, setSelectedSticker } = useStore();
  const drag = useRef<{ mode: 'move' | 'resize'; x: number; y: number; start: Sticker } | null>(null);

  if (settings.stickers.length === 0) return null;

  const update = (id: string, patch: Partial<Sticker>) => {
    set('stickers', settings.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const onMove = (event: React.PointerEvent, sticker: Sticker) => {
    const state = drag.current;
    if (!state) return;
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
          <img src={sticker.url} alt="" draggable={false} />
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
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
