/**
 * 최근에 쓴 색 (최대 5개).
 *
 * 글자색·하이라이트·세로선·패널 색 칸이 모두 한 목록을 함께 쓴다. 서식이 아니라
 * 작업 환경이라 설정(서식 파일)에 넣지 않고 이 브라우저에만 둔다.
 */
import { useEffect, useState } from 'react';

const KEY = 'text-extract:recent-colors:v1';
const LIMIT = 5;
const EVENT = 'text-extract:recent-colors';

function read(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string').slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

/** #abc → #aabbcc, 대문자 → 소문자. 같은 색이 두 번 들어가지 않게 한다. */
function normalize(color: string): string | null {
  const value = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return null;
}

let pending: string | null = null;
let timer: number | undefined;

/**
 * 쓴 색을 기록한다.
 * 색 고르기 창은 끌어 움직이는 동안 값이 계속 바뀌므로, 손을 멈춘 뒤의 마지막 색만 남긴다.
 */
export function rememberColor(color: string): void {
  const value = normalize(color);
  if (!value) return;
  pending = value;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (!pending) return;
    const next = [pending, ...read().filter((c) => c !== pending)].slice(0, LIMIT);
    pending = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* 저장 공간 없음 — 이번 창에서만 쓴다 */
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }, 500);
}

export function useRecentColors(): string[] {
  const [colors, setColors] = useState<string[]>(read);
  useEffect(() => {
    const onChange = (event: Event) => setColors((event as CustomEvent<string[]>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return colors;
}
