/**
 * 작업 내용 보관소.
 *
 * localStorage 는 한 사이트당 5MB 안팎이라, 배경 사진 한 장만 넣어도 한도를 넘는다.
 * 넘어가면 **아무 소리 없이** 저장이 멈춰 새로고침할 때 작업이 통째로 사라진다.
 * 그래서 용량이 훨씬 큰 IndexedDB 에 담고, 예전 localStorage 기록은 한 번만 옮겨 온다.
 */
const DB_NAME = 'text-extract-store';
const STORE = 'state';

export const SETTINGS_KEY = 'settings';
export const CONTENT_KEY = 'content';

/** 예전 버전이 쓰던 localStorage 키 (한 번만 읽어 옮긴다) */
const LEGACY_SETTINGS = 'text-extract:settings:v1';
const LEGACY_CONTENT = 'text-extract:content:v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

function readLegacy(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function dropLegacy(): void {
  try {
    localStorage.removeItem(LEGACY_SETTINGS);
    localStorage.removeItem(LEGACY_CONTENT);
  } catch {
    /* 무시 */
  }
}

export interface LoadedState {
  settings: unknown | null;
  content: string | null;
}

export async function loadState(): Promise<LoadedState> {
  let settings: unknown | null = null;
  let content: string | null = null;

  try {
    settings = (await withStore<unknown>('readonly', (s) => s.get(SETTINGS_KEY))) ?? null;
    content = (await withStore<string | undefined>('readonly', (s) => s.get(CONTENT_KEY))) ?? null;
  } catch {
    /* IndexedDB 를 못 쓰는 환경 — 아래에서 localStorage 로 넘어간다 */
  }

  if (settings === null) {
    const raw = readLegacy(LEGACY_SETTINGS);
    if (raw) {
      try { settings = JSON.parse(raw); } catch { settings = null; }
    }
  }
  if (content === null) content = readLegacy(LEGACY_CONTENT);

  // 옮겨 왔으면 예전 기록은 정리해 용량을 돌려준다.
  if (settings !== null || content !== null) {
    void saveState(SETTINGS_KEY, settings).then(dropLegacy).catch(() => {});
  }

  return { settings, content };
}

export async function saveState(key: string, value: unknown): Promise<void> {
  await withStore('readwrite', (store) => store.put(value, key));
}
