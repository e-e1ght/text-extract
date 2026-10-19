import { DEFAULT_SETTINGS } from '../defaults';
import { mergeSettings } from '../store';
import type { PresetFile, Settings } from '../types';

const SLOT_KEY = 'text-extract:presets:v1';

export interface PresetSlot {
  name: string;
  savedAt: string;
  settings: Settings;
}

export function loadSlots(): PresetSlot[] {
  try {
    const raw = localStorage.getItem(SLOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PresetSlot[]) : [];
  } catch {
    return [];
  }
}

function writeSlots(slots: PresetSlot[]): void {
  try {
    localStorage.setItem(SLOT_KEY, JSON.stringify(slots));
  } catch {
    /* 저장 공간 없음 */
  }
}

export function saveSlot(name: string, settings: Settings): PresetSlot[] {
  const trimmed = name.trim();
  if (!trimmed) return loadSlots();
  const slots = loadSlots().filter((slot) => slot.name !== trimmed);
  slots.unshift({ name: trimmed, savedAt: new Date().toISOString(), settings });
  writeSlots(slots);
  return slots;
}

export function deleteSlot(name: string): PresetSlot[] {
  const slots = loadSlots().filter((slot) => slot.name !== name);
  writeSlots(slots);
  return slots;
}

/**
 * 서식 파일을 내려받는다. 저장했으면 true, 사용자가 저장 창을 닫았으면 false.
 *
 * 저장 창을 띄울 수 있는 브라우저(크롬·엣지)에서는 그 창으로 받는다 — 위치를 직접
 * 고르니 '눌렀는데 아무 일도 없다' 가 생기지 않는다. 그 밖에서는 링크로 내려받는데,
 * JSON 형식이면 사파리 등이 파일을 받지 않고 화면에 열어 버려서 일반 파일 형식으로 넘긴다.
 */
export async function downloadPreset(name: string, settings: Settings): Promise<boolean> {
  const payload: PresetFile = {
    kind: 'text-extract-preset',
    version: 1,
    savedAt: new Date().toISOString(),
    name: name.trim() || '서식',
    settings,
  };
  const json = JSON.stringify(payload, null, 2);
  const fileName = `${payload.name.replace(/[\\/:*?"<>|]/g, '_')}.textextract.json`;

  const picker = (window as unknown as {
    showSaveFilePicker?: (options: unknown) => Promise<{
      createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  }).showSaveFilePicker;
  // 다른 창 안에 끼워진 페이지에서는 저장 창이 막혀 있다 — 그때는 링크로 넘어간다.
  if (picker && window.self === window.top) {
    try {
      const handle = await picker({
        suggestedName: fileName,
        types: [{ description: '서식 파일', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([json], { type: 'application/json' }));
      await writable.close();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
      /* 저장 창을 쓸 수 없으면 링크로 받는다 */
    }
  }

  const blob = new Blob([json], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 바로 회수하면 느린 브라우저(파이어폭스·모바일)에서 받기가 시작되기도 전에 끊긴다.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export async function readPresetFile(file: File): Promise<PresetFile> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<PresetFile>;
  if (parsed.kind !== 'text-extract-preset' || !parsed.settings) {
    throw new Error('이 발췌기에서 저장한 서식 파일이 아닙니다.');
  }
  return {
    kind: 'text-extract-preset',
    version: 1,
    savedAt: parsed.savedAt ?? new Date().toISOString(),
    name: parsed.name ?? '불러온 서식',
    settings: mergeSettings(DEFAULT_SETTINGS, parsed.settings),
  };
}
