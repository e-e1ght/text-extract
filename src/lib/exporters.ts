import { getFontEmbedCSS, toBlob, toPng } from 'html-to-image';
import type { ExportOptions } from '../types';
import { planPages, ratioOf } from './split';

/** 내보내기에서 제외할 요소 (플레이스홀더, 안내 배지 등) */
function exportFilter(node: HTMLElement): boolean {
  return !(node.dataset && node.dataset.exportIgnore === 'true');
}

/** 아직 다 받지 못한 이미지가 있으면 캡처가 비어 나온다. 전부 준비될 때까지 기다린다. */
async function waitForImages(node: HTMLElement): Promise<void> {
  const images = [...node.querySelectorAll('img')];
  await Promise.all(images.map(async (image) => {
    try {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
          window.setTimeout(resolve, 4000);
        });
      }
      await image.decode?.();
    } catch {
      /* 못 받은 이미지는 그대로 둔다 */
    }
  }));
}

/*
 * 글꼴을 그림 안에 끼워 넣는 CSS.
 *
 * html-to-image 는 캡처할 때마다 페이지의 모든 @font-face 를 찾아 글꼴 파일을
 * 내려받고 base64 로 바꾼다. 한글 글꼴은 한 벌이 수 MB 라 이 일이 저장 시간의
 * 큰 몫을 차지하고, PDF 는 쪽마다 이걸 되풀이했다. 한 번 만들어 두고 돌려 쓴다.
 */
let fontCss: Promise<string> | null = null;

/** 사용자가 글꼴을 새로 올리면 다시 만들어야 한다. */
export function resetFontCache(): void {
  fontCss = null;
}

function embeddedFontCss(node: HTMLElement): Promise<string> {
  if (!fontCss) {
    fontCss = getFontEmbedCSS(node).catch(() => '');
  }
  return fontCss;
}

async function withPreparedNode<T>(node: HTMLElement, run: (fontEmbedCSS: string) => Promise<T>): Promise<T> {
  /*
   * 고른 이미지의 파란 테두리는 화면 안내지 결과물이 아니다.
   * outline 이 이미지 자신에게 붙어 있어 exportFilter 로는 못 거른다 — 잠깐 떼어 둔다.
   */
  const picked = Array.from(node.querySelectorAll<HTMLElement>('.is-picked'));
  picked.forEach((el) => el.classList.remove('is-picked'));
  try {
    // 웹폰트·이미지가 준비되기 전에 캡처하면 글꼴이 바뀌거나 이미지가 빠진 채로 저장된다.
    if (document.fonts?.ready) await document.fonts.ready;
    await waitForImages(node);

    /*
     * 예전에는 여기서 작게 한 번 찍어 버리고 다시 찍었다 (첫 결과가 비는 일이 잦아서).
     * 그 원인은 글꼴을 끼워 넣는 준비가 첫 호출에서야 이뤄지는 것이었으므로,
     * 준비된 CSS 를 미리 만들어 넘기면 버리는 촬영 없이도 한 번에 제대로 나온다.
     * 큰 글에서는 이 한 번이 저장 시간의 절반이었다.
     */
    return await run(await embeddedFontCss(node));
  } finally {
    picked.forEach((el) => el.classList.add('is-picked'));
  }
}

interface Pager {
  pages: number;
  show: (page: number) => void;
  restore: () => void;
}

const SINGLE: Pager = { pages: 1, show: () => {}, restore: () => {} };

/**
 * 본문을 장으로 나눠, 장마다 한 장씩 담아낸다.
 *  - 비율로 나누기를 켰으면: 그 비율의 높이에 맞춰 문단 단위로 나눈다 (split.ts).
 *  - 아니면: 손으로 넣은 페이지 나눔선을 기준으로. 나눔선이 없으면 통째로 한 장.
 *
 * 줄마다 display 를 직접 껐다 켜므로, 캡처가 끝나면 반드시 되돌려야 한다.
 */
function paginate(capture: HTMLElement, options: ExportOptions): Pager {
  const editor = capture.querySelector<HTMLElement>('.editor');
  if (!editor) return SINGLE;
  const splitting = ratioOf(options.splitRatio) !== null;
  if (!splitting && !editor.querySelector('[data-te-page-break]')) return SINGLE;

  // contenteditable 은 첫 줄을 <div> 로 감싸지 않는 경우가 있다.
  // 맨 위 텍스트 노드를 임시 span 으로 싸 두어야 페이지별로 숨길 수 있다.
  const temps: HTMLElement[] = [];
  [...editor.childNodes].forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return;
    const wrapper = document.createElement('span');
    wrapper.dataset.teTemp = 'true';
    node.parentNode?.insertBefore(wrapper, node);
    wrapper.appendChild(node);
    temps.push(wrapper);
  });

  const blocks = [...editor.children] as HTMLElement[];
  const previous = blocks.map((el) => el.style.display);
  const previousMinHeight = capture.style.minHeight;
  let pageNo: HTMLElement | null = null;

  let groups: HTMLElement[][] = [];
  let pageHeight = 0;
  const plan = splitting ? planPages(capture, options.splitRatio) : null;
  if (plan) {
    groups = plan.groups;
    pageHeight = plan.pageHeight;
  } else {
    groups = [[]];
    for (const block of blocks) {
      if (block.dataset.tePageBreak === 'true') groups.push([]);
      else groups[groups.length - 1].push(block);
    }
  }

  const previousMargin = blocks.map((el) => el.style.marginTop);
  const display = (group: HTMLElement[]) => {
    const visible = new Set(group);
    blocks.forEach((block, index) => {
      block.style.display = visible.has(block) ? '' : 'none';
      block.style.marginTop = previousMargin[index];
    });
    /*
     * 문단 간격은 '앞 줄 다음' 에 붙는다(div + div). 둘째 장부터는 그 장의 첫 줄 앞에
     * 숨긴 줄이 있어 간격이 남아, 첫 장보다 글이 한 칸 내려와 시작했다. 장의 첫 줄은 떼어 낸다.
     */
    if (group[0]) group[0].style.marginTop = '0px';
  };

  if (plan) {
    capture.style.minHeight = `${pageHeight}px`;
    /*
     * 계획은 어림이라, 장마다 실제로 그려 보고 넘치면 마지막 문단을 다음 장으로 민다.
     * 문단 하나가 한 장보다 길면 어쩔 수 없이 그 장만 길어진다 (글을 자르지 않는다).
     */
    for (let i = 0; i < groups.length; i += 1) {
      display(groups[i]);
      while (groups[i].length > 1 && capture.offsetHeight > pageHeight + 1) {
        const moved = groups[i].pop() as HTMLElement;
        if (!groups[i + 1]) groups.push([]);
        groups[i + 1].unshift(moved);
        display(groups[i]);
      }
    }
    if (options.pageNumbers && groups.length > 1) {
      pageNo = document.createElement('div');
      pageNo.className = 'te-page-no';
      capture.appendChild(pageNo);
    }
  }

  return {
    pages: groups.length,
    show: (target: number) => {
      display(groups[target] ?? []);
      if (pageNo) pageNo.textContent = `${target + 1} / ${groups.length}`;
    },
    restore: () => {
      pageNo?.remove();
      capture.style.minHeight = previousMinHeight;
      if (capture.getAttribute('style') === '') capture.removeAttribute('style');
      blocks.forEach((block, index) => {
        block.style.display = previous[index];
        block.style.marginTop = previousMargin[index];
        // 빈 style="" 이 남으면 저장된 본문과 되돌리기 기록에 쓸데없는 차이가 생긴다
        if (block.getAttribute('style') === '') block.removeAttribute('style');
      });
      temps.forEach((wrapper) => {
        const parent = wrapper.parentNode;
        if (!parent) return;
        while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
        parent.removeChild(wrapper);
      });
      editor.normalize();
    },
  };
}

/** 저장하면 몇 장이 나올지 (저장 창을 파일 하나로 열지, 폴더로 열지 정할 때 쓴다) */
export function expectedPages(capture: HTMLElement, options: ExportOptions): number {
  const plan = planPages(capture, options.splitRatio);
  if (plan) return plan.groups.length;
  return capture.querySelectorAll('.editor [data-te-page-break]').length + 1;
}

function triggerDownload(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function safeName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|]/g, '_');
  return cleaned || '발췌';
}

/** 만든 그림을 써 넣을 곳 (저장 창으로 고른 파일·폴더) */
export type SaveTarget = (blob: Blob, name: string) => Promise<void>;

interface WritableFile {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
}
interface PickerWindow {
  showSaveFilePicker?: (options: unknown) => Promise<WritableFile>;
  showDirectoryPicker?: (options: unknown) => Promise<{
    getFileHandle: (name: string, options?: { create?: boolean }) => Promise<WritableFile>;
  }>;
}

const FILE_TYPES: Record<ExportOptions['format'], { description: string; accept: Record<string, string[]> }> = {
  png: { description: 'PNG 이미지', accept: { 'image/png': ['.png'] } },
  jpeg: { description: 'JPG 이미지', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } },
  pdf: { description: 'PDF 문서', accept: { 'application/pdf': ['.pdf'] } },
};

async function writeTo(handle: WritableFile, blob: Blob): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * 저장할 자리를 저장 창으로 먼저 고른다. **클릭하자마자, 다른 await 보다 먼저** 불러야 한다
 * (저장 창은 사용자가 막 누른 순간에만 열린다).
 *
 * 다운로드로 내려받으면 브라우저가 두 번째부터 소리 없이 버리는 일이 있었다(웨일 등 —
 * '저장했습니다' 는 뜨는데 파일이 없다). 저장 창으로 고른 파일에 직접 쓰면 다운로드를
 * 거치지 않으므로 막힐 일이 없다. 여러 장이면 폴더를 한 번 고른다.
 *
 * 저장 창을 쓸 수 없으면 null (다운로드로 넘어간다), 사용자가 닫았으면 'cancelled'.
 */
export async function pickSaveTarget(
  node: HTMLElement, options: ExportOptions,
): Promise<SaveTarget | null | 'cancelled'> {
  const picker = window as unknown as PickerWindow;
  // 다른 창 안에 끼워진 페이지에서는 저장 창이 막혀 있다.
  if (window.self !== window.top) return null;
  const pages = expectedPages(node, options);
  const ext = options.format === 'jpeg' ? 'jpg' : options.format;

  try {
    if (pages === 1 || options.format === 'pdf') {
      if (!picker.showSaveFilePicker) return null;
      const handle = await picker.showSaveFilePicker({
        suggestedName: `${safeName(options.fileName)}.${ext}`,
        types: [FILE_TYPES[options.format]],
      });
      return (blob) => writeTo(handle, blob);
    }
    if (!picker.showDirectoryPicker) return null;
    const folder = await picker.showDirectoryPicker({ mode: 'readwrite', id: 'text-extract-export' });
    return async (blob, name) => {
      // 같은 이름이 이미 있으면 덮어쓰지 않고 (2), (3)… 을 붙인다.
      const dot = name.lastIndexOf('.');
      let candidate = name;
      for (let n = 2; n < 1000; n += 1) {
        try {
          await folder.getFileHandle(candidate);
          candidate = `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
        } catch {
          break;
        }
      }
      await writeTo(await folder.getFileHandle(candidate, { create: true }), blob);
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return null;
  }
}

/** 저장한 파일. 브라우저가 자동 다운로드를 막았을 때 직접 눌러 받을 수 있게 돌려준다. */
export interface ExportedFile {
  name: string;
  url: string;
}

/**
 * 그림을 만들어 내려받는다.
 *
 * 브라우저(특히 크롬)는 클릭 없이 시작된 다운로드가 이어지면 '여러 파일 자동 다운로드'
 * 로 보고 막아 버리고, 그 상태는 새로고침해야 풀린다. 그림을 만드는 데 몇 초가 걸려
 * 다운로드가 클릭에서 떨어져 시작되므로 두 번째 저장부터 막히는 일이 생겼다.
 * 그래서 만든 파일의 주소를 돌려줘, 화면에서 직접 눌러 받을 수 있게 한다.
 * 주소는 다음 저장 때 회수한다(releaseExported).
 */
export async function exportNode(
  node: HTMLElement, options: ExportOptions, target?: SaveTarget,
): Promise<ExportedFile[]> {
  const { format, scale, quality, fileName } = options;
  const base = safeName(fileName);
  const files: ExportedFile[] = [];
  const deliver = async (blob: Blob, name: string) => {
    if (target) {
      await target(blob, name);
      return;
    }
    const url = URL.createObjectURL(blob);
    files.push({ name, url });
    triggerDownload(url, name);
  };

  await withPreparedNode(node, async (fontEmbedCSS) => {
    const pager = paginate(node, options);
    const suffix = (page: number) => (pager.pages > 1 ? `-${page + 1}` : '');

    const shot = async (type: 'png' | 'jpeg') => {
      const blob = await toBlob(node, {
        pixelRatio: scale,
        fontEmbedCSS,
        filter: exportFilter,
        width: node.offsetWidth,
        height: node.offsetHeight,
        type: type === 'jpeg' ? 'image/jpeg' : 'image/png',
        quality: type === 'jpeg' ? quality : undefined,
        backgroundColor: type === 'jpeg' ? '#ffffff' : undefined,
      });
      if (!blob) throw new Error('이미지를 생성하지 못했습니다.');
      return blob;
    };

    try {
      if (format === 'pdf') {
        // jsPDF 는 무거우므로 PDF 를 실제로 저장할 때만 불러온다.
        const { default: jsPDF } = await import('jspdf');
        let pdf: import('jspdf').jsPDF | null = null;

        for (let page = 0; page < pager.pages; page += 1) {
          pager.show(page);
          const dataUrl = await toPng(node, {
            pixelRatio: scale, fontEmbedCSS, filter: exportFilter,
            width: node.offsetWidth, height: node.offsetHeight,
          });
          const width = node.offsetWidth;
          const height = node.offsetHeight;
          if (!pdf) {
            pdf = new jsPDF({
              orientation: width >= height ? 'landscape' : 'portrait',
              unit: 'px',
              format: [width, height],
              compress: true,
            });
          } else {
            pdf.addPage([width, height], width >= height ? 'landscape' : 'portrait');
          }
          pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
        }
        if (pdf) await deliver(pdf.output('blob'), `${base}.pdf`);
        return;
      }

      for (let page = 0; page < pager.pages; page += 1) {
        pager.show(page);
        const blob = await shot(format);
        await deliver(blob, `${base}${suffix(page)}.${format === 'jpeg' ? 'jpg' : 'png'}`);
        // 브라우저가 연속 다운로드를 막지 않도록 살짝 간격을 둔다.
        if (page < pager.pages - 1) await new Promise((r) => setTimeout(r, 350));
      }
    } finally {
      pager.restore();
    }
  });
  return files;
}

export function releaseExported(files: ExportedFile[]): void {
  files.forEach((file) => URL.revokeObjectURL(file.url));
}

/** 클립보드 복사 (PNG). 지원하지 않는 브라우저에서는 false 를 돌려준다. */
export async function copyNodeToClipboard(node: HTMLElement, scale: number): Promise<boolean> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
  return withPreparedNode(node, async (fontEmbedCSS) => {
    const blob = await toBlob(node, { pixelRatio: scale, fontEmbedCSS, filter: exportFilter });
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  });
}

/** 파일을 data: URL 로 읽는다 (배경 이미지·프로필 업로드용) */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
