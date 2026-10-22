import { useState } from 'react';
import { readFileAsDataUrl, urlToDataUrl } from '../../lib/exporters';
import { useStore } from '../../store';
import { ColorField, Field, FileButton, Hint, NumberSlider, Select, TextInput, Toggle } from '../ui';
import type { BackgroundType, PatternKind } from '../../types';
import { PatternFill } from '../BackgroundArt';
import { ImageSection } from './ImageSection';
import { SlotSection } from './SlotSection';

const BG_KINDS: Array<{ label: string; value: BackgroundType }> = [
  { label: '단색', value: 'solid' },
  { label: '그라데이션', value: 'gradient' },
  { label: '이미지 / GIF', value: 'image' },
  { label: '영상', value: 'video' },
  { label: '패턴', value: 'pattern' },
  { label: '아스키 아트', value: 'ascii' },
];

/** previewScale — 작은 견본 칸 안에 무늬가 몇 번 되풀이돼 보이도록 줄인 배율 */
const PATTERNS: Array<{ label: string; value: PatternKind; previewScale: number }> = [
  { label: '점', value: 'dots', previewScale: 70 },
  { label: '체크', value: 'check', previewScale: 40 },
  { label: '별', value: 'stars', previewScale: 22 },
  { label: '물방울', value: 'bubbles', previewScale: 22 },
];

export function BackgroundPanel({ editorRoot }: { editorRoot: HTMLElement | null }) {
  const { settings, patch, adjustingImage, setAdjustingImage } = useStore();
  const bg = settings.background;
  const [urlNote, setUrlNote] = useState('');

  /** 외부 주소 이미지는 미리 받아 둬야 저장할 때 함께 담긴다. */
  const fetchIntoDataUrl = async (url: string, key: 'imageUrl' | 'videoUrl') => {
    if (!url || url.startsWith('data:')) return;
    setUrlNote('이미지를 받는 중…');
    try {
      patch('background', { [key]: await urlToDataUrl(url) });
      setUrlNote('받았습니다. 이제 저장할 때 함께 담깁니다.');
    } catch {
      setUrlNote('이 주소는 다른 사이트에서 가져오는 것을 막고 있어, 저장할 때 빠질 수 있습니다. 파일로 올려 주세요.');
    }
  };

  return (
    <>
      <ImageSection editorRoot={editorRoot} />

      <hr className="divider" />

      <div className="panel-head"><span>배경</span></div>
      <Field label="배경 종류">
        {/* 여섯 가지라 한 줄에 다 넣으면 글자가 잘린다 — 3열 두 줄로 */}
        <div className="button-group bg-kinds">
          {BG_KINDS.map((kind) => (
            <button
              key={kind.value}
              type="button"
              className={bg.type === kind.value ? 'is-active' : ''}
              onClick={() => {
                // 다른 종류로 넘어가면 드래그 조절도 끈다 — 엉뚱한 대상을 끌게 되므로
                if (kind.value !== bg.type) setAdjustingImage(false);
                patch('background', { type: kind.value });
              }}
            >
              {kind.label}
            </button>
          ))}
        </div>
      </Field>

      {bg.type === 'solid' ? (
        <ColorField label="배경색" value={bg.color} onChange={(color) => patch('background', { color })} />
      ) : null}

      {bg.type === 'gradient' ? (
        <>
          <ColorField label="시작 색" value={bg.gradientFrom} onChange={(gradientFrom) => patch('background', { gradientFrom })} />
          <ColorField label="끝 색" value={bg.gradientTo} onChange={(gradientTo) => patch('background', { gradientTo })} />
          <NumberSlider label="각도" value={bg.gradientAngle} min={0} max={360} unit="°"
            onChange={(gradientAngle) => patch('background', { gradientAngle })} />
        </>
      ) : null}

      {bg.type === 'image' ? (
        <>
          <div className="button-row">
            <FileButton
              label="이미지 업로드"
              accept="image/*"
              onPick={async (file) => patch('background', { imageUrl: await readFileAsDataUrl(file) })}
            />
            {bg.imageUrl ? (
              <button type="button" className="mini-button" onClick={() => patch('background', { imageUrl: '' })}>
                제거
              </button>
            ) : null}
          </div>
          <TextInput label="이미지 주소" value={bg.imageUrl.startsWith('data:') ? '' : bg.imageUrl}
            placeholder="https://… (업로드 대신 주소 사용)"
            onChange={(imageUrl) => { setUrlNote(''); patch('background', { imageUrl }); }} />
          {bg.imageUrl && !bg.imageUrl.startsWith('data:') ? (
            <div className="button-row">
              <button type="button" className="mini-button"
                onClick={() => fetchIntoDataUrl(bg.imageUrl, 'imageUrl')}>
                저장에 포함되도록 받아 오기
              </button>
            </div>
          ) : null}
          {urlNote ? <p className="status-line">{urlNote}</p> : null}
          <Select
            label="채우기"
            value={bg.imageFit}
            options={[
              { label: '꽉 채우기', value: 'cover' as const },
              { label: '전체 보이기', value: 'contain' as const },
              { label: '반복', value: 'repeat' as const },
              { label: '직접 크기 지정', value: 'custom' as const },
            ]}
            onChange={(imageFit) => patch('background', { imageFit })}
          />
          {bg.imageFit === 'custom' ? (
            <NumberSlider label="이미지 크기" value={bg.imageScale} min={10} max={400} unit="%"
              hint="영역 너비 기준" onChange={(imageScale) => patch('background', { imageScale })} />
          ) : null}
          <ColorField label="여백 색" value={bg.color} onChange={(color) => patch('background', { color })} />

          <Field label="이미지 위치 · 크기">
            <div className="button-row">
              <button
                type="button"
                className={adjustingImage ? 'primary-button' : 'mini-button'}
                disabled={!bg.imageUrl}
                onClick={() => setAdjustingImage(!adjustingImage)}
              >
                {adjustingImage ? '조절 끝내기' : '드래그로 위치·크기 조절'}
              </button>
              <button
                type="button"
                className="mini-button"
                disabled={!bg.imageUrl}
                onClick={() => patch('background', { imageX: 50, imageY: 50 })}
              >
                가운데로
              </button>
            </div>
          </Field>
          {adjustingImage ? (
            <Hint>
              미리보기를 <strong>드래그</strong>해 옮기고, <strong>휠</strong>을 굴려 크기를 바꾸세요.
              휠을 굴리면 채우기가 <strong>직접 크기 지정</strong>으로 바뀝니다.
              조절하는 동안에는 본문을 편집할 수 없습니다.
            </Hint>
          ) : null}
          <NumberSlider label="가로 위치" value={Math.round(bg.imageX)} min={0} max={100} unit="%"
            onChange={(imageX) => patch('background', { imageX })} />
          <NumberSlider label="세로 위치" value={Math.round(bg.imageY)} min={0} max={100} unit="%"
            onChange={(imageY) => patch('background', { imageY })} />

          <Hint>GIF 는 미리보기에서 움직이지만, 이미지·PDF 로 저장하면 한 장면으로 고정됩니다.</Hint>
        </>
      ) : null}

      {bg.type === 'pattern' ? (
        <>
          <Field label="무늬">
            <div className="pattern-swatches">
              {PATTERNS.map((pattern) => (
                <button
                  key={pattern.value}
                  type="button"
                  className={`pattern-swatch${bg.patternKind === pattern.value ? ' is-active' : ''}`}
                  title={pattern.label}
                  onClick={() => patch('background', { patternKind: pattern.value })}
                >
                  {/* 작은 사각형 안에 실제 무늬를 그대로 그려 보인다 */}
                  <span className="pattern-swatch-box" style={{ background: bg.color }}>
                    <PatternFill
                      kind={pattern.value}
                      scale={pattern.previewScale}
                      color={bg.patternColor}
                      angle={bg.patternAngle}
                      opacity={bg.patternOpacity}
                    />
                  </span>
                  <span className="pattern-swatch-label">{pattern.label}</span>
                </button>
              ))}
            </div>
          </Field>
          <ColorField label="바탕색" value={bg.color} onChange={(color) => patch('background', { color })} />
          <ColorField label="무늬 색" value={bg.patternColor}
            onChange={(patternColor) => patch('background', { patternColor })} />
          <NumberSlider label="무늬 크기" value={bg.patternScale} min={25} max={300} unit="%"
            onChange={(patternScale) => patch('background', { patternScale })} />
          <NumberSlider label="무늬 각도" value={bg.patternAngle} min={0} max={360} unit="°"
            onChange={(patternAngle) => patch('background', { patternAngle })} />
          <NumberSlider label="무늬 불투명도" value={Math.round(bg.patternOpacity * 100)} min={0} max={100} unit="%"
            onChange={(value) => patch('background', { patternOpacity: value / 100 })} />
        </>
      ) : null}

      {bg.type === 'ascii' ? (
        <>
          <div className="button-row">
            <FileButton
              label={bg.asciiUrl ? '이미지 바꾸기' : '이미지 업로드'}
              accept="image/*"
              onPick={async (file) => patch('background', { asciiUrl: await readFileAsDataUrl(file) })}
            />
            {bg.asciiUrl ? (
              <button type="button" className="mini-button" onClick={() => {
                setAdjustingImage(false);
                patch('background', { asciiUrl: '' });
              }}>
                제거
              </button>
            ) : null}
          </div>
          {!bg.asciiUrl ? (
            <Hint>이미지를 올리면 글자로 바꿔 배경에 깝니다. 사진보다 윤곽이 또렷한 그림이 잘 살아납니다.</Hint>
          ) : null}
          <ColorField label="바탕색" value={bg.color} onChange={(color) => patch('background', { color })} />
          <ColorField label="글자 색" value={bg.asciiColor}
            onChange={(asciiColor) => patch('background', { asciiColor })} />
          <NumberSlider label="해상도" value={bg.asciiColumns} min={20} max={240} unit="자"
            hint="가로 글자 수 — 클수록 촘촘하고 자세함"
            onChange={(asciiColumns) => patch('background', { asciiColumns })} />
          <NumberSlider label="글자 크기" value={bg.asciiFontSize} min={2} max={40} step={0.5}
            onChange={(asciiFontSize) => patch('background', { asciiFontSize })} />
          <NumberSlider label="대비" value={bg.asciiContrast} min={0.2} max={3} step={0.05} unit="배"
            onChange={(asciiContrast) => patch('background', { asciiContrast })} />
          <Toggle
            label="밝기 반전"
            checked={bg.asciiInvert}
            onChange={(asciiInvert) => patch('background', { asciiInvert })}
            hint="어두운 바탕에 밝은 글자로 쓸 때 켜세요"
          />

          <Field label="위치 · 크기">
            <div className="button-row">
              <button
                type="button"
                className={adjustingImage ? 'primary-button' : 'mini-button'}
                disabled={!bg.asciiUrl}
                onClick={() => setAdjustingImage(!adjustingImage)}
              >
                {adjustingImage ? '조절 끝내기' : '드래그로 위치·크기 조절'}
              </button>
              <button
                type="button"
                className="mini-button"
                disabled={!bg.asciiUrl}
                onClick={() => patch('background', { asciiX: 50, asciiY: 50 })}
              >
                가운데로
              </button>
            </div>
          </Field>
          {adjustingImage ? (
            <Hint>
              미리보기를 <strong>드래그</strong>해 옮기고, <strong>휠</strong>을 굴려 크기(글자 크기)를 바꾸세요.
              조절하는 동안에는 본문을 편집할 수 없습니다.
            </Hint>
          ) : null}
        </>
      ) : null}

      {bg.type === 'video' ? (
        <>
          <div className="button-row">
            <FileButton
              label="영상 업로드"
              accept="video/*"
              onPick={async (file) => patch('background', { videoUrl: await readFileAsDataUrl(file) })}
            />
            {bg.videoUrl ? (
              <button type="button" className="mini-button" onClick={() => patch('background', { videoUrl: '' })}>
                제거
              </button>
            ) : null}
          </div>
          <TextInput label="영상 주소" value={bg.videoUrl.startsWith('data:') ? '' : bg.videoUrl}
            placeholder="https://… (mp4/webm)"
            onChange={(videoUrl) => patch('background', { videoUrl })} />
          <Hint>저장할 때는 재생 중인 프레임이 그대로 캡처됩니다. 원하는 장면에서 저장하세요.</Hint>
        </>
      ) : null}

      <hr className="divider" />
      <ColorField label="오버레이 색" value={bg.overlayColor} onChange={(overlayColor) => patch('background', { overlayColor })} />
      <NumberSlider label="오버레이 농도" value={bg.overlayOpacity} min={0} max={0.9} step={0.01} unit=""
        hint="배경 위 글자 가독성 보정" onChange={(overlayOpacity) => patch('background', { overlayOpacity })} />
      <NumberSlider label="배경 흐림" value={bg.blur} min={0} max={30}
        onChange={(blur) => patch('background', { blur })} />

      <hr className="divider" />

      <SlotSection />
    </>
  );
}
