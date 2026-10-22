/**
 * 제목·부제목·제작자의 서식 있는 글.
 *
 * 글은 두 곳에서 고친다 — 사이드바 입력칸(글자만)과 미리보기(글자 + 서식).
 * 입력칸에서 글자를 고쳐도 미리보기에서 입힌 서식이 풀리지 않도록, 바뀐 부분만
 * 원래 HTML 의 글자 마디에 끼워 넣는다.
 */
import type { Meta } from '../types';

export type MetaField = 'title' | 'subtitle' | 'author';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 이 칸의 HTML — 미리보기에서 고친 적이 없으면 글자 그대로 */
export function metaHtml(meta: Meta, field: MetaField): string {
  return meta[`${field}Html`] ?? escapeHtml(meta[field]);
}

function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) out.push(node as Text);
  return out;
}

/**
 * 글자만 바뀌었을 때 서식을 지키며 HTML 을 고친다.
 * 앞뒤로 같은 부분은 그대로 두고, 가운데 바뀐 부분만 그 자리 글자 마디에서 바꾼다.
 * 새로 친 글자는 바로 앞 글자의 서식을 따른다 (문서 편집기에서 이어 칠 때처럼).
 */
export function retextHtml(html: string, next: string): string {
  const box = document.createElement('div');
  box.innerHTML = html;
  const prev = box.textContent ?? '';
  if (prev === next) return html;
  const nodes = textNodes(box);
  if (!nodes.length) return escapeHtml(next);

  let head = 0;
  while (head < prev.length && head < next.length && prev[head] === next[head]) head += 1;
  let tail = 0;
  while (tail < prev.length - head && tail < next.length - head
    && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1;
  const cutEnd = prev.length - tail;
  const insert = next.slice(head, next.length - tail);

  let offset = 0;
  let inserted = false;
  for (const node of nodes) {
    const text = node.data;
    const start = offset;
    const end = offset + text.length;
    offset = end;
    // 끝이 맞닿은 앞 마디에 넣는다 — 앞 글자의 서식을 따르도록
    const holdsHead = !inserted && head >= start && head <= end;
    const from = Math.max(head, start) - start;
    const to = Math.min(cutEnd, end) - start;
    if (holdsHead) {
      node.data = text.slice(0, from) + insert + text.slice(Math.max(from, to));
      inserted = true;
    } else if (to > from) {
      node.data = text.slice(0, from) + text.slice(to);
    }
  }
  // 비어 버린 서식 껍데기는 걷어 낸다
  textNodes(box).forEach((node) => { if (!node.data) node.remove(); });
  box.querySelectorAll('span, b, i, u, s, strike, strong, em, font').forEach((el) => {
    if (!el.textContent) el.remove();
  });
  return box.innerHTML;
}
