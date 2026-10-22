import { useCallback, useEffect, useRef, useState } from 'react';
import { BAR_SWATCHES, FONT_OPTIONS, HIGHLIGHT_SWATCHES } from '../defaults';
import {
  alignImage, applyBar, applyBubble, applyFontFamily, applyFontSize, applyHighlight,
  applyRedaction, applyScript, applyTextColor, barAtSelection, blockAtSelection, clearHighlight,
  hasSelectionInside, queryInline, redactionAtSelection, removeBlock, removeFormatting,
  removeRedaction, selectionImage, selectionRole, selectionText, toggleInline,
  type BlockKind, type ImageAlign, type InlineCommand, type RedactKind,
} from '../lib/format';
import { fontFamilyOf } from '../lib/fonts';
import { rememberColor } from '../lib/recentColors';
import { RecentSwatches } from './ui';
import { IconClose, IconEdit } from './icons';
import type { Role } from '../lib/parse';
import { useStore } from '../store';


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
  paren: '괄호 안',
};

const TEXT_SWATCHES = ['#2b2b33', '#8b1e1e', '#1f4f8b', '#1e6b4a', '#7a4fa8', '#8b5a2b', '#8a8a95'];

type Panel =
  | 'none' | 'color' | 'highlight' | 'size' | 'character'
  | 'bubble' | 'script' | 'font' | 'bar' | 'image' | 'redact';
/** 색을 '이 선택 영역만' 바꿀지, '같은 역할 전체'에 적용할지 */
type ColorScope = 'role' | 'selection';

/** 화면 안에 붙잡아 둔다 — 창을 줄였을 때 패널·단추가 화면 밖으로 사라지지 않게 */
function clampToViewport(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - Math.min(w, 120))),
    y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - Math.min(h, 40))),
  };
}

/** 이 브라우저에만 남기는 자리·크기 (사람마다 화면이 달라 서식과 따로 둔다) */
function usePersisted<T>(key: string, fallback: () => T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return { ...fallback(), ...JSON.parse(raw) } as T;
    } catch { /* 못 읽으면 기본값 */ }
    return fallback();
  });
  const save = useCallback((next: T) => {
    setValue(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* 저장 못 해도 동작은 한다 */ }
  }, [key]);
  return [value, save];
}

/** 누른 채 끌면 따라 움직인다. 거의 안 움직였으면 '클릭' 으로 본다 */
function dragFrom(
  event: React.PointerEvent, start: { x: number; y: number }, size: { w: number; h: number },
  onMove: (pos: { x: number; y: number }) => void, onClick?: () => void,
) {
  const sx = event.clientX;
  const sy = event.clientY;
  let moved = false;
  const move = (e: PointerEvent) => {
    if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 4) return;
    moved = true;
    onMove(clampToViewport(start.x + e.clientX - sx, start.y + e.clientY - sy, size.w, size.h));
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (!moved) onClick?.();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/**
 * 편집 패널.
 *
 * 예전에는 글을 드래그하면 그 위에 바로 떴다. 이제는 '편집' 단추로 열고 닫는 패널이다.
 * 단추와 패널 모두 끌어서 옮길 수 있고, 패널은 오른쪽 아래 모서리를 끌어 크기를 바꾼다.
 * 열려 있는 동안은 계속 떠 있고, 본문에서 고른 글이 없으면 단추들이 잠긴다.
 */
export function SelectionPopup({ editorRoot }: { editorRoot: HTMLElement | null }) {
  const { settings, patch, upsertCharacter } = useStore();
  /** 본문에서 고른 글이 있는지 (없으면 단추를 잠근다) */
  const [hasTarget, setHasTarget] = useState(false);
  const [open, setOpen] = usePersisted('te-edit-panel-open', () => ({ value: false }));
  const [launcher, setLauncher] = usePersisted('te-edit-launcher', () => ({
    x: window.innerWidth - 120, y: window.innerHeight - 150,
  }));
  const [box, setBox] = usePersisted('te-edit-panel', () => ({
    x: Math.max(16, window.innerWidth - 680), y: 110, w: 620, h: 300,
  }));
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
  /** 커서가 이미 말풍선/대본 안에 있으면 '만들기' 대신 '바꾸기·풀기' 를 보여준다 */
  const [inBlock, setInBlock] = useState<BlockKind | null>(null);
  /** 고른 곳이 이미 가려져 있으면 그 방식 — '가리기 풀기' 를 보여 줄지 정한다 */
  const [redaction, setRedaction] = useState<RedactKind | null>(null);

  /** 본문 선택이 바뀔 때마다 '무엇을 골랐는지' 를 다시 읽는다 */
  const update = useCallback(() => {
    if (!editorRoot) return;
    if (!hasSelectionInside(editorRoot)) {
      // 패널의 입력칸·드롭다운을 만지는 중이면 본문 선택이 잠시 풀린다 — 그때는 그대로 둔다
      if (popupRef.current?.contains(document.activeElement)) return;
      setHasTarget(false);
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) lastRange.current = sel.getRangeAt(0).cloneRange();
    setHasTarget(true);
    setActive(Object.fromEntries(INLINE_BUTTONS.map((b) => [b.command, queryInline(b.command)])));
    setRole(selectionRole(editorRoot));
    setPicked(selectionText());
    setPickedImage(selectionImage(editorRoot));
    const block = blockAtSelection(editorRoot);
    setInBlock(block ? (block.classList.contains('te-script') ? 'script' : 'bubble') : null);
    if (block?.dataset.teSpeaker) setBubbleSpeaker(block.dataset.teSpeaker);
    setRedaction(redactionAtSelection(editorRoot));
  }, [editorRoot]);

  /*
   * 서식을 줘도 선택은 그대로 남으므로 팝업도 떠 있다 — 한 번 드래그로 볼드·형광 등을
   * 이어서 줄 수 있게. 닫는 것은 다른 곳을 누르거나(선택이 풀림) Esc 를 눌렀을 때뿐이다.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !hasSelectionInside(editorRoot)) return;
      window.getSelection()?.collapseToEnd();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editorRoot]);

  useEffect(() => {
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [update]);

  const boxRef = useRef(box);
  boxRef.current = box;

  /*
   * 오른쪽 아래 손잡이를 끌어 크기를 바꾼다.
   * CSS resize 를 쓰지 않는 까닭: 패널은 누를 때 본문 선택이 풀리지 않게 mousedown 을
   * 막는데, 그러면 브라우저의 크기 조절 손잡이도 함께 죽는다.
   */
  const startResize = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const sx = event.clientX;
    const sy = event.clientY;
    const start = boxRef.current;
    const move = (e: PointerEvent) => {
      setBox({
        ...boxRef.current,
        w: Math.round(Math.min(window.innerWidth - start.x - 8, Math.max(280, start.w + e.clientX - sx))),
        h: Math.round(Math.min(window.innerHeight - start.y - 8, Math.max(120, start.h + e.clientY - sy))),
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (!editorRoot) return null;

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
    rememberColor(color);
    if (scope === 'selection') {
      applyTextColor(editorRoot, color);
      return;
    }
    if (role === 'dialogue') patch('roles', { dialogue: color });
    else if (role === 'name') patch('roles', { name: color });
    else if (role === 'emph' || role === 'mark') patch('roles', { emphasis: color });
    else patch('roles', { narration: color });
  };

  const highlight = (color: string) => {
    rememberColor(color);
    applyHighlight(color);
  };
  const bar = (color: string) => {
    rememberColor(color);
    applyBar(editorRoot, color);
  };

  const baseSize = role === 'dialogue' ? settings.typography.dialogueFontSize : settings.typography.fontSize;
  const isCharacter = Boolean(settings.characters[picked]);
  const fontChoices = [
    ...FONT_OPTIONS,
    ...settings.customFonts.map((font) => ({ label: `${font.label} (내 글꼴)`, value: fontFamilyOf(font) })),
  ];
  const characterNames = Object.keys(settings.characters);

  const makeBlock = (kind: BlockKind) => {
    // 이미 상자 안이면 먼저 풀어 낸 뒤 새 인물로 다시 감싼다.
    // 풀면서 DOM 이 바뀌므로, 새로 생긴 요소를 다시 선택해 줘야 한다.
    if (blockAtSelection(editorRoot)) {
      const line = removeBlock(editorRoot);
      if (!line) return;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(line);
      sel?.removeAllRanges();
      sel?.addRange(range);
      lastRange.current = range.cloneRange();
    }
    // 색·프로필은 CSS 가 캐릭터 이름을 보고 붙인다 — 여기서는 이름만 넘긴다.
    const registered = Boolean(settings.characters[bubbleSpeaker]);
    if (kind === 'script') applyScript(bubbleSpeaker, registered);
    else applyBubble(bubbleSpeaker, registered);
    setPanel('none');
  };

  const launcherPos = clampToViewport(launcher.x, launcher.y, 90, 40);
  const panelPos = clampToViewport(box.x, box.y, box.w, box.h);

  const launcherButton = (
    <button
      type="button"
      className={`edit-launcher${open.value ? ' is-open' : ''}`}
      style={{ left: launcherPos.x, top: launcherPos.y }}
      title={open.value ? '편집 패널 닫기 (끌어서 옮길 수 있음)' : '편집 패널 열기 (끌어서 옮길 수 있음)'}
      data-export-ignore="true"
      // 단추를 눌러도 본문 선택이 풀리지 않게
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => dragFrom(
        event, launcherPos, { w: 90, h: 40 },
        (pos) => setLauncher(pos),
        () => setOpen({ value: !open.value }),
      )}
    >
      <IconEdit />
      <span>편집</span>
    </button>
  );
  if (!open.value) return launcherButton;

  return (
    <>
    {launcherButton}
    <div
      ref={popupRef}
      className={`edit-panel${hasTarget ? '' : ' is-idle'}`}
      style={{ left: panelPos.x, top: panelPos.y, width: box.w, height: box.h }}
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
      <div
        className="edit-panel-head"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          dragFrom(event, panelPos, { w: box.w, h: box.h }, (pos) => setBox({ ...boxRef.current, ...pos }));
        }}
      >
        <span className="edit-panel-title">편집</span>
        <span className="edit-panel-target">
          {hasTarget
            ? (pickedImage ? '고른 이미지' : `고른 글: ${picked.length > 18 ? `${picked.slice(0, 18)}…` : picked}`)
            : '본문에서 글을 드래그해 고르세요'}
        </span>
        <button type="button" className="edit-panel-close" title="닫기" onClick={() => setOpen({ value: false })}>
          <IconClose />
        </button>
      </div>
      {/* 고른 글이 없으면 통째로 잠근다 — 무엇에 적용될지 모르는 채 누르지 않게 */}
      <fieldset className="edit-panel-body" disabled={!hasTarget}>
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
        <span className="popup-divider" />
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
          title="대본 형식으로 만들기 (이름과 대사를 나란히)"
          className={`popup-btn ${panel === 'script' ? 'is-active' : ''}`}
          onClick={() => setPanel((v) => (v === 'script' ? 'none' : 'script'))}
        >
          대본
        </button>
        <span className="popup-divider" />
        <button
          type="button"
          title="선택한 글자를 캐릭터로 지정"
          className={`popup-btn ${panel === 'character' ? 'is-active' : ''}`}
          onClick={() => setPanel((v) => (v === 'character' ? 'none' : 'character'))}
        >
          캐릭터
        </button>
        <span className="popup-divider" />
        <button
          type="button"
          title="고른 글을 검은 막대나 흐림으로 가리기"
          className={`popup-btn ${panel === 'redact' ? 'is-active' : ''}`}
          onClick={() => setPanel((v) => (v === 'redact' ? 'none' : 'redact'))}
        >
          가리기
        </button>
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
          <RecentSwatches compact onPick={setColor} />
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
              onClick={() => highlight(color)}
              title={color}
            />
          ))}
          <input type="color" className="swatch-picker" onChange={(e) => highlight(e.target.value)} />
          <button type="button" className="popup-btn slim" onClick={() => clearHighlight(editorRoot)}>없음</button>
          <RecentSwatches compact onPick={highlight} />
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
                onClick={() => bar(color)}
              />
            ))}
            <input
              type="color"
              className="swatch-picker"
              onChange={(event) => bar(event.target.value)}
            />
          </div>
          <RecentSwatches compact onPick={bar} />
          <p className="popup-note">
            {barAtSelection(editorRoot)
              ? '이미 세로선이 있어 색만 바뀝니다.'
              : '드래그한 글 왼쪽에 세로선을 붙입니다.'}
          </p>
        </div>
      ) : null}

      {panel === 'redact' ? (
        <div className="popup-sub popup-sub-column">
          <div className="popup-row">
            <button
              type="button"
              className={`popup-btn ${redaction === 'bar' ? 'is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => withSelection(() => { applyRedaction(editorRoot, 'bar'); setRedaction('bar'); })}
            >
              ▇ 검은 막대
            </button>
            <button
              type="button"
              className={`popup-btn ${redaction === 'blur' ? 'is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => withSelection(() => { applyRedaction(editorRoot, 'blur'); setRedaction('blur'); })}
            >
              흐림
            </button>
            {redaction ? (
              <button
                type="button"
                className="popup-btn"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => withSelection(() => { removeRedaction(editorRoot); setRedaction(null); })}
              >
                가리기 풀기
              </button>
            ) : null}
          </div>
          <p className="popup-note">
            글은 지우지 않고 덮기만 합니다. 저장한 그림에서는 읽을 수 없고, 여기서 언제든 풀 수 있습니다.
          </p>
        </div>
      ) : null}

      {panel === 'bubble' || panel === 'script' ? (
        <div className="popup-sub popup-sub-column">
          <select
            className="popup-select"
            value={bubbleSpeaker}
            onChange={(event) => setBubbleSpeaker(event.target.value)}
          >
            <option value="">인물 없음</option>
            {characterNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="popup-row">
            <button
              type="button"
              className="popup-btn slim"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => withSelection(() => makeBlock(panel === 'script' ? 'script' : 'bubble'))}
            >
              {inBlock === panel ? '인물 바꾸기' : panel === 'script' ? '대본으로 만들기' : '말풍선으로 만들기'}
            </button>
            {inBlock ? (
              <button
                type="button"
                className="popup-btn slim"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => withSelection(() => { removeBlock(editorRoot); setPanel('none'); })}
              >
                {inBlock === 'script' ? '대본 풀기' : '말풍선 풀기'}
              </button>
            ) : null}
          </div>
          <p className="popup-note">
            {characterNames.length === 0
              ? '캐릭터를 먼저 추가하면 이름과 색이 함께 붙습니다.'
              : panel === 'script'
                ? bubbleSpeaker
                  ? '이름과 대사가 나란히 놓이고, 그 캐릭터의 이름·대사 색을 씁니다.'
                  : '인물을 고르면 이름이 앞에 붙습니다.'
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
      </fieldset>
      <div className="edit-panel-resize" title="끌어서 크기 조절" onPointerDown={startResize} />
    </div>
    </>
  );
}
