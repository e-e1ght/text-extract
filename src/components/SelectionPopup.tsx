import { useEffect, useRef, useState } from 'react';
import { BAR_SWATCHES, FONT_OPTIONS, HIGHLIGHT_SWATCHES } from '../defaults';
import {
  alignImage, applyBar, applyFontFamily, applyFontSize, applyHighlight,
  applyTextColor, barAtSelection, clearHighlight, hasSelectionInside,
  queryInline, removeFormatting, selectionImage, selectionRole, selectionText,
  toggleInline, type ImageAlign, type InlineCommand,
} from '../lib/format';
import { fontFamilyOf } from '../lib/fonts';
import type { Role } from '../lib/parse';
import { useStore } from '../store';

interface Position { top: number; left: number; below: boolean; }

const INLINE_BUTTONS: Array<{ command: InlineCommand; label: string; title: string }> = [
  { command: 'bold', label: 'B', title: '볼드' },
  { command: 'italic', label: 'I', title: '이탤릭' },
  { command: 'underline', label: 'U', title: '밑줄' },
  { command: 'strikeThrough', label: 'S', title: '취소선' },
];

const ROLE_LABEL: Record<Role, string> = {
  dialogue: '대사',
  narration: '서술',
  name: '이름',
  emph: '강조 서술',
  mark: '강조 서술',
};

const TEXT_SWATCHES = ['#2b2b33', '#8b1e1e', '#1f4f8b', '#1e6b4a', '#7a4fa8', '#8b5a2b', '#8a8a95'];

type Panel = 'none' | 'color' | 'highlight' | 'size' | 'character' | 'font' | 'bar' | 'image';
/** 색을 '이 선택 영역만' 바꿀지, '같은 역할 전체'에 적용할지 */
type ColorScope = 'role' | 'selection';

export function SelectionPopup({
  editorRoot, boundary, zoom,
}: { editorRoot: HTMLElement | null; boundary: HTMLElement | null; zoom: number }) {
  const { settings, patch, upsertCharacter } = useStore();
  const [position, setPosition] = useState<Position | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [panel, setPanel] = useState<Panel>('none');
  const [role, setRole] = useState<Role>('narration');
  const [scope, setScope] = useState<ColorScope>('role');
  const [picked, setPicked] = useState('');
  const [sizeInput, setSizeInput] = useState('');
  const [pickedImage, setPickedImage] = useState<HTMLImageElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  /**
   * 팝업 안의 입력칸이나 드롭다운에 포커스가 가면 본문 선택이 풀린다.
   * 마지막 선택을 들고 있다가 명령을 실행하기 직전에 되돌려 놓는다.
   */
  const lastRange = useRef<Range | null>(null);

  useEffect(() => {
    const update = () => {
      if (!editorRoot || !boundary) return;
      if (!hasSelectionInside(editorRoot)) {
        // 팝업 자체를 조작하는 중이라면 닫지 않는다.
        if (popupRef.current?.contains(document.activeElement)) return;
        setPosition(null);
        setPanel('none');
        return;
      }
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) lastRange.current = sel.getRangeAt(0).cloneRange();
      const rect = sel?.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setPosition(null);
        return;
      }
      const host = boundary.getBoundingClientRect();
      // boundary 는 스크롤되는 영역이라, 스크롤량을 더해야 글자에 붙어 따라다닌다.
      const top = rect.top - host.top + boundary.scrollTop;
      const left = rect.left - host.left + boundary.scrollLeft + rect.width / 2;
      void zoom; // 위치는 화면 좌표 기준이라 배율을 따로 곱하지 않는다
      // 위쪽 공간이 모자라면 글자 아래로 내린다.
      const below = rect.top - host.top < 120;
      setPosition({
        top: below ? top + rect.height + 10 : top - 10,
        left,
        below,
      });
      setActive(Object.fromEntries(INLINE_BUTTONS.map((b) => [b.command, queryInline(b.command)])));
      setRole(selectionRole(editorRoot));
      setPicked(selectionText());
      setPickedImage(selectionImage(editorRoot));
    };

    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [editorRoot, boundary, zoom]);

  if (!position || !editorRoot) return null;

  /** 팝업 입력칸을 거친 뒤에도 본문 선택을 되살려 명령이 먹히게 한다. */
  const withSelection = (action: () => void) => {
    const range = lastRange.current;
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    action();
  };

  const refreshActive = () =>
    setActive(Object.fromEntries(INLINE_BUTTONS.map((b) => [b.command, queryInline(b.command)])));

  /** 역할 전체에 적용하면 사이드바 색상과 그대로 연동된다. */
  const setColor = (color: string) => {
    if (scope === 'selection') {
      applyTextColor(editorRoot, color);
      return;
    }
    if (role === 'dialogue') patch('roles', { dialogue: color });
    else if (role === 'name') patch('roles', { name: color });
    else if (role === 'emph' || role === 'mark') patch('roles', { emphasis: color });
    else patch('roles', { narration: color });
  };

  const baseSize = role === 'dialogue' ? settings.typography.dialogueFontSize : settings.typography.fontSize;
  const isCharacter = Boolean(settings.characters[picked]);
  const fontChoices = [
    ...FONT_OPTIONS,
    ...settings.customFonts.map((font) => ({ label: `${font.label} (내 글꼴)`, value: fontFamilyOf(font) })),
  ];

  return (
    <div
      ref={popupRef}
      className={`selection-popup${position.below ? ' is-below' : ''}`}
      style={{ top: position.top, left: position.left }}
      /*
       * 버튼을 누를 때 선택이 풀리지 않도록 mousedown 을 막는다.
       * 다만 드롭다운·입력칸까지 막으면 아예 열리지 않으므로 그것들은 그대로 둔다.
       */
      onMouseDown={(event) => {
        const tag = (event.target as HTMLElement).tagName;
        if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'OPTION') return;
        event.preventDefault();
      }}
      data-export-ignore="true"
    >
      <div className="popup-main">
        {INLINE_BUTTONS.map((button) => (
          <button
            key={button.command}
            type="button"
            title={button.title}
            className={`popup-btn cmd-${button.command} ${active[button.command] ? 'is-active' : ''}`}
            onClick={() => { toggleInline(button.command); refreshActive(); }}
          >
            {button.label}
          </button>
        ))}
        <span className="popup-divider" />
        <button
          type="button"
          title="글자 색"
          className={`popup-btn ${panel === 'color' ? 'is-active' : ''}`}
          onClick={() => setPanel((v) => (v === 'color' ? 'none' : 'color'))}
        >
          색
        </button>
        <button
          type="button"
          title="하이라이트"
          className={`popup-btn ${panel === 'highlight' ? 'is-active' : ''}`}
          onClick={() => setPanel((v) => (v === 'highlight' ? 'none' : 'highlight'))}
        >
          형광
        </button>
        <button
          type="button"
          title="글자 크기"
          className={`popup-btn ${panel === 'size' ? 'is-active' : ''}`}
          onClick={() => setPanel((v) => (v === 'size' ? 'none' : 'size'))}
        >
          크기
        </button>
        <button
          type="button"
          title="글꼴"
          className={`popup-btn ${panel === 'font' ? 'is-active' : ''}`}
          onClick={() => setPanel((v) => (v === 'font' ? 'none' : 'font'))}
        >
          글꼴
        </button>
        <button
          type="button"
          title="왼쪽 세로선"
          className={`popup-btn ${panel === 'bar' ? 'is-active' : ''}`}
          onClick={() => setPanel((v) => (v === 'bar' ? 'none' : 'bar'))}
        >
          ▌
        </button>
        {pickedImage ? (
          <button
            type="button"
            title="이미지 크기·정렬"
            className={`popup-btn ${panel === 'image' ? 'is-active' : ''}`}
            onClick={() => setPanel((v) => (v === 'image' ? 'none' : 'image'))}
          >
            이미지
          </button>
        ) : null}
        <button
          type="button"
          title="선택한 글자를 캐릭터로 지정"
          className={`popup-btn ${panel === 'character' ? 'is-active' : ''}`}
          onClick={() => setPanel((v) => (v === 'character' ? 'none' : 'character'))}
        >
          캐릭터
        </button>
        <span className="popup-divider" />
        <button type="button" title="서식 지우기" className="popup-btn"
          onClick={() => { removeFormatting(editorRoot); refreshActive(); }}>
          지우기
        </button>
      </div>

      {panel === 'color' ? (
        <div className="popup-sub popup-sub-column">
          <div className="popup-scope">
            <button
              type="button"
              className={scope === 'role' ? 'is-active' : ''}
              onClick={() => setScope('role')}
            >
              {ROLE_LABEL[role]} 전체
            </button>
            <button
              type="button"
              className={scope === 'selection' ? 'is-active' : ''}
              onClick={() => setScope('selection')}
            >
              선택 영역만
            </button>
          </div>
          <div className="popup-row">
            {TEXT_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                className="swatch"
                style={{ background: color }}
                onClick={() => setColor(color)}
                title={color}
              />
            ))}
            <input type="color" className="swatch-picker" onChange={(e) => setColor(e.target.value)} />
          </div>
          <p className="popup-note">
            {scope === 'role'
              ? '패널의 색상 설정과 함께 바뀝니다.'
              : '이 영역에만 적용되며, 패널 색상보다 우선합니다.'}
          </p>
        </div>
      ) : null}

      {panel === 'highlight' ? (
        <div className="popup-sub">
          {HIGHLIGHT_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              className="swatch"
              style={{ background: color }}
              onClick={() => applyHighlight(color)}
              title={color}
            />
          ))}
          <input type="color" className="swatch-picker" onChange={(e) => applyHighlight(e.target.value)} />
          <button type="button" className="popup-btn slim" onClick={() => clearHighlight(editorRoot)}>없음</button>
        </div>
      ) : null}

      {panel === 'size' ? (
        <div className="popup-sub">
          {[-6, -3, -1, 1, 3, 6, 12].map((delta) => (
            <button
              key={delta}
              type="button"
              className="popup-btn slim"
              onClick={() => applyFontSize(editorRoot, Math.max(8, baseSize + delta))}
            >
              {baseSize + delta}
            </button>
          ))}
          <button type="button" className="popup-btn slim"
            onClick={() => applyFontSize(editorRoot, baseSize)}>
            기본 {baseSize}
          </button>
          <span className="popup-inline-input">
            <input
              type="number"
              min={8}
              max={200}
              placeholder="직접"
              value={sizeInput}
              onChange={(event) => setSizeInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                const next = Number(sizeInput);
                if (Number.isFinite(next) && next >= 8) withSelection(() => applyFontSize(editorRoot, next));
              }}
            />
            <button
              type="button"
              className="popup-btn slim"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const next = Number(sizeInput);
                if (Number.isFinite(next) && next >= 8) withSelection(() => applyFontSize(editorRoot, next));
              }}
            >
              적용
            </button>
          </span>
        </div>
      ) : null}

      {panel === 'font' ? (
        <div className="popup-sub popup-sub-column">
          <div className="popup-row">
            {fontChoices.map((font) => (
              <button
                key={font.value}
                type="button"
                className="popup-btn slim"
                style={{ fontFamily: font.value }}
                onClick={() => applyFontFamily(editorRoot, font.value)}
              >
                {font.label.replace(/\s*\(.*\)$/, '')}
              </button>
            ))}
          </div>
          <p className="popup-note">고른 글꼴이 드래그한 영역에만 적용됩니다.</p>
        </div>
      ) : null}

      {panel === 'bar' ? (
        <div className="popup-sub popup-sub-column">
          <div className="popup-row">
            {BAR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                className="swatch"
                style={{ background: color }}
                title={color}
                onClick={() => applyBar(editorRoot, color)}
              />
            ))}
            <input
              type="color"
              className="swatch-picker"
              onChange={(event) => applyBar(editorRoot, event.target.value)}
            />
          </div>
          <p className="popup-note">
            {barAtSelection(editorRoot)
              ? '이미 세로선이 있어 색만 바뀝니다.'
              : '드래그한 글 왼쪽에 세로선을 붙입니다.'}
          </p>
        </div>
      ) : null}

      {panel === 'image' && pickedImage ? (
        <div className="popup-sub popup-sub-column">
          <div className="popup-row">
            {([['왼쪽', 'left'], ['가운데', 'center'], ['오른쪽', 'right']] as Array<[string, ImageAlign]>)
              .map(([label, value]) => (
                <button
                  key={value}
                  type="button"
                  className="popup-btn slim"
                  onClick={() => alignImage(pickedImage, value)}
                >
                  {label}
                </button>
              ))}
          </div>
          <div className="popup-row">
            {[25, 50, 75, 100].map((percent) => (
              <button
                key={percent}
                type="button"
                className="popup-btn slim"
                onClick={() => { pickedImage.style.width = `${percent}%`; }}
              >
                {percent}%
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {panel === 'character' ? (
        <div className="popup-sub popup-sub-column">
          <p className="popup-note">
            선택한 글자: <strong>{picked || '(없음)'}</strong>
          </p>
          <div className="popup-row">
            <button
              type="button"
              className="popup-btn slim"
              disabled={!picked || isCharacter}
              onClick={() => {
                upsertCharacter(picked, { color: settings.roles.name });
                setPanel('none');
              }}
            >
              {isCharacter ? '이미 등록됨' : '캐릭터로 추가'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
