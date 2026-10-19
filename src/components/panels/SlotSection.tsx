import { useState } from 'react';
import { readFileAsDataUrl } from '../../lib/exporters';
import { useStore } from '../../store';
import { ButtonGroup, ColorField, Field, FileButton, Hint, NumberSlider, Toggle } from '../ui';
import type { ImageSlot, SlotSide } from '../../types';

const SIDES: Array<{ label: string; value: SlotSide }> = [
  { label: '위', value: 'top' },
  { label: '아래', value: 'bottom' },
  { label: '왼쪽', value: 'left' },
  { label: '오른쪽', value: 'right' },
];

/** 본문 위·아래·왼쪽·오른쪽 이미지 칸. 이미지 탭의 배경 아래에 둔다. */
export function SlotSection() {
  const { settings, patch, adjustingSlot, setAdjustingSlot } = useStore();
  const slots = settings.imageSlots;
  const [side, setSide] = useState<SlotSide>('top');
  const slot = slots[side];
  const vertical = side === 'left' || side === 'right';
  const change = (value: Partial<ImageSlot>) => patch('imageSlots', { [side]: { ...slot, ...value } });
  const adjusting = adjustingSlot === side;

  return (
    <>
      <div className="panel-head"><span>이미지 슬롯</span></div>
      <Toggle
        label="이미지 슬롯 사용"
        checked={slots.enabled}
        onChange={(enabled) => {
          patch('imageSlots', { enabled });
          if (!enabled) setAdjustingSlot(null);
        }}
        hint="본문 위·아래·왼쪽·오른쪽에 이미지 칸을 붙입니다"
      />

      {slots.enabled ? (
        <>
          <ButtonGroup
            label="슬롯 고르기"
            value={side}
            options={SIDES.map((item) => ({
              ...item,
              label: slots[item.value].enabled ? `${item.label} ●` : item.label,
            }))}
            onChange={(next) => {
              setSide(next);
              // 조절은 한 칸씩 — 다른 칸으로 옮기면 조절도 끝낸다.
              if (adjustingSlot && adjustingSlot !== next) setAdjustingSlot(null);
            }}
          />
          <Toggle
            label={`${SIDES.find((item) => item.value === side)?.label} 슬롯 켜기`}
            checked={slot.enabled}
            onChange={(enabled) => {
              change({ enabled });
              if (!enabled && adjusting) setAdjustingSlot(null);
            }}
          />

          {slot.enabled ? (
            <>
              <div className="button-row">
                <FileButton
                  label={slot.url ? '이미지 바꾸기' : '이미지 올리기'}
                  accept="image/*"
                  onPick={async (file) => change({ url: await readFileAsDataUrl(file) })}
                />
                {slot.url ? (
                  <button type="button" className="mini-button" onClick={() => {
                    change({ url: '' });
                    if (adjusting) setAdjustingSlot(null);
                  }}>
                    제거
                  </button>
                ) : null}
              </div>
              {!slot.url ? <Hint>이미지를 넣기 전에는 점선 칸으로만 보이고 저장할 때는 빠집니다.</Hint> : null}

              <NumberSlider
                label={vertical ? '슬롯 너비' : '슬롯 높이'}
                value={slot.size} min={20} max={800} onChange={(size) => change({ size })}
              />
              {vertical ? (
                <NumberSlider
                  label="슬롯 높이" value={slot.length} min={0} max={1600}
                  hint={slot.length === 0 ? '0 = 본문 높이에 맞춤' : undefined}
                  onChange={(length) => change({ length })}
                />
              ) : null}

              <ButtonGroup
                label="채우기"
                value={slot.fit}
                options={[
                  { label: '꽉 채우기', value: 'cover' as const },
                  { label: '전체 보이기', value: 'contain' as const },
                  { label: '직접 크기', value: 'custom' as const },
                ]}
                onChange={(fit) => change({ fit })}
              />
              {slot.fit === 'custom' ? (
                <NumberSlider label="이미지 크기" value={slot.scale} min={10} max={400} unit="%"
                  hint="슬롯 너비 기준" onChange={(scale) => change({ scale })} />
              ) : null}

              <Field label="이미지 위치 · 크기">
                <div className="button-row">
                  <button
                    type="button"
                    className={adjusting ? 'primary-button' : 'mini-button'}
                    disabled={!slot.url}
                    onClick={() => setAdjustingSlot(adjusting ? null : side)}
                  >
                    {adjusting ? '조절 끝내기' : '드래그로 위치·크기 조절'}
                  </button>
                  <button type="button" className="mini-button" disabled={!slot.url}
                    onClick={() => change({ x: 50, y: 50 })}>
                    가운데로
                  </button>
                </div>
              </Field>
              {adjusting ? (
                <Hint>
                  미리보기의 슬롯을 <strong>드래그</strong>해 옮기고, <strong>휠</strong>을 굴려 크기를 바꾸세요.
                  휠을 굴리면 채우기가 <strong>직접 크기</strong>로 바뀝니다.
                </Hint>
              ) : null}
              <NumberSlider label="가로 위치" value={Math.round(slot.x)} min={0} max={100} unit="%"
                onChange={(x) => change({ x })} />
              <NumberSlider label="세로 위치" value={Math.round(slot.y)} min={0} max={100} unit="%"
                onChange={(y) => change({ y })} />

              <hr className="divider" />
              <NumberSlider label="위 여백" value={slot.marginTop} min={0} max={200}
                onChange={(marginTop) => change({ marginTop })} />
              <NumberSlider label="아래 여백" value={slot.marginBottom} min={0} max={200}
                onChange={(marginBottom) => change({ marginBottom })} />
              <NumberSlider label="왼쪽 여백" value={slot.marginLeft} min={0} max={200}
                onChange={(marginLeft) => change({ marginLeft })} />
              <NumberSlider label="오른쪽 여백" value={slot.marginRight} min={0} max={200}
                onChange={(marginRight) => change({ marginRight })} />

              <hr className="divider" />
              <NumberSlider label="테두리 두께" value={slot.borderWidth} min={0} max={20}
                onChange={(borderWidth) => change({ borderWidth })} />
              {slot.borderWidth > 0 ? (
                <ColorField label="테두리 색" value={slot.borderColor}
                  onChange={(borderColor) => change({ borderColor })} />
              ) : null}
              <NumberSlider label="모서리 둥글기" value={slot.radius} min={0} max={200}
                onChange={(radius) => change({ radius })} />

              <Toggle label="그림자" checked={slot.shadow} onChange={(shadow) => change({ shadow })} />
              {slot.shadow ? (
                <>
                  <NumberSlider label="그림자 크기" value={slot.shadowBlur} min={0} max={80}
                    onChange={(shadowBlur) => change({ shadowBlur })} />
                  <NumberSlider label="그림자 진하기" value={slot.shadowOpacity} min={0} max={1} step={0.01} unit=""
                    onChange={(shadowOpacity) => change({ shadowOpacity })} />
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
