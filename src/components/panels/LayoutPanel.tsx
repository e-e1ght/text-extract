import { RATIO_PRESETS } from '../../defaults';
import { useStore } from '../../store';
import { useRef } from 'react';
import { ButtonGroup, ColorField, Field, Hint, NumberSlider, Select, Toggle } from '../ui';
import { SPLIT_RATIOS } from '../../lib/split';
import { usePagePlan } from '../PageGuides';
import { BorderStylePicker } from '../PageBorder';
import { BackgroundFields } from './BackgroundFields';
import type { AlignY, SplitRatio } from '../../types';

export function LayoutPanel({ captureNode }: { captureNode: HTMLElement | null }) {
  const { settings, patch, setSettings } = useStore();
  const layout = settings.layout;
  const options = settings.exportOptions;
  const ratioChoice: 'auto' | 'fixed' | 'split' = options.splitRatio !== 'off' ? 'split' : layout.ratioMode;
  // '나누기' 를 껐다 다시 켤 때 고르던 비율로 돌아오게 기억해 둔다
  const lastSplit = useRef<SplitRatio>('4:5');
  const plan = usePagePlan(captureNode, options.splitRatio, settings);
  const border = layout.border;
  const setBorder = (change: Partial<typeof border>) => patch('layout', { border: { ...border, ...change } });
  const activeRatio = RATIO_PRESETS.find((r) => r.w === layout.ratioW && r.h === layout.ratioH);

  const box = settings.textBox;
  const setBox = (change: Partial<typeof box>) => patch('textBox', change);
  const setBoxBorder = (change: Partial<typeof box.border>) => setBox({ border: { ...box.border, ...change } });
  const setBoxShadow = (change: Partial<typeof box.shadow>) => setBox({ shadow: { ...box.shadow, ...change } });

  const setAllPadding = (value: number) =>
    patch('layout', { padTop: value, padRight: value, padBottom: value, padLeft: value });

  return (
    <>
      <NumberSlider label="이미지 너비" value={layout.width} min={320} max={1600}
        onChange={(width) => patch('layout', { width })} />

      {/*
        비율은 한 자리에서 고른다. 예전에는 '비율 고정'(여기)과 '나눠 저장'(저장 탭)이 따로 있어,
        둘 다 켜면 무엇이 이기는지 알 수 없었다. 셋 중 하나만 고르게 한다.
      */}
      <ButtonGroup
        label="이미지 비율"
        value={ratioChoice}
        options={[
          { label: '자유', value: 'auto' as const, title: '본문 길이에 맞춰 늘어납니다' },
          { label: '한 장 고정', value: 'fixed' as const, title: '정한 비율을 최소 크기로' },
          { label: '여러 장으로 나누기', value: 'split' as const, title: '긴 글을 같은 비율의 여러 장으로' },
        ]}
        onChange={(choice) => {
          if (choice !== 'split' && options.splitRatio !== 'off') lastSplit.current = options.splitRatio;
          // 두 곳을 한 번에 바꾼다 — 따로 바꾸면 되돌리기가 두 번 필요해진다
          setSettings((prev) => ({
            ...prev,
            layout: { ...prev.layout, ratioMode: choice === 'fixed' ? 'fixed' : 'auto' },
            exportOptions: {
              ...prev.exportOptions,
              splitRatio: choice === 'split'
                ? (prev.exportOptions.splitRatio === 'off' ? lastSplit.current : prev.exportOptions.splitRatio)
                : 'off',
            },
          }));
        }}
      />
      {ratioChoice === 'auto' ? <Hint>본문 길이에 맞춰 세로로 늘어나는 한 장으로 저장합니다.</Hint> : null}

      {ratioChoice === 'split' ? (
        <>
          <Select
            label="한 장의 비율"
            value={options.splitRatio}
            options={SPLIT_RATIOS.filter((ratio) => ratio.value !== 'off')}
            onChange={(splitRatio) => patch('exportOptions', { splitRatio })}
          />
          <Toggle
            label="쪽 번호 넣기"
            checked={options.pageNumbers}
            onChange={(pageNumbers) => patch('exportOptions', { pageNumbers })}
            hint="장마다 오른쪽 아래에 1 / 5 처럼 붙입니다"
          />
          {plan ? (
            <p className="status-line" role="status">
              {plan.pages}장으로 나뉩니다. 미리보기의 파란 점선이 나뉘는 자리입니다.
              {plan.oversized > 0
                ? ` 한 장보다 긴 문단이 ${plan.oversized}개 있어, 그 장은 조금 길어집니다 (글을 자르지 않습니다).`
                : ''}
            </p>
          ) : null}
          <Hint>
            문단은 자르지 않고 다음 장으로 넘깁니다. 본문 탭에서 <strong>직접 넣은 페이지 나눔</strong>도
            그대로 지킵니다.
          </Hint>
        </>
      ) : null}

      {ratioChoice === 'fixed' ? (
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

      {/* 여백 안쪽, 글이 놓이는 칸 */}
      <div className="panel-head"><span>글 상자</span></div>
      <Toggle
        label="글 상자 꾸미기"
        checked={box.enabled}
        onChange={(enabled) => setBox({ enabled })}
        hint="여백 안쪽 글 칸에 배경·외곽선·그림자를 넣습니다"
      />
      {box.enabled ? (
        <>
          <NumberSlider label="상자 안쪽 가로 여백" value={box.padX} min={0} max={120}
            onChange={(padX) => setBox({ padX })} />
          <NumberSlider label="상자 안쪽 세로 여백" value={box.padY} min={0} max={120}
            onChange={(padY) => setBox({ padY })} />
          <NumberSlider label="상자 모서리 둥글기" value={box.radius} min={0} max={64}
            onChange={(radius) => setBox({ radius })} />

          <div className="panel-subhead">배경</div>
          <BackgroundFields
            bg={box.background}
            onChange={(change) => setBox({ background: { ...box.background, ...change } })}
          />
          <NumberSlider label="배경 불투명도" value={Math.round(box.opacity * 100)} min={0} max={100} unit="%"
            hint="낮추면 결과물 배경이 비칩니다"
            onChange={(value) => setBox({ opacity: value / 100 })} />

          <div className="panel-subhead">외곽선</div>
          <Toggle label="외곽선 두르기" checked={box.border.enabled}
            onChange={(enabled) => setBoxBorder({ enabled })} />
          {box.border.enabled ? (
            <>
              <BorderStylePicker value={box.border.style} onChange={(style) => setBoxBorder({ style })} />
              <ColorField label="외곽선 색" value={box.border.color} onChange={(color) => setBoxBorder({ color })} />
              <NumberSlider label="외곽선 불투명도" value={Math.round(box.border.opacity * 100)} min={0} max={100} unit="%"
                onChange={(value) => setBoxBorder({ opacity: value / 100 })} />
              <NumberSlider label="외곽선 굵기" value={box.border.width} min={0.5} max={16} step={0.5}
                onChange={(width) => setBoxBorder({ width })} />
            </>
          ) : null}

          <div className="panel-subhead">그림자</div>
          <Toggle label="그림자 넣기" checked={box.shadow.enabled}
            onChange={(enabled) => setBoxShadow({ enabled })} />
          {box.shadow.enabled ? (
            <>
              <ColorField label="그림자 색" value={box.shadow.color} onChange={(color) => setBoxShadow({ color })} />
              <NumberSlider label="그림자 불투명도" value={Math.round(box.shadow.opacity * 100)} min={0} max={100} unit="%"
                onChange={(value) => setBoxShadow({ opacity: value / 100 })} />
              <NumberSlider label="그림자 퍼짐" value={box.shadow.blur} min={0} max={80}
                onChange={(blur) => setBoxShadow({ blur })} />
              <NumberSlider label="그림자 거리" value={box.shadow.distance} min={0} max={40}
                hint="아래로 밀리는 거리"
                onChange={(distance) => setBoxShadow({ distance })} />
            </>
          ) : null}
        </>
      ) : null}

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
          <BorderStylePicker value={border.style} onChange={(style) => setBorder({ style })} />
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
