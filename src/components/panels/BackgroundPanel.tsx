import { useState } from 'react';
import { readFileAsDataUrl, urlToDataUrl } from '../../lib/exporters';
import { useStore } from '../../store';
import { ButtonGroup, ColorField, Field, FileButton, Hint, NumberSlider, Select, TextInput } from '../ui';
import type { BackgroundType } from '../../types';

export function BackgroundPanel() {
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
      <ButtonGroup
        label="배경 종류"
        value={bg.type}
        options={[
          { label: '단색', value: 'solid' as BackgroundType },
          { label: '그라데이션', value: 'gradient' as BackgroundType },
          { label: '이미지 / GIF', value: 'image' as BackgroundType },
          { label: '영상', value: 'video' as BackgroundType },
        ]}
        onChange={(type) => patch('background', { type })}
      />

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

          <Field label="이미지 위치">
            <div className="button-row">
              <button
                type="button"
                className={adjustingImage ? 'primary-button' : 'mini-button'}
                disabled={!bg.imageUrl}
                onClick={() => setAdjustingImage(!adjustingImage)}
              >
                {adjustingImage ? '위치 조절 끝내기' : '드래그로 위치 조절'}
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
            <Hint>미리보기를 드래그해 이미지를 옮기세요. 조절하는 동안에는 본문을 편집할 수 없습니다.</Hint>
          ) : null}
          <NumberSlider label="가로 위치" value={Math.round(bg.imageX)} min={0} max={100} unit="%"
            onChange={(imageX) => patch('background', { imageX })} />
          <NumberSlider label="세로 위치" value={Math.round(bg.imageY)} min={0} max={100} unit="%"
            onChange={(imageY) => patch('background', { imageY })} />

          <Hint>GIF 는 미리보기에서 움직이지만, 이미지·PDF 로 저장하면 한 장면으로 고정됩니다.</Hint>
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
    </>
  );
}
