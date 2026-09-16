/**
 * 사용자가 올린 글꼴 관리.
 *
 * 한글 글꼴 파일은 보통 수 MB 라 localStorage 에 넣으면 용량 한도에 바로 걸린다.
 * 파일은 IndexedDB 에 두고, 설정에는 목록(id·이름)만 남긴다.
 */
import type { CustomFont } from '../types';

const DB_NAME = 'text-extract-fonts';
const STORE = 'fonts';

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

export function fontFamilyOf(font: CustomFont): string {
  return `"te-font-${font.id}", sans-serif`;
}

export async function saveFontFile(file: File): Promise<CustomFont> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const buffer = await file.arrayBuffer();
  await withStore('readwrite', (store) => store.put(buffer, id));
  return { id, label: file.name.replace(/\.[^.]+$/, '') };
}

export async function deleteFontFile(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
  document.getElementById(`te-font-style-${id}`)?.remove();
}

/** @font-face 를 문서에 심는다. 이미 심어져 있으면 아무것도 하지 않는다. */
export async function installFont(font: CustomFont): Promise<boolean> {
  const styleId = `te-font-style-${font.id}`;
  if (document.getElementById(styleId)) return true;

  let buffer: ArrayBuffer | undefined;
  try {
    buffer = await withStore<ArrayBuffer | undefined>('readonly', (store) => store.get(font.id));
  } catch {
    return false;
  }
  if (!buffer) return false;

  // data: URL 로 심어야 내보내기(html-to-image)에서도 글꼴이 그대로 살아난다.
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const dataUrl = `data:font/ttf;base64,${btoa(binary)}`;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent =
    `@font-face{font-family:"te-font-${font.id}";src:url(${dataUrl});font-display:swap;}`;
  document.head.appendChild(style);
  return true;
}

export async function installAllFonts(fonts: CustomFont[]): Promise<void> {
  await Promise.all(fonts.map((font) => installFont(font).catch(() => false)));
}
