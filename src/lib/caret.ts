/**
 * contenteditable 내용을 다시 그려도 커서가 튀지 않도록 위치를 저장/복원한다.
 *
 * 글자 수 하나로만 재면 **빈 줄을 가리킬 수 없다** — 빈 줄은 글자가 0개라
 * 바로 앞 줄 끝과 위치가 똑같아지고, 복원할 때 앞 줄로 빨려 들어간다.
 * (말풍선 아래에 새 줄을 만들고 타이핑하면 글이 말풍선 안으로 들어가던 문제.)
 * 그래서 '몇 번째 줄인지' 와 '그 줄 안에서 몇 글자째인지' 를 함께 들고 있는다.
 */

export interface CaretPoint {
  /** 에디터 바로 아래 자식(= 줄) 의 차례. 줄을 못 찾으면 -1 */
  line: number;
  /** 그 줄 안에서 앞쪽 글자 수 */
  offset: number;
}

/**
 * 커서 자리. 드래그로 고른 영역이면 끝 자리(end)도 들고 있는다 — 다시 그린 뒤에도
 * 선택이 그대로 남아야 팝업에서 볼드·형광 등을 이어서 줄 수 있다.
 */
export interface CaretMark extends CaretPoint {
  end?: CaretPoint;
}

function walkTextNodes(root: Node): Text[] {
  if (root.nodeType === Node.TEXT_NODE) return [root as Text];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    out.push(node as Text);
    node = walker.nextNode();
  }
  return out;
}

/** 커서가 든 줄(root 의 바로 아래 자식)을 찾는다. */
function lineOf(root: HTMLElement, node: Node): Node | null {
  if (node === root) return null;
  let current: Node | null = node;
  while (current && current.parentNode !== root) current = current.parentNode;
  return current;
}

function measure(root: HTMLElement, container: Node, offset: number): CaretPoint {
  // 커서가 줄 사이(root 자신)에 있으면 그 자리의 줄 차례만 적어 둔다.
  if (container === root) {
    return { line: Math.min(offset, root.childNodes.length - 1), offset: 0 };
  }
  const line = lineOf(root, container);
  const probe = document.createRange();
  probe.selectNodeContents(line ?? root);
  probe.setEnd(container, offset);
  return {
    line: line ? Array.prototype.indexOf.call(root.childNodes, line) : -1,
    offset: probe.toString().length,
  };
}

export function saveCaret(root: HTMLElement): CaretMark | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;

  const mark: CaretMark = measure(root, range.startContainer, range.startOffset);
  if (!range.collapsed && root.contains(range.endContainer)) {
    mark.end = measure(root, range.endContainer, range.endOffset);
  }
  return mark;
}

/**
 * 저장해 둔 자리를 실제 노드 위치로 바꾼다.
 * 조각 경계에 걸리면 시작점은 뒤 조각의 머리로, 끝점은 앞 조각의 꼬리로 잡는다 —
 * 그래야 선택 영역이 옆 조각(다른 서식)까지 번지지 않는다.
 */
function resolve(root: HTMLElement, point: CaretPoint, isStart: boolean): [Node, number] {
  // 줄이 사라졌으면(내용이 줄어든 경우) 남아 있는 마지막 줄로 물러선다.
  const index = point.line < 0
    ? -1
    : Math.min(point.line, root.childNodes.length - 1);
  const scope: Node = index >= 0 ? root.childNodes[index] : root;

  let remaining = point.offset;
  const texts = walkTextNodes(scope);
  for (const node of texts) {
    if (remaining < node.data.length || (remaining === node.data.length && !isStart)) {
      return [node, remaining];
    }
    remaining -= node.data.length;
  }

  const last = texts[texts.length - 1];
  // 글자가 아예 없는 줄(빈 줄)이면 그 줄 안에 커서를 세운다.
  return last ? [last, last.data.length] : [scope, 0];
}

export function restoreCaret(root: HTMLElement, mark: CaretMark | null): void {
  if (!mark) return;
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  const [startNode, startOffset] = resolve(root, mark, Boolean(mark.end));
  range.setStart(startNode, startOffset);
  if (mark.end) {
    const [endNode, endOffset] = resolve(root, mark.end, false);
    range.setEnd(endNode, endOffset);
  } else {
    range.collapse(true);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}
