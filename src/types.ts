export type SidebarSide = 'left' | 'right';
export type ThemeId = 'plain' | 'messenger';
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

export type BackgroundType = 'solid' | 'gradient' | 'image' | 'video';

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

export interface Messenger {
  bubbleRadius: number;
  bubbleColor: string;
  bubbleTextColor: string;
  myBubbleColor: string;
  myBubbleTextColor: string;
  showProfile: boolean;
  profileSize: number;
  showName: boolean;
  nameSize: number;
  bubbleMaxWidth: number;
  gap: number;
  narrationStyle: 'plain' | 'muted' | 'hidden';
}

export interface CharacterStyle {
  name: string;
  /** 이름 색 */
  color: string;
  /** 이 캐릭터의 대사 색. 비어 있으면 공통 대사 색을 쓴다 */
  dialogueColor: string;
  /** 말풍선 색. 비어 있으면 공통 말풍선 색을 쓴다 */
  bubbleColor: string;
  bubbleTextColor: string;
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

/** 사용자가 올린 글꼴. 실제 파일은 IndexedDB 에 두고 여기엔 목록만 남긴다. */
export interface CustomFont {
  id: string;
  label: string;
}

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'pdf';
  scale: number;
  quality: number;
  fileName: string;
}

export interface Settings {
  sidebarSide: SidebarSide;
  /** 앱 화면(사이드바·작업 영역) 테마. 결과 이미지와는 무관하다. */
  appTheme: 'dark' | 'light';
  sidebarWidth: number;
  /** 지금 열려 있는 도구 패널. null 이면 모두 닫힘 */
  activePanel: string | null;
  theme: ThemeId;
  autoParse: boolean;
  /** 붙여넣을 때 빈 줄을 정리해 문단 간격만으로 띄우기 */
  tidyBlankLines: boolean;
  /** 결과물에서 *…* 의 별표를 감춘다 (강조 서식은 그대로) */
  hideEmphasisMarks: boolean;
  typography: Typography;
  roles: RoleColors;
  background: Background;
  layout: Layout;
  meta: Meta;
  messenger: Messenger;
  characters: Record<string, CharacterStyle>;
  customFonts: CustomFont[];
  stickers: Sticker[];
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
