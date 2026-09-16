/**
 * 대사 / 서술 인식 규칙
 *  - 따옴표( " “ ” 「」 『』 ) 안의 텍스트는 대사. 줄바꿈을 넘어가도 닫힐 때까지 대사로 본다.
 *  - *…* 또는 **…** 안의 텍스트는 강조 서술.
 *  - 그 외 텍스트는 서술.
 *  - 줄 머리의 `이름:` 은 캐릭터 이름으로 본다.
 */

const OPEN_QUOTES: Record<string, string> = {
  '"': '"',
  '“': '”', // “ ”
  '「': '」', // 「 」
  '『': '』', // 『 』
};
/** 닫는 문자로만 쓰이는 따옴표 — 단독으로 나오면 서술로 흘려보낸다 */
const CLOSE_ONLY = new Set(['\u201D', '\u300D', '\u300F']);

/** 줄 머리 캐릭터 이름: `세인:` / `세인 :` — 이름은 20자 이내, 따옴표를 포함하지 않는다 */
const NAME_RE = /^([^\n:："'“”]{1,20})\s*[:：]/;

export type Role = 'dialogue' | 'narration' | 'emph' | 'name' | 'mark';

interface Piece {
  text: string;
  role: Role;
  /** 이 조각이 속한 화자 (캐릭터별 색상 적용용) */
  speaker?: string;
}

interface ScanState {
  /** 열려 있는 따옴표의 닫는 문자. null 이면 대사 밖 */
  closer: string | null;
  /** *…* 강조가 열려 있는지 */
  emph: boolean;
  /** 현재 블록(줄)의 시작 부분인지 — 캐릭터 이름 판정용 */
  atLineStart: boolean;
  /** 가장 최근에 등장한 캐릭터 이름 */
  speaker: string;
}

export function createScanState(): ScanState {
  return { closer: null, emph: false, atLineStart: true, speaker: '' };
}

/**
 * 한 텍스트 조각을 역할별로 쪼갠다. state 는 호출 간에 이어지며,
 * 따옴표가 여러 줄에 걸쳐 열려 있는 상황을 그대로 반영한다.
 */
export function scanText(text: string, state: ScanState): Piece[] {
  const pieces: Piece[] = [];
  let buffer = '';
  let bufferRole: Role = state.closer ? 'dialogue' : state.emph ? 'emph' : 'narration';

  const flush = () => {
    if (buffer) pieces.push({ text: buffer, role: bufferRole, speaker: state.speaker });
    buffer = '';
  };
  const switchTo = (role: Role) => {
    if (role !== bufferRole) {
      flush();
      bufferRole = role;
    }
  };

  // 줄 머리 캐릭터 이름 (대사 밖일 때만)
  let index = 0;
  if (state.atLineStart && !state.closer && !state.emph) {
    const match = NAME_RE.exec(text);
    if (match && match[1].trim()) {
      state.speaker = match[1].trim();
      pieces.push({ text: match[0], role: 'name', speaker: state.speaker });
      index = match[0].length;
    }
  }
  if (text.length > 0) state.atLineStart = false;

  while (index < text.length) {
    const ch = text[index];

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

    if (ch === '*') {
      const marker = text[index + 1] === '*' ? '**' : '*';

      // 기호 자체를 따로 떼어내면 출력에서 이것만 감출 수 있다.
      const takeMarker = () => {
        flush();
        pieces.push({ text: marker, role: 'mark', speaker: state.speaker });
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
      if (text.slice(index + marker.length).includes(marker)) {
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

/** 블록(줄) 경계를 넘을 때 호출 — 강조는 줄을 넘기지 않고, 이름 판정은 다시 켠다. */
export function enterNewBlock(state: ScanState): void {
  state.emph = false;
  state.atLineStart = true;
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
};

/**
 * 이전에 우리가 씌운 역할 span 을 벗겨낸다.
 *
 * 브라우저는 선택 영역이 역할 span 과 정확히 겹칠 때 새 요소를 만들지 않고
 * 그 span 에 바로 style 을 얹는다. 그래서 그냥 벗겨내면 사용자가 방금 준
 * 볼드·색상이 함께 사라진다 — style 이 남아 있으면 평범한 span 으로 옮겨 살린다.
 */
export function unwrapRoles(root: HTMLElement): void {
  // 이름 구분 기호 래퍼도 함께 벗긴다 — 남겨 두면 `이름:` 패턴이 끊겨 다시 인식되지 않는다.
  const marked = root.querySelectorAll<HTMLElement>('[data-te-role], .te-namesep, .te-quote');
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
 * 줄 단위로 거는 규칙(메신저 오른쪽 정렬, 페이지 나눔)이 먹으려면 모든 줄이 요소여야 한다.
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
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
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

  for (const textNode of textNodes) {
    // 따옴표가 닫히지 않은 채 줄이 바뀌면, 이 줄의 첫 대사는 앞 줄에서 이어진 것이다.
    let carriedOver = false;
    if (boundaries.has(textNode)) {
      carriedOver = state.closer !== null;
      enterNewBlock(state);
    }
    const pieces = scanText(textNode.data, state);
    if (pieces.length === 0) continue;

    const fragment = document.createDocumentFragment();
    let first = true;
    for (const piece of pieces) {
      // 서술까지 span 으로 감싼다 — 메신저 모드에서 역할별로 다르게 보여주려면
      // 모든 조각이 CSS 로 잡혀야 하기 때문.
      const span = document.createElement('span');
      span.className = CLASS_BY_ROLE[piece.role];
      span.dataset.teRole = piece.role;
      if (piece.speaker) span.dataset.teSpeaker = piece.speaker;
      if (piece.role === 'dialogue' && carriedOver && first) span.dataset.teCont = 'true';
      first = false;

      // `이름:` 의 구분 기호와 대사의 따옴표는 따로 감싼다.
      // 메신저 말풍선에서는 이름과 대사만 보여야 하기 때문이다.
      const separator = piece.role === 'name' ? /([:：]\s*)$/.exec(piece.text) : null;
      if (separator) {
        span.appendChild(document.createTextNode(piece.text.slice(0, separator.index)));
        span.appendChild(markSpan('te-namesep', separator[1]));
      } else if (piece.role === 'dialogue') {
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
      } else {
        span.textContent = piece.text;
      }

      fragment.appendChild(span);
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}

/* ------------------------------------------------------------------ */
/* 메신저 테마용 구조 파싱                                              */
/* ------------------------------------------------------------------ */

export type Block =
  | { kind: 'dialogue'; name: string; text: string }
  | { kind: 'narration'; text: string };

/** *…* / **…** 강조 기호를 벗겨낸다 (말풍선 뷰는 파생 결과라 기호를 남기지 않는다) */
function stripEmphasis(value: string): string {
  return value.replace(/\*\*([\s\S]+?)\*\*/g, '$1').replace(/\*([\s\S]+?)\*/g, '$1');
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  const closer = first ? OPEN_QUOTES[first] : undefined;
  if (closer && trimmed.endsWith(closer) && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * 평문을 말풍선 단위로 쪼갠다.
 *
 * 본문 인식과 똑같은 스캐너를 쓰므로, 한 줄 안에 대사와 서술이 섞여 있어도
 * (예: `"들어와도 돼." 나는 책을 덮으며 말했다. "어차피…"`) 각각 따로 잡힌다.
 * 따옴표가 줄을 넘어가면 그 대사는 하나의 말풍선으로 이어 붙인다.
 */
export function parseScript(plainText: string): Block[] {
  const blocks: Block[] = [];
  const state = createScanState();
  const lines = plainText.replace(/\r\n?/g, '\n').split('\n');

  let open: { kind: 'dialogue' | 'narration'; name: string; text: string } | null = null;

  const flush = () => {
    if (!open) return;
    const raw = open.text.trim();
    if (raw) {
      if (open.kind === 'dialogue') {
        blocks.push({ kind: 'dialogue', name: open.name, text: stripEmphasis(stripQuotes(raw)) });
      } else {
        // 강조 기호는 그대로 둔다 — 보여줄 때 *…* 부분만 기울여야 하기 때문.
        blocks.push({ kind: 'narration', text: raw });
      }
    }
    open = null;
  };

  for (const rawLine of lines) {
    // 따옴표가 아직 닫히지 않은 채 줄이 바뀌면 같은 말풍선을 이어서 채운다.
    const carriedOver = state.closer !== null;
    enterNewBlock(state);

    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) {
      if (!carriedOver) flush();
      continue;
    }

    if (carriedOver && open) open.text += '\n';
    else flush();

    for (const piece of scanText(line, state)) {
      if (piece.role === 'name') continue;

      const kind = piece.role === 'dialogue' ? 'dialogue' : 'narration';
      const name = piece.speaker ?? '';

      if (open && open.kind === kind && (kind === 'narration' || open.name === name)) {
        open.text += piece.text;
      } else {
        flush();
        open = { kind, name, text: piece.text };
      }
    }
  }

  flush();
  return blocks;
}

/** 본문에 등장하는 캐릭터 이름 목록 */
export function collectCharacters(plainText: string): string[] {
  const names = new Set<string>();
  for (const block of parseScript(plainText)) {
    if (block.kind === 'dialogue' && block.name) names.add(block.name);
  }
  return [...names];
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
