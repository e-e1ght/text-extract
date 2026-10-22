import { useEffect, useState } from 'react';
import { FONT_OPTIONS } from '../../defaults';
import {
  applyFontFamily, applyFontSize, hasSelectionInside, insertDivider, insertPageBreak, pageBreakCount,
} from '../../lib/format';
import { deleteFontFile, fontFamilyOf, installFont, saveFontFile } from '../../lib/fonts';
import { useStore } from '../../store';
import { rememberColor } from '../../lib/recentColors';
import { ButtonGroup, Field, FileButton, Hint, NumberSlider, RecentSwatches, Select } from '../ui';
import { BorderStylePicker } from '../PageBorder';
import type { BorderStyle } from '../../types';

export function TextPanel({ editorRoot }: { editorRoot: HTMLElement | null }) {
  const { settings, patch, set } = useStore();
  const t = settings.typography;
  const [breaks, setBreaks] = useState(0);
  const [fontError, setFontError] = useState('');
  const [rule, setRule] = useState<{ color: string; width: number; style: BorderStyle }>({
    color: '#d8d8de', width: 1, style: 'solid',
  });

  useEffect(() => { setBreaks(pageBreakCount(editorRoot)); }, [editorRoot]);

  const fontOptions = [
    ...FONT_OPTIONS,
    ...settings.customFonts.map((font) => ({
      label: `${font.label} (내 글꼴)`,
      value: fontFamilyOf(font),
    })),
  ];

  /**
   * 크기 조절은 선택 여부에 따라 대상이 달라진다.
   *  - 드래그로 고른 영역이 있으면 그 영역만
   *  - 없으면 본문 전체(서술 또는 대사 기준값)
   */
  const changeSize = (next: number, target: 'fontSize' | 'dialogueFontSize') => {
    const size = Math.max(8, next);
    if (hasSelectionInside(editorRoot) && editorRoot) applyFontSize(editorRoot, size);
    else patch('typography', { [target]: size });
  };

  return (
    <>
      {/* 글자 일부의 서식은 드래그 팝업이 맡는다 — 여기는 본문 전체에 걸리는 서식만 */}
      <Hint>
        글자 일부의 굵기·색·하이라이트·세로선은 본문을 드래그한 뒤 <strong>편집 패널</strong>(화면의 편집 단추)에서 바꿉니다.
        여기서는 본문 전체에 걸리는 서식을 정합니다.
      </Hint>

      <Select
        label="글꼴"
        value={t.fontFamily}
        options={fontOptions}
        hint="드래그 중이면 선택 영역만"
        onChange={(fontFamily) => {
          if (hasSelectionInside(editorRoot) && editorRoot) applyFontFamily(editorRoot, fontFamily);
          else patch('typography', { fontFamily });
        }}
      />
      <Field label="내 글꼴 올리기" hint="ttf · otf · woff2">
        <div className="button-row">
          <FileButton
            label="글꼴 파일 추가"
            accept=".ttf,.otf,.woff,.woff2,font/*"
            onPick={async (file) => {
              setFontError('');
              try {
                const font = await saveFontFile(file);
                const ok = await installFont(font);
                if (!ok) throw new Error('글꼴을 읽지 못했습니다.');
                set('customFonts', [...settings.customFonts, font]);
                patch('typography', { fontFamily: fontFamilyOf(font) });
              } catch (error) {
                setFontError(error instanceof Error ? error.message : '글꼴을 추가하지 못했습니다.');
              }
            }}
          />
        </div>
      </Field>
      {fontError ? <p className="status-line is-error">{fontError}</p> : null}
      {settings.customFonts.length > 0 ? (
        <div className="slot-list">
          {settings.customFonts.map((font) => (
            <div className="slot-row" key={font.id}>
              <span className="slot-name">{font.label}</span>
              <button
                type="button"
                className="mini-button"
                onClick={() => patch('typography', { fontFamily: fontFamilyOf(font) })}
              >
                사용
              </button>
              <button
                type="button"
                className="mini-button danger"
                onClick={async () => {
                  await deleteFontFile(font.id);
                  set('customFonts', settings.customFonts.filter((f) => f.id !== font.id));
                  if (t.fontFamily === fontFamilyOf(font)) {
                    patch('typography', { fontFamily: FONT_OPTIONS[0].value });
                  }
                }}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <Select
        label="굵기"
        value={t.fontWeight}
        options={[
          { label: '가늘게 (300)', value: 300 },
          { label: '보통 (400)', value: 400 },
          { label: '중간 (500)', value: 500 },
          { label: '굵게 (700)', value: 700 },
        ]}
        onChange={(fontWeight) => patch('typography', { fontWeight })}
      />

      <NumberSlider
        label="서술 크기"
        value={t.fontSize}
        min={8}
        max={64}
        hint="드래그 중이면 선택 영역만"
        onChange={(value) => changeSize(value, 'fontSize')}
      />
      <NumberSlider
        label="대사 크기"
        value={t.dialogueFontSize}
        min={8}
        max={64}
        hint="드래그 중이면 선택 영역만"
        onChange={(value) => changeSize(value, 'dialogueFontSize')}
      />

      <NumberSlider label="행간" value={t.lineHeight} min={1} max={4} step={0.05} unit="배"
        onChange={(lineHeight) => patch('typography', { lineHeight })} />
      <NumberSlider label="자간" value={t.letterSpacing} min={-3} max={12} step={0.1}
        onChange={(letterSpacing) => patch('typography', { letterSpacing })} />
      <NumberSlider label="장평" value={t.horizontalScale} min={0.6} max={1.6} step={0.01} unit="배"
        hint="가로 폭 배율" onChange={(horizontalScale) => patch('typography', { horizontalScale })} />
      <NumberSlider label="문단 간격" value={t.paragraphGap} min={0} max={80}
        onChange={(paragraphGap) => patch('typography', { paragraphGap })} />
      <NumberSlider label="첫 줄 들여쓰기" value={t.indent} min={0} max={80}
        onChange={(indent) => patch('typography', { indent })} />

      <ButtonGroup
        label="정렬"
        value={t.textAlign}
        options={[
          { label: '왼쪽', value: 'left' as const },
          { label: '가운데', value: 'center' as const },
          { label: '오른쪽', value: 'right' as const },
          { label: '양쪽', value: 'justify' as const },
        ]}
        onChange={(textAlign) => patch('typography', { textAlign })}
      />
      <ButtonGroup
        label="줄바꿈"
        value={t.wordBreak}
        options={[
          { label: '단어 단위', value: 'keep-all' as const },
          { label: '글자 단위', value: 'break-all' as const },
        ]}
        onChange={(wordBreak) => patch('typography', { wordBreak })}
      />
      <hr className="divider" />


      <Field label="구분선" hint="장식용 — 저장할 때 나뉘지 않습니다">
        <div className="button-row">
          <input
            type="color"
            className="rule-color"
            value={rule.color}
            onChange={(e) => {
              setRule({ ...rule, color: e.target.value });
              rememberColor(e.target.value);
            }}
          />
          <button
            type="button"
            className="mini-button"
            onClick={() => editorRoot && insertDivider(editorRoot, rule)}
          >
            커서 아래에 넣기
          </button>
        </div>
        <RecentSwatches onPick={(color) => setRule({ ...rule, color })} />
      </Field>
      {/* 페이지 테두리 · 이미지 슬롯 테두리와 같은 여섯 가지 모양 */}
      <BorderStylePicker label="구분선 모양" value={rule.style}
        onChange={(style) => setRule({ ...rule, style })} />
      <NumberSlider label="구분선 두께" value={rule.width} min={1} max={12}
        onChange={(width) => setRule({ ...rule, width })} />

      <hr className="divider" />

      <Field label="페이지 나눔" hint={breaks > 0 ? `${breaks}개 · ${breaks + 1}장으로 저장` : '여기서 끊어 다음 장으로'}>
        <div className="button-row">
          <button
            type="button"
            className="mini-button"
            onClick={() => {
              if (!editorRoot) return;
              insertPageBreak(editorRoot);
              setBreaks(pageBreakCount(editorRoot));
            }}
          >
            커서 위치에 나눔선 넣기
          </button>
          <button
            type="button"
            className="mini-button danger"
            disabled={breaks === 0}
            onClick={() => {
              if (!editorRoot) return;
              editorRoot.querySelectorAll('[data-te-page-break]').forEach((el) => el.remove());
              editorRoot.dispatchEvent(new Event('input', { bubbles: true }));
              setBreaks(0);
            }}
          >
            모두 빼기
          </button>
        </div>
      </Field>
      <Hint>
        나눔선은 화면에만 보이고 결과물에는 나오지 않습니다. 저장하면 나눔선을 기준으로
        여러 장(PDF 는 여러 쪽)으로 나뉩니다. 정해진 비율로 <strong>자동으로</strong> 나누려면
        <strong> 내지 옵션 › 이미지 비율 › 여러 장으로 나누기</strong> — 그때도 여기 넣은 나눔선은 지킵니다.
      </Hint>

      <Hint>장평은 넓은 폭으로 줄바꿈을 계산한 뒤 가로로 눌러 맞추므로, 값을 바꾸면 줄바꿈 위치도 함께 바뀝니다.</Hint>
    </>
  );
}
