import { useCallback, useEffect, useRef } from 'react';
import { collapseBlankLines, markupRoles } from '../lib/parse';
import { restoreCaret, saveCaret } from '../lib/caret';
import { insertPlainText, rememberSelection, selectImage, syncInlineVars } from '../lib/format';

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
    markupRoles(root);
    publish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autoParse 를 켜면 즉시 한 번 적용하고, 끄면 마크업을 그대로 둔다.
  useEffect(() => {
    if (autoParse) remark();
  }, [autoParse, remark]);

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
        insertPlainText(tidyBlankLines ? collapseBlankLines(pasted) : pasted);
        window.clearTimeout(timerRef.current);
        if (autoParse) remark();
        publish();
      }}
    />
  );
}
