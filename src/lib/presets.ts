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

export function downloadPreset(name: string, settings: Settings): void {
  const payload: PresetFile = {
    kind: 'text-extract-preset',
    version: 1,
    savedAt: new Date().toISOString(),
    name: name.trim() || '서식',
    settings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${payload.name.replace(/[\\/:*?"<>|]/g, '_')}.textextract.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
