/**
 * 긴 글을 정해진 비율의 여러 장으로 나누기.
 *
 * 한 장의 높이는 결과물 너비 × 비율로 정해진다. 그 높이에서 제목·여백 같은 '매 장 붙는 몫'
 * 을 빼고 남은 자리에 줄(문단)을 차례로 채운다. 문단은 자르지 않는다 — 다음 장으로 넘긴다.
 * 손으로 넣은 페이지 나눔은 그대로 존중한다.
 *
 * 여기서 세우는 계획은 '어림' 이다 (문단 사이 간격 등). 실제로 저장할 때는 장마다 진짜로
 * 그려 보고 넘치는 마지막 문단을 다음 장으로 미룬다 (exporters 의 paginate).
 */
import type { SplitRatio } from '../types';

export const SPLIT_RATIOS: Array<{ value: SplitRatio; label: string }> = [
  { value: 'off', label: '나누지 않음' },
  { value: '1:1', label: '1:1 정사각형' },
  { value: '4:5', label: '4:5 세로' },
  { value: '3:4', label: '3:4 세로' },
  { value: '2:3', label: '2:3 세로' },
  { value: '9:16', label: '9:16 세로 (길쭉)' },
  { value: '4:3', label: '4:3 가로' },
  { value: '16:9', label: '16:9 가로' },
];

export function ratioOf(ratio: SplitRatio): [number, number] | null {
  if (ratio === 'off') return null;
  const [w, h] = ratio.split(':').map(Number);
  return w > 0 && h > 0 ? [w, h] : null;
}

export interface PagePlan {
  /** 한 장의 높이 (화면 px, 확대·축소와 무관) */
  pageHeight: number;
  /** 장마다 들어갈 줄(편집기의 바로 아래 자식) */
  groups: HTMLElement[][];
  /** 한 장보다 긴 문단이 있어 그 장만 길어지는 수 */
  oversized: number;
}

/** 매 장 붙는 몫(여백·제목·제작자 등)이 이보다 크면 글 놓을 자리가 거의 없다 */
const MIN_ROOM = 40;

/**
 * 나눌 계획을 세운다. 화면에 아무것도 남기지 않는다
 * (재는 동안만 높이 고정을 풀었다가 같은 흐름 안에서 되돌린다 — 그 사이에 그려지지 않는다).
 */
export function planPages(capture: HTMLElement, ratio: SplitRatio): PagePlan | null {
  const r = ratioOf(ratio);
  const editor = capture.querySelector<HTMLElement>('.editor');
  if (!r || !editor) return null;

  const previous = capture.style.minHeight;
  capture.style.minHeight = '0px';
  try {
    const pageHeight = Math.round((capture.offsetWidth * r[1]) / r[0]);
    /*
     * 3% 넉넉히 비운다. 저장할 때 넘치는 문단을 다음 장으로 미루는데, 그러다 장 수가
     * 어림보다 늘면 '파일 하나' 로 고른 저장 창에 두 장이 겹쳐 써진다. 어림을 살짝
     * 보수적으로 잡아 그런 일이 없게 한다.
     */
    const room = Math.max(MIN_ROOM, (pageHeight - (capture.offsetHeight - editor.offsetHeight)) * 0.97);

    // 확대·축소 중이면 화면 좌표가 배율만큼 커져 있다 — 원래 크기로 되돌려 잰다
    const editorBox = editor.getBoundingClientRect();
    const zoom = editor.offsetHeight ? editorBox.height / editor.offsetHeight : 1;
    const blocks = [...editor.children] as HTMLElement[];
    const tops = blocks.map((block) => (block.getBoundingClientRect().top - editorBox.top) / (zoom || 1));

    const groups: HTMLElement[][] = [[]];
    let used = 0;
    let oversized = 0;
    blocks.forEach((block, i) => {
      if (block.dataset.tePageBreak === 'true') {
        if (groups[groups.length - 1].length) groups.push([]);
        used = 0;
        return;
      }
      if (getComputedStyle(block).display === 'none') return;
      // 이 줄이 차지하는 높이 = 다음 줄의 시작까지 (문단 사이 간격 포함)
      const end = i + 1 < blocks.length ? tops[i + 1] : editor.offsetHeight;
      const height = Math.max(0, end - tops[i]);
      const current = groups[groups.length - 1];
      if (current.length && used + height > room) {
        groups.push([]);
        used = 0;
      }
      groups[groups.length - 1].push(block);
      used += height;
      if (height > room) oversized += 1;
    });
    const filled = groups.filter((group) => group.length > 0);
    return { pageHeight, groups: filled.length ? filled : [[]], oversized };
  } finally {
    capture.style.minHeight = previous;
  }
}
