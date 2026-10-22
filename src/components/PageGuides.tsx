import { useEffect, useRef, useState } from 'react';
import { planPages } from '../lib/split';
import type { SplitRatio } from '../types';

export interface PlanSummary {
  pages: number;
  oversized: number;
  /** 2장째부터, 각 장이 시작하는 높이 (결과물 기준 px) */
  cuts: number[];
}

/**
 * 나눌 계획을 늘 최신으로 들고 있는다.
 * 글을 고치거나(편집기 크기가 바뀜) 설정이 바뀌면 다시 잰다. `version` 에 설정 객체를
 * 넘기면 설정이 바뀔 때마다 새로 잰다.
 */
export function usePagePlan(capture: HTMLElement | null, ratio: SplitRatio, version: unknown): PlanSummary | null {
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    if (!capture || ratio === 'off') {
      setSummary(null);
      return undefined;
    }
    const editor = capture.querySelector<HTMLElement>('.editor');
    const measure = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const plan = planPages(capture, ratio);
        if (!plan) { setSummary(null); return; }
        const box = capture.getBoundingClientRect();
        const zoom = capture.offsetWidth ? box.width / capture.offsetWidth : 1;
        const cuts = plan.groups.slice(1)
          .map((group) => group[0])
          .filter(Boolean)
          .map((block) => Math.round((block.getBoundingClientRect().top - box.top) / (zoom || 1)));
        setSummary({ pages: plan.groups.length, oversized: plan.oversized, cuts });
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (editor) observer.observe(editor);
    observer.observe(capture);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [capture, ratio, version]);

  return summary;
}

/** 미리보기 위에 '여기서 다음 장' 을 점선으로 보여 준다. 저장한 그림에는 담기지 않는다 */
export function PageGuides({ cuts }: { cuts: number[] }) {
  if (cuts.length === 0) return null;
  return (
    <div className="page-guides" data-export-ignore="true" aria-hidden="true">
      {cuts.map((top, i) => (
        <div key={i} className="page-guide" style={{ top: top - 6 }}>
          <span>{i + 2}장</span>
        </div>
      ))}
    </div>
  );
}
