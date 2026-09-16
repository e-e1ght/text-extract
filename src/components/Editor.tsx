import { useCallback, useEffect, useRef } from 'react';
import { collapseBlankLines, markupRoles } from '../lib/parse';
import { restoreCaret, saveCaret } from '../lib/caret';
import { ensureWebFont } from '../lib/webfonts';
import {
  insertPlainText, rememberSelection, selectImage, selectionImage, splitLineAtCaret,
  syncInlineVars, unwrapLegacyBubbles,
} from '../lib/format';

/**
 * 본문을 줄 단위 평문으로 읽는다.
 *
 * innerText 를 쓰면 화면에서 감춘 강조 기호(*)까지 빠져 버려,
 * 메신저 테마가 어디가 강조인지 알 수 없게 된다. 그래서 직접 훑는다.
 */
export function readPlainText(root: HTMLElement): string {
  const lines: string[] = [];
  let current = '';
  const flush = () => { lines.push(current); current = ''; };

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      current += node.textContent ?? '';
      continue;
    }
    const el = node as HTMLElement;
    if (el.tagName === 'BR') { flush(); continue; }
    if (el.tagName === 'DIV' || el.tagName === 'P' || el.tagName === 'LI') {
      if (current) flush();
      lines.push(el.textContent ?? '');
      continue;
    }
    current += el.textContent ?? '';
  }
  if (current) flush();
  return lines.join('\n');
}

export function plainToHtml(text: string): string {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => `<div>${line ? escape(line) : '<br>'}</div>`)
    .join('');
}

interface EditorProps {
  initialContent: string;
  autoParse: boolean;
  tidyBlankLines: boolean;
  onRootChange: (node: HTMLDivElement | null) => void;
  onTextChange: (plainText: string) => void;
  onHtmlChange: (html: string) => void;
}

export function Editor({
  initialContent, autoParse, tidyBlankLines, onRootChange, onTextChange, onHtmlChange,
}: EditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  /** 역할 마크업을 다시 씌운다. 결과가 같으면 DOM 을 건드리지 않아 커서·되돌리기가 보존된다. */
  const remark = useCallback(() => {
    const root = rootRef.current;
    if (!root || composingRef.current) return;

    const probe = root.cloneNode(true) as HTMLDivElement;
    markupRoles(probe);
    if (probe.innerHTML !== root.innerHTML) {
      const caret = saveCaret(root);
      markupRoles(root);
      // 역할 span 을 다시 씌우면서 서식이 바깥 span 으로 옮겨진다 — 변수도 함께 옮긴다.
      syncInlineVars(root);
      restoreCaret(root, caret);
    }
  }, []);

  const publish = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    onTextChange(readPlainText(root));
    onHtmlChange(root.innerHTML);
  }, [onTextChange, onHtmlChange]);

  /** 타이핑 즉시 HTML 만 알린다 — 테마를 바꿔 언마운트돼도 내용이 남도록. */
  const publishHtml = useCallback(() => {
    const root = rootRef.current;
    if (root) onHtmlChange(root.innerHTML);
  }, [onHtmlChange]);

  const scheduleWork = useCallback(() => {
    publishHtml();
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (autoParse) remark();
      publish();
    }, 400);
  }, [autoParse, remark, publish, publishHtml]);

  // 최초 1회만 내용을 주입한다. 이후로는 DOM 이 원본이다.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.innerHTML = initialContent.includes('<')
      ? initialContent
      : plainToHtml(tidyBlankLines ? collapseBlankLines(initialContent) : initialContent);
    // 저장될 때 딸려 들어갔을 수 있는 선택 표시를 지운다 (화면 안내지 내용이 아니다)
    root.querySelectorAll('.is-picked').forEach((el) => el.classList.remove('is-picked'));
    // 예전에 드래그로 만들어 둔 말풍선은 평범한 줄로 되돌린다
    unwrapLegacyBubbles(root);
    // 드래그로 글꼴을 준 자리가 있으면 그 글꼴을 받아 온다 (이제 고른 것만 받는다)
    root.querySelectorAll<HTMLElement>('[style*="font-family"]')
      .forEach((el) => ensureWebFont(el.style.fontFamily));
    markupRoles(root);
    publish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autoParse 를 켜면 즉시 한 번 적용하고, 끄면 마크업을 그대로 둔다.
  useEffect(() => {
    if (autoParse) remark();
  }, [autoParse, remark]);

  /*
   * 고른 이미지의 파란 테두리는 '지금 골라 둔 것' 을 보여 주는 표시다.
   * 클릭할 때만 지우면 다른 곳을 드래그해도 테두리가 남는다 — 선택이 바뀔 때마다 맞춘다.
   */
  useEffect(() => {
    const sync = () => {
      const root = rootRef.current;
      if (!root) return;
      const picked = selectionImage(root);
      root.querySelectorAll<HTMLElement>('.te-img.is-picked').forEach((el) => {
        if (el !== picked) el.classList.remove('is-picked');
      });
      picked?.classList.add('is-picked');
    };
    document.addEventListener('selectionchange', sync);
    return () => document.removeEventListener('selectionchange', sync);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        onRootChange(node);
      }}
      className="editor"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      role="textbox"
      aria-multiline="true"
      aria-label="본문"
      onInput={scheduleWork}
      onKeyDown={(event) => {
        /*
         * 메신저에서는 대사 span 이 block 이라, 줄(div) 안에 블록이 들어앉는다.
         * 이 상태에서 브라우저는 Enter 로 문단을 나누지 못하고 그냥 무시한다
         * (엔터를 쳐도 아무 일이 없거나 되돌아간 것처럼 보였다).
         * 그래서 메신저에서는 줄을 우리가 직접 나눈다.
         */
        if (event.key !== 'Enter' || event.shiftKey || composingRef.current) return;
        const root = rootRef.current;
        if (!root || !root.closest('.messenger-mode')) return;
        const split = splitLineAtCaret(root);
        if (!split) return;
        event.preventDefault();

        const caret = document.createRange();
        caret.setStart(split.tail, 0);
        caret.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(caret);
        rememberSelection(root);
        root.dispatchEvent(new Event('input', { bubbles: true }));
      }}
      onKeyUp={() => { const root = rootRef.current; if (root) rememberSelection(root); }}
      onMouseUp={() => { const root = rootRef.current; if (root) rememberSelection(root); }}
      onClick={(event) => {
        // 이미지는 클릭만 해도 잡히게 한다 (드래그하지 않아도 크기·정렬을 바꿀 수 있도록)
        const target = event.target as HTMLElement;
        const root = rootRef.current;
        if (!root) return;
        root.querySelectorAll('.te-img.is-picked').forEach((el) => el.classList.remove('is-picked'));
        if (target.tagName === 'IMG' && target.dataset.teImg === 'true') {
          target.classList.add('is-picked');
          selectImage(target as HTMLImageElement);
          document.dispatchEvent(new Event('selectionchange'));
        }
      }}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={() => { composingRef.current = false; scheduleWork(); }}
      onBlur={() => {
        const root = rootRef.current;
        if (root) rememberSelection(root);
        window.clearTimeout(timerRef.current);
        if (autoParse) remark();
        publish();
      }}
      onPaste={(event) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData('text/plain');
        insertPlainText(rootRef.current, tidyBlankLines ? collapseBlankLines(pasted) : pasted);
        window.clearTimeout(timerRef.current);
        if (autoParse) remark();
        publish();
      }}
    />
  );
}
