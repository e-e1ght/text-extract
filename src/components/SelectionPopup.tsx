import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BAR_SWATCHES, FONT_OPTIONS, HIGHLIGHT_SWATCHES } from '../defaults';
import {
  alignImage, applyBar, applyBubble, applyFontFamily, applyFontSize, applyHighlight,
  applyTextColor, barAtSelection, bubbleAtSelection, clearHighlight, hasSelectionInside,
  queryInline, removeBubble, removeFormatting, selectionImage, selectionRole, selectionText,
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

type Panel = 'none' | 'color' | 'highlight' | 'size' | 'character' | 'bubble' | 'font' | 'bar' | 'image';
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
  const [bubbleSpeaker, setBubbleSpeaker] = useState('');
  const [inBubble, setInBubble] = useState(false);

  /*
   * 위치는 화면(뷰포트) 좌표를 그대로 쓰고, CSS 는 position: fixed 다.
   * 예전에는 스테이지 기준으로 계산했는데, 팝업이 실제로 매달린 상자는 스크롤되는
   * 쪽이라 스크롤한 만큼 어긋나 한참 아래(가운데쯤)에 떨어져 있었다.
   * 화면 좌표면 매달린 상자가 무엇이든 상관없다 — 스크롤할 때마다 다시 잡아 준다.
   */
  const update = useCallback(() => {
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
    void zoom; // 화면 좌표라 배율을 따로 곱하지 않는다

    // 드래그한 글이 작업 영역 밖으로 스크롤돼 나가면 팝업도 함께 감춘다.
    if (rect.bottom < host.top || rect.top > host.bottom) {
      if (!popupRef.current?.contains(document.activeElement)) setPosition(null);
      return;
    }

    /*
     * 원칙은 '드래그한 글 바로 위'. 위로 올렸을 때 작업 영역 윗변에 걸려 잘릴
     * 때에만 아래로 내린다. 팝업 높이는 열린 하위 패널에 따라 달라지므로
     * 어림수가 아니라 실제 높이를 잰다(첫 표시 때는 한 줄 높이로 어림).
     */
    const popupHeight = popupRef.current?.offsetHeight ?? 44;
    const below = rect.top - popupHeight - 10 < host.top;

    // 좌우로도 화면을 넘지 않게 가둔다 (팝업은 가운데 정렬이라 절반씩 여유가 필요하다)
    const half = (popupRef.current?.offsetWidth ?? 0) / 2;
    const center = rect.left + rect.width / 2;
    const left = Math.min(
      Math.max(center, host.left + half + 8),
      host.right - half - 8,
    );

    setPosition({
      top: below ? rect.bottom + 10 : rect.top - 10,
      left,
      below,
    });
    setActive(Object.fromEntries(INLINE_BUTTONS.map((b) => [b.command, queryInline(b.command)])));
    setRole(selectionRole(editorRoot));
    setPicked(selectionText());
    setPickedImage(selectionImage(editorRoot));
    const bubble = bubbleAtSelection(editorRoot);
    setInBubble(Boolean(bubble));
    if (bubble?.dataset.teSpeaker) setBubbleSpeaker(bubble.dataset.teSpeaker);
  }, [editorRoot, boundary, zoom]);

  // 하위 패널을 여닫으면 팝업 높이가 달라진다 — 그리자마자 자리를 다시 잡는다.
  useLayoutEffect(() => { update(); }, [panel, update]);

  useEffect(() => {
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [update]);

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
  const characterNames = Object.keys(settings.characters);

  const makeBubble = () => {
    // 이미 말풍선이면 먼저 풀어 낸 뒤 새 인물로 다시 감싼다.
    // 풀면서 DOM 이 바뀌므로, 새로 생긴 요소를 다시 선택해 줘야 한다.
    if (bubbleAtSelection(editorRoot)) {
      const line = removeBubble(editorRoot);
      if (!line) return;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(line);
      sel?.removeAllRanges();
      sel?.addRange(range);
      lastRange.current = range.cloneRange();
    }
    // 색·프로필·좌우는 CSS 가 캐릭터 이름을 보고 붙인다 — 여기서는 이름만 넘긴다.
    applyBubble(bubbleSpeaker, Boolean(settings.characters[bubbleSpeaker]));
    setPanel('none');
  };

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
          title="말풍선으로 만들기"
          className={`popup-btn ${panel === 'bubble' ? 'is-active' : ''}`}
          onClick={() => setPanel((v) => (v === 'bubble' ? 'none' : 'bubble'))}
        >
          말풍선
        </button>
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

      {panel === 'bubble' ? (
        <div className="popup-sub popup-sub-column">
          <select
            className="popup-select"
            value={bubbleSpeaker}
            onChange={(event) => setBubbleSpeaker(event.target.value)}
          >
            <option value="">인물 없음 (말풍선만)</option>
            {characterNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="popup-row">
            <button
              type="button"
              className="popup-btn slim"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => withSelection(makeBubble)}
            >
              {inBubble ? '인물 바꾸기' : '말풍선으로 만들기'}
            </button>
            {inBubble ? (
              <button
                type="button"
                className="popup-btn slim"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => withSelection(() => { removeBubble(editorRoot); setPanel('none'); })}
              >
                말풍선 풀기
              </button>
            ) : null}
          </div>
          <p className="popup-note">
            {characterNames.length === 0
              ? '캐릭터를 먼저 추가하면 이름·프로필·색이 함께 붙습니다.'
              : bubbleSpeaker
                ? '이 캐릭터의 색·프로필·이름이 함께 붙습니다.'
                : '인물을 고르지 않으면 말풍선만 남습니다.'}
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
                upsertCharacter(picked, {});
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
