export type SidebarSide = 'left' | 'right';
export type AlignX = 'left' | 'center' | 'right' | 'justify';
export type AlignY = 'top' | 'center' | 'bottom';

export interface Typography {
  fontFamily: string;
  fontWeight: number;
  /** 서술(기본) 글자 크기 */
  fontSize: number;
  /** 대사 글자 크기 */
  dialogueFontSize: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphGap: number;
  /** 장평: 가로 폭 배율 (scaleX) */
  horizontalScale: number;
  textAlign: AlignX;
  /** keep-all = 단어 단위 줄바꿈, break-all = 글자 단위 줄바꿈 */
  wordBreak: 'keep-all' | 'break-all';
  indent: number;
}

export interface RoleColors {
  enabled: boolean;
  narration: string;
  dialogue: string;
  name: string;
  /** *…* 로 감싼 강조 서술 */
  emphasis: string;
  emphasisItalic: boolean;
  /** 대사 기울임 */
  dialogueItalic: boolean;
  /** 선택 영역 좌측 세로선의 기본 색 */
  barColor: string;
}

export type BackgroundType = 'solid' | 'gradient' | 'image' | 'video' | 'pattern' | 'ascii';

export type PatternKind = 'dots' | 'check' | 'stars';

export interface Background {
  type: BackgroundType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  /** data: URL 또는 외부 주소 (gif 포함) */
  imageUrl: string;
  imageFit: 'cover' | 'contain' | 'repeat' | 'custom';
  /** imageFit 이 custom 일 때의 가로 크기 (%) */
  imageScale: number;
  /** 배경 이미지 위치 (%) — 드래그로 조절한다 */
  imageX: number;
  imageY: number;
  videoUrl: string;
  /* 패턴 — 바탕은 color, 그 위에 무늬를 깐다 */
  patternKind: PatternKind;
  /** 무늬 크기 배율 (%). 무늬마다 기본 크기가 달라 배율로 맞춘다 */
  patternScale: number;
  patternColor: string;
  patternAngle: number;
  patternOpacity: number;
  /* 아스키 아트 — 바탕은 color */
  asciiUrl: string;
  asciiColor: string;
  /** 가로 글자 수. 클수록 촘촘하고 자세하다 */
  asciiColumns: number;
  asciiFontSize: number;
  asciiContrast: number;
  /** 밝은 곳을 촘촘한 글자로 (어두운 바탕에 밝은 글자일 때) */
  asciiInvert: boolean;
  /** 아스키 아트 가운데의 위치 (%) — 드래그로 조절한다 */
  asciiX: number;
  asciiY: number;
  overlayColor: string;
  overlayOpacity: number;
  blur: number;
}

export type RatioMode = 'auto' | 'fixed';

export interface Layout {
  width: number;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  ratioMode: RatioMode;
  ratioW: number;
  ratioH: number;
  alignY: AlignY;
  radius: number;
  border: PageBorder;
}

export type BorderStyle = 'solid' | 'dashed' | 'longdash' | 'dotted' | 'double' | 'dashdot';

/** 결과물 가장자리를 두르는 테두리. 배경 위 · 글 아래에 깔린다 */
export interface PageBorder {
  enabled: boolean;
  style: BorderStyle;
  color: string;
  opacity: number;
  /** 선 굵기 (px) */
  width: number;
  /** 가장자리에서 안쪽으로 떨어진 거리 (px) */
  inset: number;
}

export interface Meta {
  showTitle: boolean;
  title: string;
  titleSize: number;
  titleColor: string;
  showSubtitle: boolean;
  subtitle: string;
  subtitleSize: number;
  subtitleColor: string;
  showAuthor: boolean;
  author: string;
  authorSize: number;
  authorColor: string;
  /** 제작자는 위치·정렬 모두 제목과 따로 잡는다 */
  authorAlign: Exclude<AlignX, 'justify'>;
  /** 본문 위/아래. 제목과 같은 쪽이면 제작자가 바깥쪽에 온다 */
  authorPosition: 'top' | 'bottom';
  authorGap: number;
  align: Exclude<AlignX, 'justify'>;
  position: 'top' | 'bottom';
  /** 제목 블록과 본문 사이 간격 */
  gap: number;
  /** 제목·부제목 사이 간격 */
  innerGap: number;
}

/** 드래그해서 만드는 말풍선의 겉모양 */
export interface Bubble {
  bubbleRadius: number;
  /** 인물을 고르지 않은 말풍선의 색. 캐릭터는 저마다 제 색을 갖는다 */
  bubbleColor: string;
  showProfile: boolean;
  profileSize: number;
  showName: boolean;
  nameSize: number;
  bubbleMaxWidth: number;
  gap: number;
}

export interface CharacterStyle {
  name: string;
  /** 이름 색 */
  color: string;
  /** 이 캐릭터의 대사 색. 말풍선 안 글자색도 이 값을 쓴다 */
  dialogueColor: string;
  /** 말풍선 색. 비어 있으면 공통 말풍선 색을 쓴다 */
  bubbleColor: string;
  /** data: URL 프로필 이미지. 비어 있으면 이름 색상의 원형으로 대체 */
  avatar: string;
  isMe: boolean;
}

/** 본문 위에 얹는 이미지. 위치·크기는 결과물 너비 대비 % 로 들고 있어 확대·축소에 흔들리지 않는다. */
export interface Sticker {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  rotation: number;
  opacity: number;
}

/** 본문 위·아래·왼쪽·오른쪽에 붙는 이미지 칸 */
export type SlotSide = 'top' | 'bottom' | 'left' | 'right';

export interface ImageSlot {
  enabled: boolean;
  /** data: URL */
  url: string;
  /** 위·아래 칸은 높이, 왼쪽·오른쪽 칸은 너비 (px) */
  size: number;
  /** 왼쪽·오른쪽 칸의 높이 (px). 0 이면 본문 높이에 맞춘다 */
  length: number;
  fit: 'cover' | 'contain' | 'custom';
  /** fit 이 custom 일 때 칸 너비 대비 크기 (%) */
  scale: number;
  /** 이미지 위치 (%) — 배경처럼 드래그로 조절한다 */
  x: number;
  y: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  borderWidth: number;
  borderColor: string;
  radius: number;
  shadow: boolean;
  shadowBlur: number;
  shadowOpacity: number;
}

export interface ImageSlots {
  /** 이미지 슬롯 기능 전체를 켜고 끈다 */
  enabled: boolean;
  top: ImageSlot;
  bottom: ImageSlot;
  left: ImageSlot;
  right: ImageSlot;
}

/** 사용자가 올린 글꼴. 실제 파일은 IndexedDB 에 두고 여기엔 목록만 남긴다. */
export interface CustomFont {
  id: string;
  label: string;
}

/** 나눠 저장할 때 한 장의 비율 (가로:세로). off 면 나누지 않는다 */
export type SplitRatio = 'off' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16' | '4:3' | '16:9';

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'pdf';
  scale: number;
  quality: number;
  fileName: string;
  splitRatio: SplitRatio;
  /** 나눠 저장할 때 장마다 '1 / 5' 를 붙인다 */
  pageNumbers: boolean;
}

export interface Settings {
  sidebarSide: SidebarSide;
  /** 앱 화면(사이드바·작업 영역) 테마. 결과 이미지와는 무관하다. */
  appTheme: 'dark' | 'light';
  /** 사용자가 직접 테마를 고른 적이 있는지. 없으면 기본(라이트)을 따른다 */
  themeChosen: boolean;
  sidebarWidth: number;
  /** 지금 열려 있는 도구 패널. null 이면 모두 닫힘 */
  activePanel: string | null;
  autoParse: boolean;
  /** 붙여넣을 때 빈 줄을 정리해 문단 간격만으로 띄우기 */
  tidyBlankLines: boolean;
  /** 결과물에서 *…* 의 별표를 감춘다 (강조 서식은 그대로) */
  hideEmphasisMarks: boolean;
  /** (…) 안을 대사보다 작은 회색 글씨로 바꾸고 괄호를 감춘다 */
  parenAside: boolean;
  typography: Typography;
  roles: RoleColors;
  background: Background;
  layout: Layout;
  meta: Meta;
  bubble: Bubble;
  characters: Record<string, CharacterStyle>;
  customFonts: CustomFont[];
  stickers: Sticker[];
  imageSlots: ImageSlots;
  /** 미리보기 확대 배율 (결과물 크기와는 무관) */
  previewZoom: number;
  exportOptions: ExportOptions;
}

/** 내보내기/불러오기용 서식 파일 포맷 */
export interface PresetFile {
  kind: 'text-extract-preset';
  version: 1;
  savedAt: string;
  name: string;
  settings: Settings;
}
