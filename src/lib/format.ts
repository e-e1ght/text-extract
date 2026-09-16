/**
 * 선택 영역 서식 적용.
 * contenteditable 의 블록 경계를 안전하게 다루기 위해 execCommand 를 쓴다.
 * (표준에서 deprecated 지만 모든 주요 브라우저가 여전히 지원하며,
 *  직접 Range 를 조작하는 것보다 중첩이 깨지는 경우가 훨씬 적다.)
 */
import type { Role } from './parse';
import { ensureWebFont } from './webfonts';

export type InlineCommand = 'bold' | 'italic' | 'underline' | 'strikeThrough';

const FONT_SIZE_SENTINEL = '7';

function setCssStyling(enabled: boolean) {
  try {
    document.execCommand('styleWithCSS', false, enabled ? 'true' : 'false');
  } catch {
    /* 일부 브라우저에서 미지원 */
  }
}

/**
 * 사이드바 버튼을 누르면 본문에서 포커스가 떠나 커서 자리가 사라진다.
 * 마지막 커서·선택을 기억해 두었다가 명령 직전에 되돌린다.
 */
let remembered: Range | null = null;

export function rememberSelection(root: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (root.contains(range.commonAncestorContainer)) remembered = range.cloneRange();
}

export function restoreSelection(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel) return false;
  if (sel.rangeCount > 0 && root.contains(sel.getRangeAt(0).commonAncestorContainer)) return true;
  if (!remembered || !root.contains(remembered.commonAncestorContainer)) return false;
  sel.removeAllRanges();
  sel.addRange(remembered);
  return true;
}

export function hasSelectionInside(root: HTMLElement | null): boolean {
  if (!root) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  return root.contains(range.commonAncestorContainer);
}

/**
 * 사용자가 직접 준 색·크기를 CSS 변수로도 복제한다.
 *
 * 역할(대사/서술/이름) 색은 `color: var(--te-ink, <역할색>)` 으로 읽으므로,
 * 바깥쪽 span 이 --te-ink 를 물려주면 안쪽 역할 span 까지 그 색을 따른다.
 * 덕분에 드래그로 준 서식이 항상 사이드바 역할 서식을 이긴다.
 */
export function syncInlineVars(root: HTMLElement): void {
  /*
   * 역할 span 도 반드시 포함해야 한다.
   * 브라우저는 선택 영역이 역할 span 과 정확히 겹칠 때 그 span 에 바로 색을 얹는데,
   * --te-ink 를 같이 심어 두지 않으면 재파싱에서 새로 만들어진 안쪽 역할 span 이
   * 자기 기본색으로 되돌아가 "일부만 색이 바뀌는" 현상이 생긴다.
   */
  root.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const color = el.style.color;
    if (color) el.style.setProperty('--te-ink', color);
    else el.style.removeProperty('--te-ink');

    const size = el.style.fontSize;
    if (size) el.style.setProperty('--te-size', size);
    else el.style.removeProperty('--te-size');

    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
}

export function toggleInline(command: InlineCommand): void {
  setCssStyling(true);
  document.execCommand(command);
}

export function queryInline(command: InlineCommand): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

export function applyTextColor(root: HTMLElement, color: string): void {
  setCssStyling(true);
  document.execCommand('foreColor', false, color);
  syncInlineVars(root);
}

export function applyHighlight(color: string): void {
  setCssStyling(true);
  // hiliteColor 미지원 브라우저 대비로 backColor 를 함께 시도한다.
  if (!document.execCommand('hiliteColor', false, color)) {
    document.execCommand('backColor', false, color);
  }
}

export function clearHighlight(root: HTMLElement): void {
  applyHighlight('transparent');
  root.querySelectorAll<HTMLElement>('[style*="background-color: transparent"]').forEach((el) => {
    el.style.backgroundColor = '';
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
}

/**
 * 선택 영역에만 px 단위 글자 크기를 적용한다.
 *
 * styleWithCSS 가 켜져 있으면 execCommand('fontSize') 가 `font-size: xxx-large`
 * 같은 키워드 값을 넣어버려 이후 크기 조절이 먹지 않는다. 그래서 반드시 끄고
 * <font size="7"> 를 만든 뒤 px 단위 span 으로 바꿔친다.
 */
export function applyFontSize(root: HTMLElement, px: number): void {
  setCssStyling(false);
  document.execCommand('fontSize', false, FONT_SIZE_SENTINEL);

  root.querySelectorAll<HTMLElement>(`font[size="${FONT_SIZE_SENTINEL}"]`).forEach((fontEl) => {
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    while (fontEl.firstChild) span.appendChild(fontEl.firstChild);
    fontEl.parentNode?.replaceChild(span, fontEl);
  });

  // styleWithCSS 를 끄지 못하는 브라우저가 남긴 키워드 크기를 px 로 정리한다.
  root.querySelectorAll<HTMLElement>('span[style*="large"], span[style*="small"]').forEach((el) => {
    if (/^(xx-|x-|xxx-)?(large|small)$/.test(el.style.fontSize)) {
      el.style.fontSize = `${px}px`;
    }
  });

  syncInlineVars(root);
}

/** 선택 영역에만 글꼴을 적용한다. */
export function applyFontFamily(root: HTMLElement, family: string): void {
  ensureWebFont(family);
  setCssStyling(true);
  document.execCommand('fontName', false, family);
  // 일부 브라우저는 여전히 <font face> 를 만든다.
  root.querySelectorAll<HTMLElement>('font[face]').forEach((fontEl) => {
    const span = document.createElement('span');
    span.style.fontFamily = fontEl.getAttribute('face') ?? family;
    while (fontEl.firstChild) span.appendChild(fontEl.firstChild);
    fontEl.parentNode?.replaceChild(span, fontEl);
  });
  syncInlineVars(root);
}

/** 커서 자리에 이미지를 넣는다. */
export function insertImage(root: HTMLElement, url: string, widthPercent = 60): void {
  const image = document.createElement('img');
  image.src = url;
  image.className = 'te-img';
  image.style.width = `${widthPercent}%`;
  image.dataset.teImg = 'true';

  restoreSelection(root);
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && root.contains(sel.getRangeAt(0).startContainer)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(image);
    range.setStartAfter(image);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    root.appendChild(image);
  }
}

/** 클릭하거나 드래그한 이미지. 클릭만 해도 잡히도록 선택 범위를 이미지에 맞춰 둔다. */
export function selectionImage(root: HTMLElement | null): HTMLImageElement | null {
  if (!root) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);

  const container = range.commonAncestorContainer;
  if (container.nodeType === Node.ELEMENT_NODE) {
    const el = container as HTMLElement;
    if (el.tagName === 'IMG') return el as HTMLImageElement;
    const found = el.querySelectorAll?.('img[data-te-img]');
    if (found && found.length === 1 && range.toString() === '') return found[0] as HTMLImageElement;
    if (found && found.length === 1) return found[0] as HTMLImageElement;
  }
  return null;
}

/** 이미지를 클릭했을 때 그 이미지만 선택 상태로 만든다. */
export function selectImage(image: HTMLImageElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNode(image);
  sel.removeAllRanges();
  sel.addRange(range);
  remembered = range.cloneRange();
}

export type ImageAlign = 'left' | 'center' | 'right';

export function alignImage(image: HTMLImageElement, align: ImageAlign): void {
  image.style.display = 'block';
  image.style.marginTop = '6px';
  image.style.marginBottom = '6px';
  image.style.marginLeft = align === 'left' ? '0' : 'auto';
  image.style.marginRight = align === 'right' ? '0' : 'auto';
}

/**
 * 예전에 드래그로 만들어 둔 말풍선을 평범한 줄로 되돌린다.
 *
 * 드래그 말풍선은 없앴다 — 대사 span 안에 들어가기도 하고 밖에 놓이기도 해서
 * 메신저와 겹치는 경우가 너무 많았다. 말풍선은 메신저 테마가 맡는다.
 * 저장해 둔 글에 남아 있을 수 있으므로 불러올 때 한 번 풀어 준다.
 */
export function unwrapLegacyBubbles(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.te-bubble').forEach((bubble) => {
    const parent = bubble.parentNode;
    if (!parent) return;
    bubble.querySelector('.te-bubble-name')?.remove();
    const body = bubble.querySelector('.te-bubble-text') ?? bubble;
    const line = document.createElement('span');
    while (body.firstChild) line.appendChild(body.firstChild);
    parent.replaceChild(line, bubble);
  });
  root.normalize();
}

export function removeFormatting(root: HTMLElement): void {
  document.execCommand('removeFormat');
  root.querySelectorAll<HTMLElement>('span[style]').forEach((el) => {
    if (el.dataset.teRole) return;
    el.style.removeProperty('--te-ink');
    el.style.removeProperty('--te-size');
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
}

/**
 * 선택한 글 왼쪽에 색 있는 세로선을 붙인다.
 * 색은 --te-bar-color 로 들고 있어 나중에 색만 바꿀 수도 있다.
 */
export function applyBar(root: HTMLElement, color: string): void {
  restoreSelection(root);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  // 이미 세로선 안이라면 색만 갈아 끼운다.
  const existing = barAtSelection(root);
  if (existing) {
    existing.style.setProperty('--te-bar-color', color);
    return;
  }

  // 드래그하지 않았다면 커서가 놓인 줄 전체에 붙인다.
  if (sel.isCollapsed) {
    let line: Node | null = sel.getRangeAt(0).startContainer;
    while (line && line.parentNode !== root) line = line.parentNode;
    if (!line || !line.textContent?.trim()) return;
    const lineRange = document.createRange();
    lineRange.selectNodeContents(line);
    sel.removeAllRanges();
    sel.addRange(lineRange);
  }

  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.className = 'te-bar';
  span.style.setProperty('--te-bar-color', color);
  try {
    span.appendChild(range.extractContents());
    range.insertNode(span);
  } catch {
    return;
  }
  sel.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(span);
  sel.addRange(next);
}

/** 선택 영역이 속한 세로선 span */
export function barAtSelection(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains('te-bar')) {
      return node as HTMLElement;
    }
    node = node.parentNode;
  }
  return null;
}

export function removeBar(root: HTMLElement): void {
  const bar = barAtSelection(root);
  if (!bar) return;
  const parent = bar.parentNode;
  if (!parent) return;
  while (bar.firstChild) parent.insertBefore(bar.firstChild, bar);
  parent.removeChild(bar);
  root.normalize();
}

/** 장식용 구분선을 넣는다 (페이지 나눔과 무관). */
export function insertDivider(
  root: HTMLElement,
  look: { color: string; width: number; style: string },
): void {
  restoreSelection(root);
  const rule = document.createElement('div');
  rule.className = 'te-rule';
  rule.dataset.teRule = 'true';
  rule.contentEditable = 'false';
  rule.style.setProperty('--r-color', look.color);
  rule.style.setProperty('--r-width', `${look.width}px`);
  rule.style.setProperty('--r-style', look.style);

  const sel = window.getSelection();
  let line: Node | null = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null;
  while (line && line.parentNode !== root) line = line.parentNode;

  if (line) root.insertBefore(rule, line.nextSibling);
  else root.appendChild(rule);

  const after = document.createElement('div');
  after.appendChild(document.createElement('br'));
  root.insertBefore(after, rule.nextSibling);
}

/** 커서 자리에 페이지 나눔선을 넣는다. 저장할 때 이 선을 기준으로 쪼갠다. */
export function insertPageBreak(root: HTMLElement): void {
  const sel = window.getSelection();
  const breakEl = document.createElement('div');
  breakEl.className = 'te-pagebreak';
  breakEl.dataset.tePageBreak = 'true';
  breakEl.dataset.exportIgnore = 'true';
  breakEl.contentEditable = 'false';

  let line: Node | null = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null;
  while (line && line.parentNode !== root) line = line.parentNode;

  if (line) root.insertBefore(breakEl, line.nextSibling);
  else root.appendChild(breakEl);

  // 나눔선 뒤에 바로 쓸 수 있도록 빈 줄을 하나 붙여 둔다.
  const line2 = document.createElement('div');
  line2.appendChild(document.createElement('br'));
  root.insertBefore(line2, breakEl.nextSibling);
}

export function pageBreakCount(root: HTMLElement | null): number {
  return root ? root.querySelectorAll('[data-te-page-break]').length : 0;
}

/** 본문에 적용된 모든 인라인 서식을 벗겨낸다 (역할 span 은 유지). */
export function stripAllFormatting(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.te-rule').forEach((el) => el.remove());
  root.querySelectorAll<HTMLElement>('b, strong, i, em, u, s, strike, font, span.te-bar').forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  root.querySelectorAll<HTMLElement>('span[style]').forEach((el) => {
    if (el.dataset.teRole) return;
    el.removeAttribute('style');
  });
  root.normalize();
}

/** 선택 영역이 속한 역할을 알아낸다. 역할 span 밖이면 서술로 본다. */
export function selectionRole(root: HTMLElement | null): Role {
  if (!hasSelectionInside(root)) return 'narration';
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 'narration';

  let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const role = (node as HTMLElement).dataset.teRole;
      if (role) return role as Role;
    }
    node = node.parentNode;
  }
  return 'narration';
}

/** 선택된 텍스트 (캐릭터 이름 지정 등에 사용) */
export function selectionText(): string {
  return window.getSelection()?.toString().trim() ?? '';
}

/** 붙여넣기를 평문으로 강제한다 — 외부 서식이 따라 들어오는 것을 막는다. */
/** 에디터의 바로 아래 자식 = '줄'. 커서가 든 줄을 찾는다. */
function lineAt(root: HTMLElement, node: Node | null): HTMLElement | null {
  if (!node || node === root) return null;
  let current: Node | null = node;
  while (current && current.parentNode !== root) current = current.parentNode;
  if (!current) return null;

  /*
   * 줄 단위로 다루려면 요소여야 한다. 감싸지 않은 맨 위 글줄은 <div> 로 감싼다.
   * 맨 위에 덩그러니 놓인 <br> 도 마찬가지다 — 그건 줄이 아니라 '빈 줄 표시' 라,
   * 줄로 착각하고 글을 넣으면 <br> 안에 글자가 들어가 화면에서 사라진다.
   * (전체 지우기 뒤 브라우저가 남기는 <br> 에서 실제로 그랬다.)
   */
  const isLine = current.nodeType === Node.ELEMENT_NODE
    && (current as HTMLElement).tagName !== 'BR';
  if (isLine) return current as HTMLElement;

  const wrap = document.createElement('div');
  root.replaceChild(wrap, current);
  wrap.appendChild(current);
  return wrap;
}

function blankLine(): HTMLElement {
  const div = document.createElement('div');
  div.appendChild(document.createElement('br'));
  return div;
}

/** 빈 줄 표시용 <br> 하나만 있는 줄이면 비워, 글을 넣을 수 있게 만든다. */
function clearPlaceholder(line: HTMLElement): void {
  if (line.childNodes.length === 1 && line.firstChild?.nodeName === 'BR') line.textContent = '';
}

/**
 * 커서 자리에서 줄을 둘로 나눈다.
 *
 * 브라우저에게 맡기지 않는 이유: 메신저에서는 대사 span 이 block 이라 줄 안에
 * 블록이 들어앉는다. 그 상태에서 브라우저는 문단을 나누지 못하고 그냥 무시한다
 * (Enter 를 쳐도 아무 일이 없고, 여러 줄을 붙여넣으면 한 줄에 다 붙었다).
 */
export function splitLineAtCaret(root: HTMLElement): { head: HTMLElement; tail: HTMLElement } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  if (!range.collapsed) range.deleteContents();

  let line = lineAt(root, range.startContainer);

  /*
   * 커서가 줄 '사이'(에디터 자신)에 잡혀 있는 경우.
   * 곧장 빈 줄을 만들면 이미 있던 빈 줄이 뒤에 남아 줄이 하나 늘어난다 —
   * 옆 줄을 끌어와 그 줄 안에서 나눈다.
   */
  if (!line && range.startContainer === root) {
    const at = range.startOffset;
    const neighbour = root.childNodes[at] ?? root.childNodes[at - 1] ?? null;
    line = lineAt(root, neighbour);
    if (line) {
      range.setStart(line, 0);
      range.collapse(true);
    }
  }

  if (!line) {
    // 에디터가 아예 비어 있는 경우 — 빈 줄 두 개를 만들어 준다.
    const at = range.startContainer === root ? range.startOffset : root.childNodes.length;
    const head = blankLine();
    const tail = blankLine();
    const before = root.childNodes[at] ?? null;
    root.insertBefore(head, before);
    root.insertBefore(tail, before);
    return { head, tail };
  }

  const rest = document.createRange();
  rest.setStart(range.startContainer, range.startOffset);
  rest.setEndAfter(line.lastChild ?? line);
  const moved = rest.extractContents();

  const tail = document.createElement('div');
  if (moved.textContent) tail.appendChild(moved);
  else tail.appendChild(document.createElement('br'));
  root.insertBefore(tail, line.nextSibling);
  if (!line.textContent) line.innerHTML = '<br>';
  return { head: line, tail };
}

/** 커서를 그 줄의 이 글자 수 뒤에 놓는다. */
function placeCaret(line: HTMLElement, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const first = line.firstChild;
  if (first && first.nodeType === Node.TEXT_NODE) {
    range.setStart(first, Math.min(offset, (first as Text).data.length));
  } else {
    range.setStart(line, 0);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function insertPlainText(root: HTMLElement | null, text: string): void {
  const normalized = text.replace(/\r\n?/g, '\n');
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const parts = normalized.split('\n');
  if (parts.length === 1 || !root) {
    if (document.execCommand('insertText', false, normalized)) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(normalized));
    range.collapse(false);
    return;
  }

  // 여러 줄은 직접 쌓는다 (위 splitLineAtCaret 의 설명 참고)
  const split = splitLineAtCaret(root);
  if (!split) return;
  const { head, tail } = split;

  if (parts[0]) {
    clearPlaceholder(head);
    head.appendChild(document.createTextNode(parts[0]));
  }
  for (const part of parts.slice(1, -1)) {
    const line = document.createElement('div');
    if (part) line.textContent = part;
    else line.appendChild(document.createElement('br'));
    root.insertBefore(line, tail);
  }
  const last = parts[parts.length - 1];
  if (last) {
    clearPlaceholder(tail);
    tail.insertBefore(document.createTextNode(last), tail.firstChild);
  }
  placeCaret(tail, last.length);
}
