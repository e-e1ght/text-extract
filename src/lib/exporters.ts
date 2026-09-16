import { toBlob, toPng } from 'html-to-image';
import type { ExportOptions } from '../types';

/** 내보내기에서 제외할 요소 (플레이스홀더, 안내 배지 등) */
function exportFilter(node: HTMLElement): boolean {
  return !(node.dataset && node.dataset.exportIgnore === 'true');
}

/**
 * 배경 영상은 정적 이미지로 캡처할 수 없다.
 * 내보내기 직전에 현재 프레임을 캔버스로 떠서 임시 이미지로 덮어둔다.
 */
function freezeVideos(root: HTMLElement): () => void {
  const undos: Array<() => void> = [];
  root.querySelectorAll('video').forEach((video) => {
    if (!video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(video, 0, 0);
    } catch {
      return; // 교차 출처 영상 — 캡처 불가
    }
    const frame = document.createElement('img');
    frame.src = canvas.toDataURL('image/png');
    frame.style.cssText = video.style.cssText;
    frame.className = video.className;
    video.parentNode?.insertBefore(frame, video);
    const previousDisplay = video.style.display;
    video.style.display = 'none';
    undos.push(() => {
      frame.remove();
      video.style.display = previousDisplay;
    });
  });
  return () => undos.forEach((undo) => undo());
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

async function withPreparedNode<T>(node: HTMLElement, run: () => Promise<T>): Promise<T> {
  const restore = freezeVideos(node);
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
     * html-to-image 는 첫 호출에서 글꼴·이미지를 인라인하는 캐시를 채운다.
     * 그래서 첫 결과가 비거나 일부가 빠지는 일이 잦다 — 한 번 버리고 다시 찍는다.
     */
    await toPng(node, { pixelRatio: 0.1, cacheBust: false, filter: exportFilter }).catch(() => '');

    return await run();
  } finally {
    picked.forEach((el) => el.classList.add('is-picked'));
    restore();
  }
}

/**
 * 페이지 나눔선을 기준으로 본문을 쪼개, 페이지마다 한 장씩 담아낸다.
 * 나눔선이 없으면 통째로 한 장이다.
 *
 * 줄마다 display 를 직접 껐다 켜므로, 캡처가 끝나면 반드시 되돌려야 한다.
 */
function paginate(capture: HTMLElement): { pages: number; show: (page: number) => void; restore: () => void } {
  const editor = capture.querySelector<HTMLElement>('.editor');
  if (!editor) return { pages: 1, show: () => {}, restore: () => {} };

  if (!editor.querySelector('[data-te-page-break]')) {
    return { pages: 1, show: () => {}, restore: () => {} };
  }

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
  const pageOf = new Map<HTMLElement, number>();
  let page = 0;
  for (const block of blocks) {
    if (block.dataset.tePageBreak === 'true') {
      page += 1;
      continue;
    }
    pageOf.set(block, page);
  }

  return {
    pages: page + 1,
    show: (target: number) => {
      blocks.forEach((block) => {
        block.style.display = pageOf.get(block) === target ? '' : 'none';
      });
    },
    restore: () => {
      blocks.forEach((block, index) => { block.style.display = previous[index]; });
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

export async function exportNode(node: HTMLElement, options: ExportOptions): Promise<void> {
  const { format, scale, quality, fileName } = options;
  const base = safeName(fileName);

  await withPreparedNode(node, async () => {
    const pager = paginate(node);
    const suffix = (page: number) => (pager.pages > 1 ? `-${page + 1}` : '');

    const shot = async (type: 'png' | 'jpeg') => {
      const blob = await toBlob(node, {
        pixelRatio: scale,
        cacheBust: true,
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
            pixelRatio: scale, cacheBust: true, filter: exportFilter,
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
        pdf?.save(`${base}.pdf`);
        return;
      }

      for (let page = 0; page < pager.pages; page += 1) {
        pager.show(page);
        const blob = await shot(format);
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${base}${suffix(page)}.${format === 'jpeg' ? 'jpg' : 'png'}`);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        // 브라우저가 연속 다운로드를 막지 않도록 살짝 간격을 둔다.
        if (page < pager.pages - 1) await new Promise((r) => setTimeout(r, 350));
      }
    } finally {
      pager.restore();
    }
  });
}

/** 클립보드 복사 (PNG). 지원하지 않는 브라우저에서는 false 를 돌려준다. */
export async function copyNodeToClipboard(node: HTMLElement, scale: number): Promise<boolean> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
  return withPreparedNode(node, async () => {
    const blob = await toBlob(node, { pixelRatio: scale, cacheBust: true, filter: exportFilter });
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  });
}

/**
 * 외부 주소 이미지를 data: URL 로 바꾼다.
 *
 * 다른 도메인의 이미지는 보안 정책 때문에 캡처에 담기지 않아, 저장하면 배경이 빠진다.
 * 미리 받아 두면 업로드한 것과 똑같이 저장된다. 서버가 허락하지 않으면 실패한다.
 */
export async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`이미지를 받지 못했습니다 (${response.status})`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
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
