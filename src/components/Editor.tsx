import { useCallback, useEffect, useRef } from 'react';
import { collapseBlankLines, markupRoles } from '../lib/parse';
import { restoreCaret, saveCaret } from '../lib/caret';
import { ensureWebFont } from '../lib/webfonts';
import {
  blockAtSelection, insertPlainText, rememberSelection, selectImage, selectionImage,
  syncInlineVars,
} from '../lib/format';

/**
 * 본문을 줄 단위 평문으로 읽는다.
 *
 * innerText 를 쓰면 화면에서 감춘 강조 기호(*)까지 빠져 버려,
 * 어디가 강조인지 알 수 없게 된다. 그래서 직접 훑는다.
 */
/**
 * 이름표(`data-te-label`)를 뺀 글자만 모은다.
 *
 * 말풍선·대본이 달고 있는 이름표는 우리가 붙인 표지지 사용자가 쓴 글이 아니다.
 * 그대로 읽으면 `세인: 세인"대사"` 가 되어 대사·이름 인식이 어긋난다.
 */
function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node as Text).data;
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  if (el.dataset.teLabel === 'true') return '';
  let out = '';
  for (const child of Array.from(el.childNodes)) out += textOf(child);
  return out;
}

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
      lines.push(textOf(el));
      continue;
    }
    current += textOf(el);
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

  /*
   * 지운 자리에 감춰 둔 기호(*, 괄호)만 남았는지 본다.
   *
   * 브라우저의 지우기는 눈에 보이지 않는 것을 지울 것으로 치지 않는다. 그래서
   * 본문을 모두 골라 지워도 줄 끝의 기호 한 글자가 살아남고, 다음 순간 서식이
   * 풀리며 난데없는 `)` 로 되살아났다. 글이 하나도 남지 않은 셈이니 빈 본문으로 친다.
   * (진짜 글이 한 글자라도 있으면 곧바로 빠져나오므로 타이핑 때 부담이 없다.)
   */
  const onlyHiddenMarksLeft = (root: HTMLElement): boolean => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let sawMark = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node as Text).data;
      if (!text) continue;
      if ((node.parentElement as HTMLElement | null)?.closest('.te-mark, .te-paren-mark')) {
        sawMark = true;
        continue;
      }
      if (text.trim()) return false;
    }
    return sawMark;
  };

  /** 역할 마크업을 다시 씌운다. 결과가 같으면 DOM 을 건드리지 않아 커서·되돌리기가 보존된다. */
  const remark = useCallback(() => {
    const root = rootRef.current;
    if (!root || composingRef.current) return;

    /*
     * 짝을 잃은 괄호 기호를 떨군다.
     * 글의 일부만 골라 지우면, 감춰 둔 여는·닫는 기호 가운데 하나만 남는 일이
     * 생긴다. 괄호 묶음은 언제나 기호 둘로 만들어지므로, 둘이 아니면 지우다 만
     * 자리다 — 글은 두고 기호만 떨군다.
     */
    root.querySelectorAll('.te-paren').forEach((span) => {
      const marks = span.querySelectorAll('.te-paren-mark');
      if (marks.length === 2) return;
      marks.forEach((mark) => mark.remove());
    });

    if (onlyHiddenMarksLeft(root)) {
      const line = document.createElement('div');
      line.appendChild(document.createElement('br'));
      root.replaceChildren(line);
      const caret = document.createRange();
      caret.setStart(line, 0);
      caret.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(caret);
      rememberSelection(root);
      return;
    }

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
        const root = rootRef.current;
        if (!root) return;

        /*
         * 전체 선택(Ctrl/Cmd+A)은 우리가 직접 잡는다.
         * 브라우저의 전체 선택은 감춰 둔 기호(*, 괄호)를 건너뛴다. 그래서 본문을
         * 모두 지워도 줄 끝의 기호 한 글자가 살아남아, 다음 순간 서식이 풀리며
         * 난데없는 `)` 로 되살아났다. 본문 전체를 범위로 잡으면 감춘 것까지 딸려 온다.
         */
        if ((event.ctrlKey || event.metaKey) && !event.altKey
            && event.key.toLowerCase() === 'a' && !composingRef.current) {
          event.preventDefault();
          const all = document.createRange();
          all.selectNodeContents(root);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(all);
          rememberSelection(root);
          return;
        }

        /*
         * 말풍선·대본 안에서 Enter 를 누르면 그 밖 새 줄로 빠져나온다.
         * 그냥 두면 브라우저가 상자를 통째로 복제해 아래 줄까지 말풍선이 된다
         * (상자가 div 라 줄 안에 블록이 들어앉는 탓이다).
         * 상자 안에서 줄을 바꾸려면 Shift+Enter 를 쓴다.
         */
        if (event.key !== 'Enter' || event.shiftKey || composingRef.current) return;
        const block = blockAtSelection(root);
        if (!block) return;
        event.preventDefault();

        // 상자가 들어 있는 '줄'(에디터의 바로 아래 자식)을 찾아 그 뒤에 새 줄을 넣는다.
        let line: Node = block;
        while (line.parentNode && line.parentNode !== root) line = line.parentNode;
        const next = document.createElement('div');
        next.appendChild(document.createElement('br'));
        root.insertBefore(next, line.nextSibling);

        const caret = document.createRange();
        caret.setStart(next, 0);
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
