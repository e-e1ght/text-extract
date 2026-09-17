import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { DEFAULT_SETTINGS, SAMPLE_CONTENT } from './defaults';
import { CONTENT_KEY, SETTINGS_KEY, loadState, saveState } from './lib/storage';
import type { CharacterStyle, Settings } from './types';

type Plain = Record<string, unknown>;
const isPlainObject = (v: unknown): v is Plain =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * 저장된 설정을 기본값 위에 덮어쓴다. 기능이 추가되어 키가 늘어나도
 * 예전에 저장된 서식을 그대로 불러올 수 있게 하기 위함이다.
 */
/**
 * 새 캐릭터는 지금의 공통값을 **그대로 떠서** 시작한다.
 *
 * 비워 두고 공통값을 물려받게 하면, 나중에 공통 대사색·말풍선색을 바꿀 때
 * 캐릭터 색까지 함께 끌려간다. 캐릭터를 따로 두는 까닭이 색을 분리하는 것이므로,
 * 만드는 순간의 색을 제 값으로 갖는다.
 */
export function newCharacter(name: string, settings: Settings): CharacterStyle {
  return {
    name,
    color: settings.roles.name,
    dialogueColor: settings.roles.dialogue,
    bubbleColor: settings.bubble.bubbleColor,
    avatar: '',
    isMe: false,
  };
}

export function mergeSettings(base: Settings, incoming: unknown): Settings {
  const merge = (a: unknown, b: unknown): unknown => {
    if (!isPlainObject(a) || !isPlainObject(b)) return b === undefined ? a : b;
    const out: Plain = { ...a };
    for (const [key, value] of Object.entries(b)) {
      if (value === undefined) continue;
      out[key] = key in a ? merge(a[key], value) : value;
    }
    return out;
  };
  /*
   * 예전에는 말풍선 설정이 메신저 테마의 것이라 `messenger` 라는 이름이었다.
   * 메신저를 없애면서 `bubble` 로 옮겼다 — 예전에 저장해 둔 색·크기를 살린다.
   */
  if (isPlainObject(incoming) && isPlainObject((incoming as Plain).messenger)
      && !isPlainObject((incoming as Plain).bubble)) {
    incoming = { ...(incoming as Plain), bubble: (incoming as Plain).messenger };
  }
  // characters 는 사용자가 정의한 자유 키라 병합이 아니라 통째로 교체한다.
  const result = merge(base, incoming) as Settings;
  if (isPlainObject(incoming) && isPlainObject((incoming as Plain).characters)) {
    result.characters = (incoming as unknown as Settings).characters;
  }

  /*
   * 예전 캐릭터는 색을 비워 두고 공통값을 물려받았다. 그래서 공통 대사색·말풍선색을
   * 바꾸면 캐릭터 색까지 따라 바뀌었다. 지금 보이는 색을 제 값으로 굳혀 준다.
   */
  result.characters = Object.fromEntries(
    Object.entries(result.characters ?? {}).map(([key, character]) => [key, {
      ...character,
      dialogueColor: character.dialogueColor || result.roles.dialogue,
      bubbleColor: character.bubbleColor || result.bubble.bubbleColor,
    }]),
  );
  return result;
}

interface StoreValue {
  settings: Settings;
  setSettings: (updater: (prev: Settings) => Settings) => void;
  /** settings 의 한 섹션만 부분 수정한다. */
  patch: <K extends keyof Settings>(section: K, value: Partial<Settings[K]>) => void;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  replaceSettings: (next: Settings) => void;
  resetSettings: () => void;
  upsertCharacter: (name: string, value: Partial<CharacterStyle>) => void;
  /** 에디터 초기 내용 (마운트 시 1회 주입) */
  initialContent: string;
  saveContent: (html: string) => void;
  /** 보관소에서 다 읽어 왔는지 */
  ready: boolean;
  /** 저장이 막혔을 때 사용자에게 알릴 문구 */
  saveError: string;
  /** 배경 이미지 위치를 드래그로 조절하는 중인지 (저장하지 않음) */
  adjustingImage: boolean;
  setAdjustingImage: (value: boolean) => void;
  /** 지금 고른 스티커 id (저장하지 않음) */
  selectedSticker: string | null;
  setSelectedSticker: (id: string | null) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [adjustingImage, setAdjustingImage] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState('');
  const initialContent = useRef(SAMPLE_CONTENT);

  // 보관소에서 읽어 온 뒤에야 화면을 그린다 — 에디터는 마운트할 때 내용을 한 번만 받기 때문.
  useEffect(() => {
    let alive = true;
    loadState()
      .then(({ settings: stored, content }) => {
        if (!alive) return;
        if (stored) setSettingsState(mergeSettings(DEFAULT_SETTINGS, stored));
        if (content !== null) initialContent.current = content;
      })
      .catch(() => { /* 못 읽으면 기본값으로 시작한다 */ })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const id = window.setTimeout(() => {
      saveState(SETTINGS_KEY, settings)
        .then(() => setSaveError(''))
        .catch(() => setSaveError('설정을 저장하지 못했습니다. 브라우저 저장 공간이 부족하거나 차단돼 있을 수 있습니다.'));
    }, 250);
    return () => window.clearTimeout(id);
  }, [settings, ready]);

  const setSettings = useCallback((updater: (prev: Settings) => Settings) => {
    setSettingsState(updater);
  }, []);

  const patch = useCallback<StoreValue['patch']>((section, value) => {
    setSettingsState((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as object), ...(value as object) },
    }));
  }, []);

  const set = useCallback<StoreValue['set']>((key, value) => {
    setSettingsState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const replaceSettings = useCallback((next: Settings) => {
    setSettingsState(mergeSettings(DEFAULT_SETTINGS, next));
  }, []);

  /*
   * 서식만 되돌린다. 다크/라이트 같은 화면 설정은 서식이 아니라 작업 환경이라,
   * 초기화했다고 모드가 바뀌면 당황스럽다.
   */
  const resetSettings = useCallback(() => {
    setSettingsState((prev) => ({
      ...DEFAULT_SETTINGS,
      appTheme: prev.appTheme,
      sidebarSide: prev.sidebarSide,
      sidebarWidth: prev.sidebarWidth,
      activePanel: prev.activePanel,
      previewZoom: prev.previewZoom,
    }));
  }, []);

  const upsertCharacter = useCallback((name: string, value: Partial<CharacterStyle>) => {
    setSettingsState((prev) => {
      const existing = prev.characters[name] ?? newCharacter(name, prev);
      return {
        ...prev,
        characters: { ...prev.characters, [name]: { ...existing, ...value, name } },
      };
    });
  }, []);

  const saveContent = useCallback((html: string) => {
    saveState(CONTENT_KEY, html)
      .then(() => setSaveError(''))
      .catch(() => setSaveError('본문을 저장하지 못했습니다. 브라우저 저장 공간이 부족할 수 있습니다.'));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      settings, setSettings, patch, set, replaceSettings, resetSettings,
      upsertCharacter, initialContent: initialContent.current, saveContent,
      adjustingImage, setAdjustingImage, selectedSticker, setSelectedSticker,
      ready, saveError,
    }),
    [settings, setSettings, patch, set, replaceSettings, resetSettings,
     upsertCharacter, saveContent, adjustingImage, selectedSticker, ready, saveError],
  );

  /*
   * 다 읽기 전에는 화면을 만들지 않는다.
   * 에디터는 마운트할 때 내용을 한 번만 받으므로, 여기서 먼저 그려 버리면
   * 빈 본문을 붙잡은 채로 시작해 저장된 글을 덮어쓴다.
   */
  if (!ready) {
    return (
      <div className="app boot" data-app-theme={settings.appTheme}>
        <p className="boot-text">불러오는 중…</p>
      </div>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore 는 StoreProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
