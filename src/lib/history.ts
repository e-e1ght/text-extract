/**
 * 되돌리기 기록.
 *
 * 브라우저 기본 실행취소(Ctrl+Z)는 본문 글자만 되돌리고 사이드바 서식은 그대로 둔다.
 * 여기서는 본문 HTML 과 설정을 한 덩어리로 묶어 함께 되돌린다.
 */
import type { Settings } from '../types';

export interface Snapshot {
  html: string;
  settings: Settings;
}

const LIMIT = 60;

export class History {
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private current: Snapshot | null = null;

  /** 되돌리기로 복원하는 동안에는 기록을 남기지 않는다. */
  restoring = false;

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  reset(snapshot: Snapshot): void {
    this.past = [];
    this.future = [];
    this.current = snapshot;
  }

  push(snapshot: Snapshot): boolean {
    if (this.restoring) return false;
    if (this.current
      && this.current.html === snapshot.html
      && this.current.settings === snapshot.settings) {
      return false;
    }
    if (this.current) {
      this.past.push(this.current);
      if (this.past.length > LIMIT) this.past.shift();
    }
    this.current = snapshot;
    this.future = [];
    return true;
  }

  undo(): Snapshot | null {
    const previous = this.past.pop();
    if (!previous || !this.current) return null;
    this.future.push(this.current);
    this.current = previous;
    return previous;
  }

  redo(): Snapshot | null {
    const next = this.future.pop();
    if (!next || !this.current) return null;
    this.past.push(this.current);
    this.current = next;
    return next;
  }
}
