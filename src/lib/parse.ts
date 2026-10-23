/**
 * 대사 / 서술 인식 규칙
 *  - 따옴표( " “ ” 「」 『』 ) 안의 텍스트는 대사. 줄바꿈을 넘어가도 닫힐 때까지 대사로 본다.
 *  - *…* 또는 **…** 안의 텍스트는 강조 서술.
 *  - (…) 안의 텍스트는 곁말. '괄호 안 작게' 를 켜면 작은 회색 글씨가 된다.
 *    괄호 안에 볼드·이탤릭을 주어 글이 여러 조각으로 나뉘어도 같은 줄에서 닫히면 곁말이다.
 *  - 그 외 텍스트는 서술.
 *
 * 줄 머리의 `이름:` 을 캐릭터 이름으로 보던 인식은 없앴다. 쓰는 사람이 드물었고,
 * 서술 첫머리의 `시간: 오후 3시` 같은 글까지 이름으로 잡혔다. 캐릭터는 편집 패널이나
 * 말풍선 탭에서 직접 지정한다.
 */

const OPEN_QUOTES: Record<string, string> = {
  '"': '"',
  '“': '”', // “ ”
  '「': '」', // 「 」
  '『': '』', // 『 』
};
/** 닫는 문자로만 쓰이는 따옴표 — 단독으로 나오면 서술로 흘려보낸다 */
const CLOSE_ONLY = new Set(['\u201D', '\u300D', '\u300F']);

/** 'name' 은 예전에 저장된 본문(`이름:` 인식 시절)의 역할 span 을 읽기 위해 남겨 둔다 */
export type Role = 'dialogue' | 'narration' | 'emph' | 'name' | 'mark' | 'paren';

interface Piece {
  text: string;
  role: Role;
  /** 곁말 조각이 여는·닫는 괄호를 품고 있는지 (곁말이 여러 조각에 걸칠 수 있어서) */
  parenOpen?: boolean;
  parenClose?: boolean;
}

const PAREN_CLOSE = /[)\uFF09]/;

interface ScanState {
  /** 열려 있는 따옴표의 닫는 문자. null 이면 대사 밖 */
  closer: string | null;
  /** *…* 강조가 열려 있는지 */
  emph: boolean;
  /** (…) 곁말이 열려 있는지 — 괄호 안에 서식을 주면 글이 조각나므로 조각을 넘어 이어진다 */
  paren: boolean;
}

export function createScanState(): ScanState {
  return { closer: null, emph: false, paren: false };
}

/**
 * 한 텍스트 조각을 역할별로 쪼갠다. state 는 호출 간에 이어지며,
 * 따옴표가 여러 줄에 걸쳐 열려 있는 상황을 그대로 반영한다.
 *
 * lookahead 는 같은 줄에서 이 조각 뒤에 오는 글이다. 사용자가 서식을 주면 한 줄이
 * 여러 텍스트 노드로 나뉘는데, 닫는 짝(`)`, `*`)이 뒤 노드에 있어도 찾을 수 있게 한다.
 */
export function scanText(text: string, state: ScanState, lookahead = ''): Piece[] {
  const pieces: Piece[] = [];
  let buffer = '';
  let bufferRole: Role = state.closer ? 'dialogue' : state.emph ? 'emph' : 'narration';

  const flush = () => {
    if (buffer) pieces.push({ text: buffer, role: bufferRole });
    buffer = '';
  };
  const switchTo = (role: Role) => {
    if (role !== bufferRole) {
      flush();
      bufferRole = role;
    }
  };

  let index = 0;

  /** 곁말을 닫는 괄호까지(이 조각에서 닫히지 않으면 조각 끝까지) 떼어 낸다 */
  const takeParen = (open: boolean) => {
    flush();
    const from = open ? index + 1 : index;
    const closeAt = text.slice(from).search(PAREN_CLOSE);
    const end = closeAt >= 0 ? from + closeAt + 1 : text.length;
    pieces.push({
      text: text.slice(index, end), role: 'paren',
      parenOpen: open, parenClose: closeAt >= 0,
    });
    state.paren = closeAt < 0;
    bufferRole = state.emph ? 'emph' : 'narration';
    index = end;
  };

  while (index < text.length) {
    const ch = text[index];

    if (state.paren) {
      takeParen(false);
      continue;
    }

    if (state.closer) {
      buffer += ch;
      if (ch === state.closer) {
        state.closer = null;
        flush();
        bufferRole = state.emph ? 'emph' : 'narration';
      }
      index += 1;
      continue;
    }

    const closer = OPEN_QUOTES[ch];
    if (closer && !CLOSE_ONLY.has(ch)) {
      switchTo('dialogue');
      buffer += ch;
      state.closer = closer;
      index += 1;
      continue;
    }

    /*
     * (…) 곁말. *…* 과 같은 규칙으로 '같은 줄에서 닫힐 때만' 본다 —
     * 여는 괄호를 막 입력한 순간 뒷글자가 통째로 작아지지 않게 하기 위함.
     */
    if ((ch === '(' || ch === '\uFF08') && PAREN_CLOSE.test(text.slice(index + 1) + lookahead)) {
      takeParen(true);
      continue;
    }

    if (ch === '*') {
      const marker = text[index + 1] === '*' ? '**' : '*';

      // 기호 자체를 따로 떼어내면 출력에서 이것만 감출 수 있다.
      const takeMarker = () => {
        flush();
        pieces.push({ text: marker, role: 'mark' });
        index += marker.length;
      };

      if (state.emph) {
        takeMarker();
        state.emph = false;
        bufferRole = 'narration';
        continue;
      }

      // 닫는 짝이 같은 줄에 있을 때만 강조로 본다.
      // 그래야 사용자가 여는 기호를 막 입력했을 때 글자가 사라지지 않는다.
      if ((text.slice(index + marker.length) + lookahead).includes(marker)) {
        takeMarker();
        state.emph = true;
        bufferRole = 'emph';
        continue;
      }

      switchTo('narration');
      buffer += marker;
      index += marker.length;
      continue;
    }

    switchTo(state.emph ? 'emph' : 'narration');
    buffer += ch;
    index += 1;
  }

  flush();
  return pieces;
}

/** 블록(줄) 경계를 넘을 때 호출 — 강조·곁말은 줄을 넘기지 않는다. */
export function enterNewBlock(state: ScanState): void {
  state.emph = false;
  state.paren = false;
}

/* ------------------------------------------------------------------ */
/* DOM 마크업                                                          */
/* ------------------------------------------------------------------ */

const CLASS_BY_ROLE: Record<Role, string> = {
  dialogue: 'te-dialogue',
  narration: 'te-narration',
  emph: 'te-emph',
  name: 'te-name',
  mark: 'te-mark',
  paren: 'te-paren',
};

/**
 * 이전에 우리가 씌운 역할 span 을 벗겨낸다.
 *
 * 브라우저는 선택 영역이 역할 span 과 정확히 겹칠 때 새 요소를 만들지 않고
 * 그 span 에 바로 style 을 얹는다. 그래서 그냥 벗겨내면 사용자가 방금 준
 * 볼드·색상이 함께 사라진다 — style 이 남아 있으면 평범한 span 으로 옮겨 살린다.
 */
export function unwrapRoles(root: HTMLElement): void {
  // .te-namesep 은 예전 `이름:` 인식이 남긴 구분 기호 래퍼 — 예전 본문을 열 때 함께 벗긴다.
  const marked = root.querySelectorAll<HTMLElement>(
    '[data-te-role], .te-namesep, .te-quote, .te-paren-mark',
  );
  marked.forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;

    const style = el.getAttribute('style');
    if (style) {
      const keep = document.createElement('span');
      keep.setAttribute('style', style);
      while (el.firstChild) keep.appendChild(el.firstChild);
      parent.replaceChild(keep, el);
      return;
    }

    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  root.normalize();
}

/** 감춰 둔 괄호 기호가 여는 쪽인지 */
export function isOpenParenMark(mark: Element): boolean {
  return /^[(\uFF08]$/.test(mark.textContent ?? '');
}

function markSpan(className: string, text: string): HTMLElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function isBlockBoundary(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = (node as HTMLElement).tagName;
  return tag === 'DIV' || tag === 'P' || tag === 'BR' || tag === 'LI';
}

/**
 * 에디터 안의 텍스트에 역할 span 을 다시 씌운다.
 * 텍스트 노드 단위로만 감싸므로 사용자가 적용해 둔 볼드/색상 등은 유지된다.
 */
/**
 * contenteditable 은 첫 줄을 <div> 로 감싸지 않는다.
 * 줄 단위로 거는 규칙(페이지 나눔 등)이 먹으려면 모든 줄이 요소여야 한다.
 */
function wrapLooseFirstLine(root: HTMLElement): void {
  const loose: Node[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName;
      if (tag === 'DIV' || tag === 'P' || tag === 'LI') break;
      if (tag === 'BR') { loose.push(node); break; }
    }
    loose.push(node);
  }
  if (loose.length === 0) return;
  if (loose.length === 1 && loose[0].nodeType === Node.ELEMENT_NODE
    && (loose[0] as HTMLElement).tagName === 'BR') return;

  const line = document.createElement('div');
  root.insertBefore(line, loose[0]);
  loose.forEach((node) => line.appendChild(node));
}

export function markupRoles(root: HTMLElement): void {
  unwrapRoles(root);
  wrapLooseFirstLine(root);

  const state = createScanState();
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      // 말풍선·대본의 이름표는 우리가 붙인 표지지 사용자가 쓴 글이 아니다.
      acceptNode: (node) => (
        node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset?.teLabel === 'true'
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT
      ),
    },
  );
  const textNodes: Text[] = [];
  const boundaries = new Set<Text>();
  let pendingBoundary = true;

  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      if (text.data.length > 0) {
        textNodes.push(text);
        if (pendingBoundary) boundaries.add(text);
        pendingBoundary = false;
      }
    } else if (isBlockBoundary(node)) {
      pendingBoundary = true;
    }
    node = walker.nextNode();
  }

  // 같은 줄에서 각 노드 뒤에 오는 글 — 닫는 짝이 다른 노드에 있어도 찾을 수 있게.
  const lookaheads: string[] = new Array(textNodes.length);
  let rest = '';
  for (let i = textNodes.length - 1; i >= 0; i -= 1) {
    lookaheads[i] = rest;
    rest = boundaries.has(textNodes[i]) ? '' : textNodes[i].data + rest;
  }

  for (const [nodeIndex, textNode] of textNodes.entries()) {
    // 따옴표가 닫히지 않은 채 줄이 바뀌면, 이 줄의 첫 대사는 앞 줄에서 이어진 것이다.
    let carriedOver = false;
    if (boundaries.has(textNode)) {
      carriedOver = state.closer !== null;
      enterNewBlock(state);
    }
    const pieces = scanText(textNode.data, state, lookaheads[nodeIndex]);
    if (pieces.length === 0) continue;

    const fragment = document.createDocumentFragment();
    let first = true;
    for (const piece of pieces) {
      // 서술까지 span 으로 감싼다 — 역할별로 색·크기를 따로 주려면
      // 모든 조각이 CSS 로 잡혀야 하기 때문.
      const span = document.createElement('span');
      span.className = CLASS_BY_ROLE[piece.role];
      span.dataset.teRole = piece.role;
      if (piece.role === 'dialogue' && carriedOver && first) span.dataset.teCont = 'true';
      first = false;

      // 대사의 따옴표는 따로 감싼다 (따로 다룰 수 있도록).
      if (piece.role === 'dialogue') {
        let text = piece.text;
        if (OPEN_QUOTES[text[0]]) {
          span.appendChild(markSpan('te-quote', text[0]));
          text = text.slice(1);
        }
        const tail = text[text.length - 1];
        const hasTail = text.length > 0 && (CLOSE_ONLY.has(tail) || tail === '"');
        if (hasTail) text = text.slice(0, -1);
        span.appendChild(document.createTextNode(text));
        if (hasTail) span.appendChild(markSpan('te-quote', tail));
      } else if (piece.role === 'paren') {
        // 괄호 기호만 따로 감싸 둔다 — 글은 남기고 기호만 감출 수 있게.
        // 괄호 안에 서식이 있으면 곁말이 여러 조각으로 나뉘어, 기호는 첫·끝 조각에만 있다.
        const body = piece.text.slice(piece.parenOpen ? 1 : 0, piece.parenClose ? -1 : undefined);
        if (piece.parenOpen) span.appendChild(markSpan('te-paren-mark', piece.text[0]));
        if (body) span.appendChild(document.createTextNode(body));
        if (piece.parenClose) span.appendChild(markSpan('te-paren-mark', piece.text[piece.text.length - 1]));
      } else {
        span.textContent = piece.text;
      }

      fragment.appendChild(span);
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}

/**
 * 빈 줄을 정리한다. 문단 사이 간격은 '문단 간격' 옵션이 담당하므로,
 * 붙여넣은 글의 빈 줄까지 그대로 두면 간격이 두 배로 벌어진다.
 */
export function collapseBlankLines(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line !== '')
    .join('\n');
}
