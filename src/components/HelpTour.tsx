import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconClose } from './icons';

/**
 * 도움말 — 상단 '?' 단추를 눌렀을 때만 뜨는 기능 안내.
 *
 * 처음 들어왔을 때 저절로 띄우지 않는다. 글을 붙여 넣으러 온 사람 앞을 막아서기 때문이다.
 * 가리킬 곳은 `data-tour` 표지로 찾는다 — 클래스 이름은 꾸미다 보면 바뀌기 쉽다.
 */
interface Step {
  /** 쉼표로 여러 곳을 적으면 그 전체를 둘러싼 칸을 가리킨다 (되돌리기 + 다시 실행) */
  target: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: '[data-tour="preview"]',
    title: '본문 넣기',
    body: '여기에 글을 붙여 넣거나 바로 입력하세요. "대사", *강조*, 이름: 을 알아서 구분해 색을 입힙니다. 작업은 자동으로 저장됩니다.',
  },
  {
    target: '[data-tour="rail-meta"]',
    title: '제목 · 제작자',
    body: '제목·부제목·제작자를 넣고, 본문 위와 아래 중 어디에 둘지 고릅니다.',
  },
  {
    target: '[data-tour="rail-text"]',
    title: '본문',
    body: '글꼴·크기·자간·행간처럼 본문 전체의 모양을 정합니다. 내 글꼴 파일도 올릴 수 있습니다.',
  },
  {
    target: '[data-tour="rail-color"]',
    title: '대사 · 서술',
    body: '대사 자동 구분을 켜고 끄고, * 기호 감추기·괄호 안 작게 같은 모양을 고릅니다.',
  },
  {
    target: '[data-tour="rail-bubble"]',
    title: '말풍선 · 캐릭터',
    body: '본문에서 찾은 캐릭터마다 이름·대사·말풍선 색과 프로필 사진을 정합니다. 아이콘에 점이 뜨면 캐릭터를 찾은 것입니다.',
  },
  {
    target: '[data-tour="rail-background"]',
    title: '이미지',
    body: '배경(단색·그라데이션·사진·패턴·아스키 아트)과 스티커, 본문 속 이미지를 넣습니다. 배경은 미리보기에서 끌어 옮기고 휠로 크기를 바꿉니다.',
  },
  {
    target: '[data-tour="rail-layout"]',
    title: '내지 옵션',
    body: '여백, 결과물 너비와 비율, 페이지 테두리를 정합니다. 긴 글을 같은 비율의 여러 장으로 나누는 것도 여기서 합니다.',
  },
  {
    target: '[data-tour="rail-export"]',
    title: '저장 · 설정',
    body: '이미지(PNG·JPG)나 PDF 로 저장하고, 클립보드로 복사합니다. 서식 저장·불러오기와 초기화도 여기 있습니다.',
  },
  {
    target: '.edit-launcher',
    title: '편집 패널',
    body: '본문에서 글자를 드래그해 고른 뒤 이 단추로 패널을 여세요. 고른 부분만 굵게·색·크기를 바꾸거나 말풍선으로 묶고, 가릴 수 있습니다.',
  },
  {
    target: '[data-tour="undo"], [data-tour="redo"]',
    title: '되돌리기',
    body: '본문과 서식을 함께 되돌립니다. Ctrl+Z / Ctrl+Shift+Z 로도 됩니다.',
  },
  {
    target: '.zoom-bar',
    title: '확대 · 축소',
    body: '미리보기만 키우고 줄입니다. 저장되는 크기와는 상관없습니다.',
  },
  {
    target: '[data-tour="help"]',
    title: '도움말',
    body: '이 안내는 언제든 여기서 다시 볼 수 있습니다.',
  },
];

const GAP = 10;      // 가리킨 곳과 안내창 사이
const MARGIN = 8;    // 안내창이 화면 끝에 붙지 않게
const PAD = 4;       // 가리킨 곳 둘레의 여유
const EDGE = 2;      // 화면 끝에 붙은 곳(레일·상단 막대)도 테두리가 잘리지 않게

interface Box { top: number; left: number; width: number; height: number }

/** 가리킬 곳 전체를 둘러싼 칸. 화면 밖으로 나간 부분은 잘라 낸다 (긴 미리보기). */
function measure(selector: string): Box | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .filter((node) => node.offsetParent !== null || getComputedStyle(node).position === 'fixed');
  if (nodes.length === 0) return null;
  let top = Infinity; let left = Infinity; let right = -Infinity; let bottom = -Infinity;
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }
  top = Math.max(top - PAD, EDGE);
  left = Math.max(left - PAD, EDGE);
  right = Math.min(right + PAD, window.innerWidth - EDGE);
  bottom = Math.min(bottom + PAD, window.innerHeight - EDGE);
  return { top, left, width: right - left, height: bottom - top };
}

/** 오른쪽 → 왼쪽 → 아래 → 위 차례로 안내창이 다 들어가는 자리를 찾는다. */
function place(target: Box | null, card: { width: number; height: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), vw - card.width - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(y, MARGIN), vh - card.height - MARGIN);
  if (!target) return { left: clampX((vw - card.width) / 2), top: clampY((vh - card.height) / 2) };

  const right = target.left + target.width + GAP;
  const left = target.left - GAP - card.width;
  const below = target.top + target.height + GAP;
  const above = target.top - GAP - card.height;
  const midY = clampY(target.top + target.height / 2 - card.height / 2);
  const midX = clampX(target.left + target.width / 2 - card.width / 2);

  if (right + card.width <= vw - MARGIN) return { left: right, top: midY };
  if (left >= MARGIN) return { left, top: midY };
  if (below + card.height <= vh - MARGIN) return { left: midX, top: below };
  if (above >= MARGIN) return { left: midX, top: above };
  // 들어갈 곳이 없으면 (화면을 다 덮는 미리보기) 화면 아래쪽에 겹쳐 띄운다
  return { left: clampX((vw - card.width) / 2), top: vh - card.height - MARGIN * 3 };
}

export function HelpTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<Box | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const relayout = useCallback(() => {
    const box = measure(step.target);
    setTarget(box);
    const card = cardRef.current;
    if (card) setPos(place(box, { width: card.offsetWidth, height: card.offsetHeight }));
  }, [step.target]);

  useLayoutEffect(() => { relayout(); }, [relayout, index]);

  useEffect(() => {
    window.addEventListener('resize', relayout);
    // 작업 영역은 안쪽에서 스크롤된다 — 어디서 굴러도 다시 잰다
    window.addEventListener('scroll', relayout, true);
    return () => {
      window.removeEventListener('resize', relayout);
      window.removeEventListener('scroll', relayout, true);
    };
  }, [relayout]);

  useEffect(() => { nextRef.current?.focus(); }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, STEPS.length - 1));
      else if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tour" data-export-ignore="true">
      {/* 안내하는 동안 뒤의 화면은 눌리지 않게 덮는다 */}
      <div className="tour-block" />
      {target ? (
        <div
          className="tour-spot"
          style={{ top: target.top, left: target.left, width: target.width, height: target.height }}
        />
      ) : <div className="tour-dim" />}

      <div
        ref={cardRef}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      >
        <div className="tour-head">
          <span className="tour-count">{index + 1} / {STEPS.length}</span>
          <button type="button" className="tour-close" title="도움말 닫기 (Esc)" onClick={onClose}>
            <IconClose size={12} />
          </button>
        </div>
        <h3 id="tour-title" className="tour-title">{step.title}</h3>
        <p className="tour-body">{step.body}</p>
        <div className="tour-foot">
          <button
            type="button"
            className="tour-btn"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            이전
          </button>
          <button
            ref={nextRef}
            type="button"
            className="tour-btn is-primary"
            onClick={() => (last ? onClose() : setIndex((i) => i + 1))}
          >
            {last ? '끝' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
