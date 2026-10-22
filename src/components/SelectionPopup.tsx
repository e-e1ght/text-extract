import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { IconClose, IconEdit } from './icons';
import { ColorPicker } from './ColorPicker';
import { FontSelect, SizeCombo } from './Dropdowns';
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

const TEXT_SWATCHES = ['#2b2b33', '#8b1e1e', '#1f4f8b', '#1e6b4a', '#7a4fa8'];


type Panel =
  | 'none' | 'color' | 'highlight' | 'character'
  | 'bubble' | 'script' | 'bar' | 'image' | 'redact';
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
export function SelectionPopup({ editorRoot, stage }: { editorRoot: HTMLElement | null; stage: HTMLElement | null }) {
  const { settings, patch, upsertCharacter } = useStore();
  /** 본문에서 고른 글이 있는지 (없으면 단추를 잠근다) */
  const [hasTarget, setHasTarget] = useState(false);
  const [open, setOpen] = usePersisted('te-edit-panel-open', () => ({ value: false }));
  /*
   * w·h 가 0 이면 '내용에 맞춤'. 크기 손잡이로 줄였을 때만 값이 생긴다 (작은 화면용).
   * 예전(v1)에는 620×300 으로 시작해 너무 컸다 — 열쇠를 바꿔 그 값을 버린다.
   */
  const [box, setBox] = usePersisted('te-edit-panel-v2', () => ({
    x: Math.max(16, window.innerWidth - 340), y: 110, w: 0, h: 0, collapsed: false,
    /** 한 번이라도 자리를 잡았는지 — 처음 열 때는 편집 단추 바로 아래에 놓는다 */
    placed: false,
  }));
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [panel, setPanel] = useState<Panel>('none');
  const [role, setRole] = useState<Role>('narration');
  const [scope, setScope] = useState<ColorScope>('role');
  const [picked, setPicked] = useState('');
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
  /** 지금 고른 글자의 색·글꼴·크기 — 고르는 칸이 여기서 시작한다 */
  const [pickedColor, setPickedColor] = useState('#000000');
  const [pickedFont, setPickedFont] = useState('');
  const [pickedSize, setPickedSize] = useState(17);
  /**
   * 제목·부제목·제작자 안을 골랐으면 그 줄. 본문과 같은 서식 명령을 그 줄에 건다 —
   * 다만 말풍선·대본·세로선처럼 본문 줄에만 맞는 것은 감춘다.
   */
  const [metaEl, setMetaEl] = useState<HTMLElement | null>(null);
  /** 고른 곳이 이미 가려져 있으면 그 방식 — '가리기 풀기' 를 보여 줄지 정한다 */
  const [redaction, setRedaction] = useState<RedactKind | null>(null);

  /** 본문 선택이 바뀔 때마다 '무엇을 골랐는지' 를 다시 읽는다 */
  const update = useCallback(() => {
    if (!editorRoot) return;
    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    let meta: HTMLElement | null = null;
    if (!hasSelectionInside(editorRoot)) {
      // 제목·부제목·제작자는 본문 밖이라 따로 본다
      const node = range && !range.collapsed ? range.commonAncestorContainer : null;
      meta = (node?.nodeType === Node.ELEMENT_NODE ? node as Element : node?.parentElement)
        ?.closest<HTMLElement>('.meta-editable') ?? null;
      if (!meta) {
        // 패널의 입력칸·드롭다운을 만지는 중이면 본문 선택이 잠시 풀린다 — 그때는 그대로 둔다
        if (popupRef.current?.contains(document.activeElement)) return;
        setMetaEl(null);
        setHasTarget(false);
        return;
      }
    }
    if (range) lastRange.current = range.cloneRange();
    setMetaEl(meta);
    setHasTarget(true);
    setActive(Object.fromEntries(INLINE_BUTTONS.map((b) => [b.command, queryInline(b.command)])));
    if (meta) {
      setPickedImage(null);
      setInBlock(null);
      setRedaction(null);
    } else {
      setRole(selectionRole(editorRoot));
      setPicked(selectionText());
      setPickedImage(selectionImage(editorRoot));
      const block = blockAtSelection(editorRoot);
      setInBlock(block ? (block.classList.contains('te-script') ? 'script' : 'bubble') : null);
      if (block?.dataset.teSpeaker) setBubbleSpeaker(block.dataset.teSpeaker);
      setRedaction(redactionAtSelection(editorRoot));
    }
    // 피커가 '지금 그 글자의 색' 에서 시작하도록 읽어 둔다
    if (range) {
      const start = range.startContainer;
      const el = start.nodeType === Node.ELEMENT_NODE ? start as Element : start.parentElement;
      if (el) {
        const cs = getComputedStyle(el);
        setPickedColor(cs.color);
        setPickedFont(cs.fontFamily);
        setPickedSize(Math.round(parseFloat(cs.fontSize) * 10) / 10);
      }
    }
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
    const start = boxRef.current;
    // 내용에 맞춘 상태에서 시작하면 지금 보이는 폭에서부터 줄인다
    const w0 = popupRef.current?.offsetWidth ?? 268;
    const move = (e: PointerEvent) => {
      setBox({
        ...boxRef.current,
        w: Math.round(Math.min(window.innerWidth - start.x - 8, Math.max(180, w0 + e.clientX - sx))),
        h: 0,
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
  /** 서식을 걸 곳 — 제목 줄을 골랐으면 그 줄, 아니면 본문 */
  const root = metaEl?.isConnected ? metaEl : editorRoot;
  const inMeta = root !== editorRoot;

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
    if (inMeta || scope === 'selection') {
      applyTextColor(root, color);
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

  const roleColor = role === 'dialogue' ? settings.roles.dialogue
    : role === 'name' ? settings.roles.name
      : role === 'emph' || role === 'mark' ? settings.roles.emphasis
        : settings.roles.narration;

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

  /** 세부 설정을 펼치는 단추 — 다시 누르면 접힌다 */
  const tab = (id: Panel, label: string, title: string) => (
    <button
      type="button"
      title={title}
      className={`popup-btn ${panel === id ? 'is-active' : ''}`}
      onClick={() => setPanel((v) => (v === id ? 'none' : id))}
    >
      {label}
    </button>
  );

  const panelPos = clampToViewport(box.x, box.y, box.w || 268, 40);

  const toggleOpen = () => {
    if (!open.value && stage) {
      const r = stage.getBoundingClientRect();
      const w = box.w || 268;
      /*
       * 처음 열 때, 또는 기억해 둔 자리가 작업 영역 밖일 때(도구를 반대쪽으로 옮겼거나 창을 줄임)는
       * 편집 단추 바로 아래로 데려온다 — 도구 패널 위에 덮여 열리지 않게.
       */
      const outside = box.x < r.left || box.x + w > r.right || box.y < r.top || box.y > r.bottom - 40;
      if (!box.placed || outside) {
        setBox({ ...boxRef.current, x: Math.round(r.right - w - 14), y: Math.round(r.top + 56), placed: true });
      }
    }
    setOpen({ value: !open.value });
  };

  /*
   * 편집 단추는 옮기지 않는다 — 작업 영역 오른쪽 위에 박아 둔다.
   * 작업 영역 안에 그리므로, 도구를 오른쪽으로 옮기거나 폭을 바꿔도 도구 패널과 겹치지 않는다.
   */
  const launcherButton = stage ? createPortal(
    <button
      type="button"
      className={`edit-launcher${open.value ? ' is-open' : ''}`}
      title={open.value ? '편집 패널 닫기' : '편집 패널 열기'}
      data-export-ignore="true"
      // 단추를 눌러도 본문 선택이 풀리지 않게
      onMouseDown={(event) => event.preventDefault()}
      onClick={toggleOpen}
    >
      <IconEdit />
      <span>편집</span>
    </button>,
    stage,
  ) : null;
  if (!open.value) return launcherButton;

  return (
    <>
    {launcherButton}
    <div
      ref={popupRef}
      className={`edit-panel${hasTarget ? '' : ' is-idle'}${box.collapsed ? ' is-collapsed' : ''}`}
      style={{
        left: panelPos.x,
        top: panelPos.y,
        width: box.w || undefined,
        // 높이는 늘 내용에 맞춘다 — 세부 설정을 펼치면 저절로 커진다 (화면보다 크면 그때만 스크롤)
      }}
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
          const node = popupRef.current;
          dragFrom(event, panelPos, { w: node?.offsetWidth ?? 268, h: node?.offsetHeight ?? 40 },
            (pos) => setBox({ ...boxRef.current, ...pos, placed: true }));
        }}
      >
        <span className="edit-panel-title">편집</span>
        <span className="ep-spacer" />
        <button
          type="button"
          className="edit-panel-close"
          title={box.collapsed ? '펼치기' : '접기'}
          onClick={() => setBox({ ...boxRef.current, collapsed: !box.collapsed })}
        >
          {box.collapsed ? '▸' : '▾'}
        </button>
        <button type="button" className="edit-panel-close" title="닫기" onClick={() => setOpen({ value: false })}>
          <IconClose size={11} />
        </button>
      </div>
      {/* 고른 글이 없으면 통째로 잠근다 — 무엇에 적용될지 모르는 채 누르지 않게 */}
      <fieldset className="edit-panel-body" disabled={!hasTarget}>
      {/*
        포토샵 문자 패널처럼 줄마다 한 묶음: 서식 / 글자 / 묶기.
        세부 설정은 그 아래에 펼쳐진다.
      */}
      <div className="popup-main ep-rows">
        <div className="ep-row">
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
          <span className="ep-spacer" />
          <button type="button" title="서식 지우기" className="popup-btn"
            onClick={() => { removeFormatting(root); refreshActive(); }}>
            지우기
          </button>
        </div>
        {/* 포토샵 문자 패널처럼 글꼴·크기는 늘 보이게 */}
        <div className="ep-row ep-type">
          <FontSelect
            value={pickedFont}
            options={fontChoices}
            onPick={(family) => withSelection(() => applyFontFamily(root, family))}
          />
          <SizeCombo
            value={pickedSize}
            onApply={(size) => withSelection(() => applyFontSize(root, size))}
            max={160}
          />
        </div>
        <div className="ep-row">
          {tab('color', '색', '글자 색')}
          {tab('highlight', '형광', '하이라이트')}
          {inMeta ? null : tab('bar', '▌', '왼쪽 세로선')}
          {pickedImage ? tab('image', '이미지', '이미지 크기·정렬') : null}
        </div>
        {inMeta ? null : (
        <div className="ep-row">
          {tab('bubble', '말풍선', '말풍선으로 만들기')}
          {tab('script', '대본', '대본 형식으로 만들기 (이름과 대사를 나란히)')}
          {tab('character', '캐릭터', '선택한 글자를 캐릭터로 지정')}
          {tab('redact', '가리기', '고른 글을 검은 막대나 흐림으로 가리기')}
        </div>
        )}
      </div>

      {panel === 'color' ? (
        <div className="popup-sub popup-sub-column">
          {/* 고른 부분이 먼저 — 드래그한 뒤 고르는 것이니 가까운 쪽이 왼쪽. 제목 줄은 고른 부분뿐 */}
          {inMeta ? null : (
          <div className="popup-scope">
            <button
              type="button"
              className={scope === 'selection' ? 'is-active' : ''}
              onClick={() => setScope('selection')}
            >
              선택 영역만
            </button>
            <button
              type="button"
              className={scope === 'role' ? 'is-active' : ''}
              onClick={() => setScope('role')}
            >
              {ROLE_LABEL[role]} 전체
            </button>
          </div>
          )}
          <ColorPicker
            value={scope === 'role' && !inMeta ? roleColor : pickedColor}
            // 코드 입력칸을 거치면 본문 선택이 풀린다 — 되살린 뒤 적용한다
            onPick={(color) => withSelection(() => setColor(color))}
            swatches={TEXT_SWATCHES}
          />
          {inMeta ? null : (
          <p className="popup-note">
            {scope === 'role'
              ? '같은 역할의 글이 모두 이 색으로 바뀝니다 (캐릭터 색이 정해진 대사·이름은 그대로).'
              : '이 영역에만 적용되며, 패널 색상보다 우선합니다.'}
          </p>
          )}
        </div>
      ) : null}

      {panel === 'highlight' ? (
        <div className="popup-sub popup-sub-column">
          <ColorPicker value="#fff2a8" onPick={(color) => withSelection(() => highlight(color))}
            swatches={HIGHLIGHT_SWATCHES.slice(0, 5)} />
          <div className="popup-row">
            <button type="button" className="popup-btn slim"
              onClick={() => withSelection(() => clearHighlight(root))}>형광 지우기</button>
          </div>
        </div>
      ) : null}

      {panel === 'bar' ? (
        <div className="popup-sub popup-sub-column">
          <ColorPicker value={BAR_SWATCHES[0]} onPick={(color) => withSelection(() => bar(color))}
            swatches={BAR_SWATCHES.slice(0, 5)} />
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
      <div
        className="edit-panel-resize"
        title="끌어서 폭 조절 · 두 번 누르면 기본 폭"
        onPointerDown={startResize}
        onDoubleClick={() => setBox({ ...boxRef.current, w: 0, h: 0 })}
      />
    </div>
    </>
  );
}
