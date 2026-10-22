import { RATIO_PRESETS } from '../../defaults';
import { useStore } from '../../store';
import { ButtonGroup, ColorField, Field, Hint, NumberSlider, Toggle } from '../ui';
import { BORDER_STYLES, BorderSample } from '../PageBorder';
import type { AlignY } from '../../types';

export function LayoutPanel() {
  const { settings, patch } = useStore();
  const layout = settings.layout;
  const border = layout.border;
  const setBorder = (change: Partial<typeof border>) => patch('layout', { border: { ...border, ...change } });
  const activeRatio = RATIO_PRESETS.find((r) => r.w === layout.ratioW && r.h === layout.ratioH);

  const setAllPadding = (value: number) =>
    patch('layout', { padTop: value, padRight: value, padBottom: value, padLeft: value });

  return (
    <>
      <NumberSlider label="이미지 너비" value={layout.width} min={320} max={1600}
        onChange={(width) => patch('layout', { width })} />

      <Toggle
        label="이미지 비율 고정"
        checked={layout.ratioMode === 'fixed'}
        onChange={(fixed) => patch('layout', { ratioMode: fixed ? 'fixed' : 'auto' })}
        hint="끄면 본문 길이에 맞춰 자동으로 늘어납니다"
      />

      {layout.ratioMode === 'fixed' ? (
        <>
          <Field label="비율 프리셋">
            <div className="button-group wrap">
              {RATIO_PRESETS.map((ratio) => (
                <button
                  key={ratio.label}
                  type="button"
                  className={activeRatio?.label === ratio.label ? 'is-active' : ''}
                  onClick={() => patch('layout', { ratioW: ratio.w, ratioH: ratio.h })}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
          </Field>
          <div className="pair">
            <NumberSlider label="가로" value={layout.ratioW} min={1} max={32} unit=""
              onChange={(ratioW) => patch('layout', { ratioW: Math.max(1, ratioW) })} />
            <NumberSlider label="세로" value={layout.ratioH} min={1} max={32} unit=""
              onChange={(ratioH) => patch('layout', { ratioH: Math.max(1, ratioH) })} />
          </div>
          <Hint>
            지정한 비율은 <strong>최소 크기</strong>로 적용됩니다. 본문이 더 길면 세로로 늘어나 잘리지 않습니다.
          </Hint>
          <ButtonGroup
            label="세로 정렬"
            value={layout.alignY}
            options={[
              { label: '위', value: 'top' as AlignY },
              { label: '가운데', value: 'center' as AlignY },
              { label: '아래', value: 'bottom' as AlignY },
            ]}
            onChange={(alignY) => patch('layout', { alignY })}
          />
        </>
      ) : null}

      <hr className="divider" />

      <div className="panel-head">
        <span>여백</span>
        <div className="button-group compact">
          {[24, 40, 56, 80].map((value) => (
            <button key={value} type="button" onClick={() => setAllPadding(value)}>{value}</button>
          ))}
        </div>
      </div>
      <NumberSlider label="상단 여백" value={layout.padTop} min={0} max={240}
        onChange={(padTop) => patch('layout', { padTop })} />
      <NumberSlider label="하단 여백" value={layout.padBottom} min={0} max={240}
        onChange={(padBottom) => patch('layout', { padBottom })} />
      <NumberSlider label="좌측 여백" value={layout.padLeft} min={0} max={240}
        onChange={(padLeft) => patch('layout', { padLeft })} />
      <NumberSlider label="우측 여백" value={layout.padRight} min={0} max={240}
        onChange={(padRight) => patch('layout', { padRight })} />
      <NumberSlider label="모서리 둥글기" value={layout.radius} min={0} max={64}
        onChange={(radius) => patch('layout', { radius })} />

      <hr className="divider" />

      <div className="panel-head"><span>페이지 테두리</span></div>
      <Toggle
        label="테두리 두르기"
        checked={border.enabled}
        onChange={(enabled) => setBorder({ enabled })}
        hint="저장되는 그림 가장자리에 선을 두릅니다. 글 뒤에 깔려 글을 가리지 않습니다"
      />
      {border.enabled ? (
        <>
          <Field label="선 모양">
            <div className="button-group border-styles">
              {BORDER_STYLES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.label}
                  className={border.style === option.value ? 'is-active' : ''}
                  onClick={() => setBorder({ style: option.value })}
                >
                  <BorderSample style={option.value} />
                  {option.label}
                </button>
              ))}
            </div>
          </Field>
          <ColorField label="색" value={border.color} onChange={(color) => setBorder({ color })} />
          <NumberSlider label="불투명도" value={Math.round(border.opacity * 100)} min={0} max={100} unit="%"
            onChange={(value) => setBorder({ opacity: value / 100 })} />
          <NumberSlider label="굵기" value={border.width} min={0.5} max={16} step={0.5}
            onChange={(width) => setBorder({ width })} />
          <NumberSlider label="안쪽 거리" value={border.inset} min={0} max={120}
            hint="가장자리에서 얼마나 들어와 그을지"
            onChange={(inset) => setBorder({ inset })} />
          {border.inset + border.width * (border.style === 'double' ? 4 : 1)
            > Math.min(layout.padTop, layout.padRight, layout.padBottom, layout.padLeft) ? (
              <Hint>테두리가 여백 안쪽까지 들어와 글과 겹칠 수 있습니다. 안쪽 거리를 줄이거나 여백을 늘려 보세요.</Hint>
            ) : null}
        </>
      ) : null}
    </>
  );
}
