/**
 * contenteditable 내용을 다시 그려도 커서가 튀지 않도록,
 * 루트 기준 "앞쪽 텍스트 글자 수"로 커서 위치를 저장/복원한다.
 */

function walkTextNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    out.push(node as Text);
    node = walker.nextNode();
  }
  return out;
}

export function saveCaret(root: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;

  const probe = range.cloneRange();
  probe.selectNodeContents(root);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().length;
}

export function restoreCaret(root: HTMLElement, offset: number | null): void {
  if (offset === null) return;
  const sel = window.getSelection();
  if (!sel) return;

  let remaining = offset;
  for (const node of walkTextNodes(root)) {
    const len = node.data.length;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= len;
  }

  // 텍스트가 없거나 offset 이 끝을 넘어선 경우 — 맨 끝으로 보낸다.
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
