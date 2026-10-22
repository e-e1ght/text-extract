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

    // 대사·강조는 '대사 기울임' 설정 때문에 제 font-style 을 갖는다 — 이탤릭도 변수로 물려준다
    const italic = el.style.fontStyle;
    if (italic) el.style.setProperty('--te-italic', italic);
    else el.style.removeProperty('--te-italic');

    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
}

export function toggleInline(command: InlineCommand, root?: HTMLElement): void {
  setCssStyling(true);
  document.execCommand(command);
  if (root) syncInlineVars(root);
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
/**
 * 바꿔 끼운 요소들을 다시 선택한다.
 * 선택이 바꿔 끼우기 전 요소(<font> 등)에 걸려 있으면 그 요소가 빠질 때 선택도 풀려,
 * 드래그 팝업이 닫혀 버린다 — 이어서 다른 서식을 줄 수 있게 새 요소를 고른다.
 */
function selectReplaced(elements: HTMLElement[]): void {
  if (elements.length === 0) return;
  const first = elements[0];
  const last = elements[elements.length - 1];
  const range = document.createRange();
  range.setStart(first, 0);
  range.setEnd(last, last.childNodes.length);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  remembered = range.cloneRange();
}

export function applyFontSize(root: HTMLElement, px: number): void {
  setCssStyling(false);
  document.execCommand('fontSize', false, FONT_SIZE_SENTINEL);

  const replaced: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>(`font[size="${FONT_SIZE_SENTINEL}"]`).forEach((fontEl) => {
    const span = document.createElement('span');
    span.style.fontSize = `${px}px`;
    while (fontEl.firstChild) span.appendChild(fontEl.firstChild);
    fontEl.parentNode?.replaceChild(span, fontEl);
    replaced.push(span);
  });
  selectReplaced(replaced);

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
  const replaced: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>('font[face]').forEach((fontEl) => {
    const span = document.createElement('span');
    span.style.fontFamily = fontEl.getAttribute('face') ?? family;
    while (fontEl.firstChild) span.appendChild(fontEl.firstChild);
    fontEl.parentNode?.replaceChild(span, fontEl);
    replaced.push(span);
  });
  selectReplaced(replaced);
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
 * 드래그한 글을 말풍선 또는 대본 줄로 바꾼다.
 *
 * 둘은 겉모양만 다르고 얼개가 같다 — 겉을 감싸는 상자 + 이름표 + 본문.
 * 겉모양은 여기서 정하지 않는다. `data-te-speaker` 만 달아 두면 캐릭터별 색이
 * CSS 로 걸린다. 색을 요소에 박아 두면 나중에 캐릭터 색을 바꿔도 따라오지 않는다.
 *
 * 이름표에는 `data-te-label` 을 단다. 우리가 붙인 표지지 사용자가 쓴 글이 아니므로,
 * 본문을 평문으로 읽거나 역할을 다시 인식할 때 건너뛰어야 한다.
 * (그러지 않으면 `세인: 세인"대사"` 처럼 이름이 두 번 읽혀 인식이 어긋난다.)
 */
export type BlockKind = 'bubble' | 'script';

const BLOCK_CLASS: Record<BlockKind, string> = { bubble: 'te-bubble', script: 'te-script' };

function wrapSelection(kind: BlockKind, speaker: string, registered: boolean): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);

  const wrap = document.createElement('div');
  wrap.className = BLOCK_CLASS[kind];
  if (speaker) wrap.dataset.teSpeaker = speaker;

  if (registered && speaker) {
    const name = document.createElement('span');
    name.className = `${BLOCK_CLASS[kind]}-name`;
    name.dataset.teLabel = 'true';
    name.contentEditable = 'false';
    name.textContent = speaker;
    wrap.appendChild(name);
  }

  const body = document.createElement('span');
  body.className = `${BLOCK_CLASS[kind]}-text`;
  try {
    body.appendChild(range.extractContents());
  } catch {
    return;
  }
  wrap.appendChild(body);
  range.insertNode(wrap);

  sel.removeAllRanges();
  const next = document.createRange();
  next.selectNodeContents(body);
  sel.addRange(next);
}

export function applyBubble(speaker: string, registered: boolean): void {
  wrapSelection('bubble', speaker, registered);
}

export function applyScript(speaker: string, registered: boolean): void {
  wrapSelection('script', speaker, registered);
}

/** 커서가 든 말풍선/대본 상자. kind 를 주면 그 종류만 찾는다. */
export function blockAtSelection(root: HTMLElement | null, kind?: BlockKind): HTMLElement | null {
  if (!root) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const wanted = kind ? [BLOCK_CLASS[kind]] : Object.values(BLOCK_CLASS);
  let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (wanted.some((name) => el.classList.contains(name))) return el;
    }
    node = node.parentNode;
  }
  return null;
}

/** 상자를 풀고, 남은 글을 담은 요소를 돌려준다 (인물을 바꿔 다시 감쌀 때 쓴다). */
export function removeBlock(root: HTMLElement, kind?: BlockKind): HTMLElement | null {
  const block = blockAtSelection(root, kind);
  if (!block) return null;
  const parent = block.parentNode;
  if (!parent) return null;
  block.querySelector('[data-te-label]')?.remove();
  const body = block.querySelector('[class$="-text"]');
  const line = document.createElement('span');
  while (body?.firstChild) line.appendChild(body.firstChild);
  parent.replaceChild(line, block);
  selectReplaced([line]);
  return line;
}

export function removeFormatting(root: HTMLElement): void {
  document.execCommand('removeFormat');
  root.querySelectorAll<HTMLElement>('span[style]').forEach((el) => {
    if (el.dataset.teRole) return;
    el.style.removeProperty('--te-ink');
    el.style.removeProperty('--te-size');
    el.style.removeProperty('--te-italic');
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

export type RedactKind = 'bar' | 'blur';

/** 선택 범위에 걸친 글자 조각(텍스트 노드)들. 경계에 걸친 것은 잘라서 범위 안쪽만 남긴다 */
function textNodesInRange(root: HTMLElement, range: Range): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // 말풍선·대본의 이름표는 우리가 붙인 표지라 가리지 않는다
      if ((node.parentElement as HTMLElement | null)?.closest('[data-te-label]')) return NodeFilter.FILTER_REJECT;
      return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);

  return nodes.map((node) => {
    let text = node;
    if (text === range.endContainer && range.endOffset < text.length) text.splitText(range.endOffset);
    if (text === range.startContainer && range.startOffset > 0) text = text.splitText(range.startOffset);
    return text;
  }).filter((text) => text.data.length > 0);
}

/** 선택 범위를 덮는 가리기 조각들 */
function redactionsInRange(root: HTMLElement, range: Range): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('.te-redact')].filter((el) => range.intersectsNode(el));
}

/**
 * 고른 글을 가린다 — 검은 막대 또는 흐림.
 *
 * 글을 지우지 않고 덮기만 하므로 언제든 풀 수 있다. 여러 줄·말풍선에 걸쳐 골라도 되도록
 * 글자 조각마다 따로 감싼다 (한 덩어리로 감싸면 줄(div)이 글자 상자(span) 안에 들어가 깨진다).
 */
export function applyRedaction(root: HTMLElement, kind: RedactKind): void {
  restoreSelection(root);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return;

  // 이미 가린 곳이면 방식만 바꾼다
  const existing = redactionsInRange(root, range);
  existing.forEach((el) => { el.dataset.teRedact = kind; });

  const wrapped: HTMLElement[] = [...existing];
  for (const text of textNodesInRange(root, range)) {
    if ((text.parentElement as HTMLElement | null)?.closest('.te-redact')) continue;
    const span = document.createElement('span');
    span.className = 'te-redact';
    span.dataset.teRedact = kind;
    text.parentNode?.insertBefore(span, text);
    span.appendChild(text);
    wrapped.push(span);
  }
  if (wrapped.length === 0) return;

  const next = document.createRange();
  next.setStartBefore(wrapped[0]);
  next.setEndAfter(wrapped[wrapped.length - 1]);
  sel.removeAllRanges();
  sel.addRange(next);
  rememberSelection(root);
  root.dispatchEvent(new Event('input', { bubbles: true }));
}

/** 선택 범위에 걸친 가리기를 모두 푼다 */
export function removeRedaction(root: HTMLElement): void {
  restoreSelection(root);
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const targets = redactionsInRange(root, sel.getRangeAt(0));
  targets.forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  if (targets.length === 0) return;
  root.normalize();
  root.dispatchEvent(new Event('input', { bubbles: true }));
}

/** 선택 범위에 가린 곳이 있는지, 있으면 어떤 방식인지 */
export function redactionAtSelection(root: HTMLElement | null): RedactKind | null {
  if (!root) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const found = redactionsInRange(root, sel.getRangeAt(0))[0];
  return found ? (found.dataset.teRedact as RedactKind) : null;
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
  // 테두리와 같은 여섯 모양 — 실선·겹선이 아닌 것은 CSS 가 data-style 을 보고 무늬로 그린다.
  // --r-style 은 예전 구분선과 같은 방식으로도 읽히게 남긴다 (CSS border-style 로 쓸 수 있는 값만).
  rule.style.setProperty('--r-style', look.style === 'longdash' || look.style === 'dashdot' ? 'dashed' : look.style);
  rule.dataset.style = look.style;

  const sel = window.getSelection();
  let line: Node | null = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null;
  while (line && line.parentNode !== root) line = line.parentNode;

  if (line) root.insertBefore(rule, line.nextSibling);
  else root.appendChild(rule);

  const after = document.createElement('div');
  after.appendChild(document.createElement('br'));
  root.insertBefore(after, rule.nextSibling);
  afterInsertedLine(root, after);
}

/**
 * 구분선·나눔선을 넣은 뒤 마무리.
 *  - 커서를 새 빈 줄로 옮긴다. 그래야 이어서 하나 더 넣을 때 앞의 것 아래로 쌓인다
 *    (예전에는 같은 자리에 넣어 먼저 넣은 선 앞에 끼어들었다).
 *  - input 이벤트로 에디터에 알린다. 이걸 빠뜨리면 저장된 본문에 선이 빠져,
 *    새로고침하거나 에디터를 다시 그릴 때 나중에 넣은 선이 사라졌다.
 */
function afterInsertedLine(root: HTMLElement, line: HTMLElement): void {
  const caret = document.createRange();
  caret.setStart(line, 0);
  caret.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(caret);
  remembered = caret.cloneRange();
  root.dispatchEvent(new Event('input', { bubbles: true }));
}

/** 커서 자리에 페이지 나눔선을 넣는다. 저장할 때 이 선을 기준으로 쪼갠다. */
export function insertPageBreak(root: HTMLElement): void {
  restoreSelection(root);
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
  afterInsertedLine(root, line2);
}

export function pageBreakCount(root: HTMLElement | null): number {
  return root ? root.querySelectorAll('[data-te-page-break]').length : 0;
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
 * 브라우저에게 맡기지 않는 이유: 말풍선은 div 라 줄 안에 블록이 들어앉는다.
 * 그 상태에서 브라우저는 문단을 나누지 못하고 그냥 무시한다
 * (여러 줄을 붙여넣으면 한 줄에 다 붙었다).
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

/**
 * 괄호(곁말)·별표(강조) 안에서 줄을 바꿀 때, 두 줄 모두 서식이 남게 한다.
 *
 * 곁말·강조는 '같은 줄에서 닫힐 때만' 인정하므로, 그 안에서 줄을 바꾸면 양쪽 다
 * 짝을 잃어 서식이 풀렸다(괄호는 짝 잃은 기호로 보고 지워지기까지 했다).
 * 그래서 커서 자리에서 윗줄을 닫는 기호로 닫고, 아랫줄을 여는 기호로 다시 연다.
 * 기호를 감춰 둔 때에만 한다 — 보이는 상태라면 글이 바뀌니까.
 *
 * 줄 나누기는 브라우저에 맡기지 않고 직접 한다. 감춘(display:none) 기호 옆에서
 * 브라우저가 줄을 나누면 커서를 '보이는 자리' 로 옮겨 버려 기호가 엉뚱한 줄로 간다.
 * 커서 뒤 내용을 서식째 잘라(extractContents) 새 줄로 옮긴다.
 *
 * lineBreak 면 새 줄(div) 대신 같은 줄 안에 <br> 을 넣는다 (Shift+Enter).
 * 나눴으면 true — 브라우저의 줄바꿈은 막아야 한다.
 */
export function splitLineKeepingMarks(root: HTMLElement, lineBreak: boolean): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed || !root.contains(range.startContainer)) return false;

  let line: Node = range.startContainer;
  while (line.parentNode && line.parentNode !== root) line = line.parentNode;
  if (line === root || line.nodeType !== Node.ELEMENT_NODE) return false;
  const lineEl = line as HTMLElement;

  const capture = root.closest('.te-capture');
  const groups: Array<{ selector: string; hidden: boolean }> = [
    { selector: '.te-paren-mark', hidden: Boolean(capture?.matches('.paren-aside:not(.roles-off)')) },
    { selector: '.te-mark', hidden: Boolean(capture?.matches('.hide-marks')) },
  ];

  for (const { selector, hidden } of groups) {
    if (!hidden) continue;
    // 기호는 한 줄 안에서 언제나 여는 것·닫는 것 차례로 짝지어 있다.
    const marks = Array.from(lineEl.querySelectorAll<HTMLElement>(selector));
    for (let i = 0; i + 1 < marks.length; i += 2) {
      const open = marks[i];
      const close = marks[i + 1];
      // 커서가 여는 기호 뒤, 닫는 기호 앞에 있어야 '안' 이다.
      if (range.comparePoint(open, 0) >= 0 || range.comparePoint(close, 0) < 0) continue;

      // 커서 앞이나 뒤에 글이 없으면 그냥 바꿔도 짝이 깨지지 않는다 — 빈 묶음을 만들지 않는다.
      const head = document.createRange();
      head.setStartAfter(open);
      head.setEnd(range.startContainer, range.startOffset);
      const tail = document.createRange();
      tail.setStart(range.startContainer, range.startOffset);
      tail.setEndBefore(close);
      if (!head.toString() || !tail.toString()) return false;

      // 원래 기호를 복제해 처음부터 감춘 기호로 넣는다.
      const closer = close.cloneNode(true);
      const opener = open.cloneNode(true);
      range.insertNode(closer);

      const rest = document.createRange();
      rest.setStartAfter(closer);
      rest.setEnd(lineEl, lineEl.childNodes.length);
      const moved = rest.extractContents();

      if (lineBreak) {
        lineEl.appendChild(document.createElement('br'));
        lineEl.appendChild(opener);
        lineEl.appendChild(moved);
      } else {
        const next = document.createElement(lineEl.tagName);
        next.appendChild(opener);
        next.appendChild(moved);
        root.insertBefore(next, lineEl.nextSibling);
      }

      const caret = document.createRange();
      caret.setStartAfter(opener);
      caret.collapse(true);
      sel.removeAllRanges();
      sel.addRange(caret);
      remembered = caret.cloneRange();
      return true;
    }
  }
  return false;
}

/** 화면에서 감춰진 기호(*, 괄호)인지 — 감춤 여부는 설정에 따라 달라지므로 실제 표시로 본다. */
function isHiddenMark(node: Node): boolean {
  const mark = (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement)
    ?.closest('.te-mark, .te-paren-mark');
  return Boolean(mark && getComputedStyle(mark).display === 'none');
}

/** 줄 안의 글자 노드 (이름표처럼 우리가 붙인 표지는 뺀다) */
function lineTexts(line: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node.parentElement?.closest('[data-te-label]'))) out.push(node as Text);
  }
  return out;
}

/** 줄 끝(atEnd)이나 머리에 붙은 감춘 기호 요소. 보이는 글이 먼저 나오면 null. */
function edgeMark(line: Node, atEnd: boolean): HTMLElement | null {
  const texts = lineTexts(line).filter((t) => t.data.length > 0);
  const node = atEnd ? texts[texts.length - 1] : texts[0];
  if (!node || !isHiddenMark(node)) return null;
  return node.parentElement?.closest<HTMLElement>('.te-mark, .te-paren-mark') ?? null;
}

/**
 * 줄 머리에서 Backspace, 줄 끝에서 Delete 로 두 줄을 합칠 때 서식이 풀리지 않게 한다.
 *
 * 브라우저에 맡기면 줄을 합치면서 감춘 기호까지 지워, 괄호·별표 짝이 깨져 서식이 풀렸다.
 * (줄 가운데서 지울 때는 브라우저가 감춘 기호를 알아서 건너뛰므로 손대지 않는다.)
 * 직접 합치되, 줄을 나눌 때 넣은 기호 짝(윗줄 끝 닫는 기호 + 아랫줄 머리 여는 기호)이면
 * 둘 다 빼서 원래 하나였던 묶음으로 되돌린다. 합쳤으면 true — 브라우저 동작은 막아야 한다.
 */
export function joinLinesKeepingMarks(root: HTMLElement, forward: boolean): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed || !root.contains(range.startContainer)) return false;

  let line: Node = range.startContainer;
  while (line.parentNode && line.parentNode !== root) line = line.parentNode;
  if (line === root || line.nodeType !== Node.ELEMENT_NODE) return false;

  // 커서와 줄 머리(끝) 사이에 보이는 글이 없어야 '줄 경계에서 지우기' 다.
  const between = document.createRange();
  between.selectNodeContents(line);
  if (forward) between.setStart(range.startContainer, range.startOffset);
  else between.setEnd(range.startContainer, range.startOffset);
  const visible = lineTexts(line).some((t) => !isHiddenMark(t) && between.intersectsNode(t)
    && (t === range.startContainer
      ? (forward ? t.data.length > range.startOffset : range.startOffset > 0)
      : t.data.length > 0));
  if (visible) return false;

  const upper = (forward ? line : line.previousSibling) as HTMLElement | null;
  const lower = (forward ? line.nextSibling : line) as HTMLElement | null;
  if (!upper || !lower || upper.nodeType !== Node.ELEMENT_NODE || lower.nodeType !== Node.ELEMENT_NODE) return false;
  // 구분선·나눔선·이미지 줄은 브라우저에 맡긴다.
  if (!upper.isContentEditable || !lower.isContentEditable) return false;
  // 감춘 기호가 끼어 있지 않으면 브라우저 동작으로 충분하다.
  const closer = edgeMark(upper, true);
  const opener = edgeMark(lower, false);
  if (!closer && !opener) return false;

  if (closer && opener && closer.className === opener.className) {
    const pair = closer.classList.contains('te-paren-mark')
      ? /^[)）]$/.test(closer.textContent ?? '') && /^[(（]$/.test(opener.textContent ?? '')
      : closer.textContent === opener.textContent;
    if (pair) {
      closer.remove();
      opener.remove();
    }
  }

  // 빈 줄의 <br> 은 합치면 군더더기다.
  upper.querySelectorAll(':scope > br:last-child').forEach((br) => br.remove());
  const joint = document.createRange();
  joint.selectNodeContents(upper);
  joint.collapse(false);
  const firstMoved = lower.firstChild;
  while (lower.firstChild) upper.appendChild(lower.firstChild);
  lower.remove();
  if (firstMoved && firstMoved.parentNode === upper) joint.setStartBefore(firstMoved);
  joint.collapse(true);
  sel.removeAllRanges();
  sel.addRange(joint);
  remembered = joint.cloneRange();
  return true;
}
