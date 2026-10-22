import type { ImageSlot, Settings } from './types';

function slot(size: number): ImageSlot {
  return {
    enabled: false,
    url: '',
    size,
    length: 0,
    fit: 'cover',
    scale: 100,
    x: 50,
    y: 50,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    borderWidth: 0,
    borderColor: '#d8d8de',
    borderStyle: 'solid',
    radius: 0,
    shadow: false,
    shadowBlur: 16,
    shadowOpacity: 0.25,
  };
}

/** 글꼴 목록 — 이름순 (영문 이름이 앞, 한글 이름이 뒤) */
export const FONT_OPTIONS = [
  { label: '프리텐다드 (Pretendard)', value: "'Pretendard Variable', Pretendard, sans-serif" },
  { label: '본고딕 (Noto Sans KR)', value: "'Noto Sans KR', sans-serif" },
  { label: '본명조 (Noto Serif KR)', value: "'Noto Serif KR', serif" },
  { label: '나눔고딕', value: "'Nanum Gothic', sans-serif" },
  { label: '나눔명조', value: "'Nanum Myeongjo', serif" },
  { label: '고운돋움', value: "'Gowun Dodum', sans-serif" },
  { label: '고운바탕', value: "'Gowun Batang', serif" },
  { label: 'IBM Plex Sans KR', value: "'IBM Plex Sans KR', sans-serif" },
  { label: '함렛 (Hahmlet)', value: "'Hahmlet', serif" },
  { label: '어그로체', value: "'Aggravo', sans-serif" },
  { label: 'Mona12', value: "'Mona12', monospace" },
  { label: '갈무리11', value: "'Galmuri11', monospace" },
  { label: '조선굴림체', value: "'JoseonGulim', sans-serif" },
  { label: '이서윤체', value: "'IsYun', sans-serif" },
  { label: '조선일보명조', value: "'ChosunIlboMyungjo', serif" },
  { label: '리디바탕', value: "'Ridibatang', serif" },
  { label: '부크크 명조', value: "'BookkMyungjo', serif" },
  { label: '프리젠테이션', value: "'Presentation', sans-serif" },
].sort((a, b) => a.label.localeCompare(b.label, 'ko'));

export const RATIO_PRESETS = [
  { label: '1:1', w: 1, h: 1 },
  { label: '4:5', w: 4, h: 5 },
  { label: '3:4', w: 3, h: 4 },
  { label: '2:3', w: 2, h: 3 },
  { label: '16:9', w: 16, h: 9 },
  { label: '9:16', w: 9, h: 16 },
];

export const HIGHLIGHT_SWATCHES = [
  '#fff3a3', '#ffd6e0', '#c9f0d6', '#cfe4ff', '#e6d9ff', '#ffe0c2', '#e8e8e8',
];

/*
 * 세로선 색. 하이라이트와 같은 색 갈래를 쓰되 한두 단계 진하게 잡았다.
 * 선은 가늘어서 하이라이트만큼 옅으면 배경에 묻히고,
 * 너무 짙으면 글보다 선이 먼저 눈에 든다.
 */
export const BAR_SWATCHES = [
  '#e8bf4e', '#e8859b', '#5fbf90', '#6ea8e0', '#a086d8', '#e89a5e', '#9aa1af',
];

export const DEFAULT_SETTINGS: Settings = {
  sidebarSide: 'left',
  appTheme: 'light',
  themeChosen: false,
  sidebarWidth: 336,
  activePanel: 'text',
  tidyBlankLines: true,
  hideEmphasisMarks: true,
  parenAside: true,
  typography: {
    fontFamily: "'Pretendard Variable', Pretendard, sans-serif",
    fontWeight: 400,
    fontSize: 17,
    dialogueFontSize: 17,
    lineHeight: 1.85,
    letterSpacing: 0,
    paragraphGap: 14,
    horizontalScale: 1,
    textAlign: 'left',
    wordBreak: 'keep-all',
    indent: 0,
  },
  roles: {
    enabled: true,
    narration: '#3c3c43',
    dialogue: '#1f4f8b',
    name: '#8b5a2b',
    emphasis: '#6b6b76',
    emphasisItalic: true,
    dialogueItalic: false,
  },
  background: {
    type: 'solid',
    color: '#faf8f4',
    gradientFrom: '#fdfcfb',
    gradientTo: '#e2d1c3',
    gradientAngle: 160,
    imageUrl: '',
    imageFit: 'cover',
    imageScale: 100,
    imageX: 50,
    imageY: 50,
    patternKind: 'dots',
    patternScale: 100,
    patternColor: '#c9c2b6',
    patternAngle: 0,
    patternOpacity: 1,
    asciiUrl: '',
    asciiColor: '#8a8478',
    asciiColumns: 90,
    asciiFontSize: 8,
    asciiContrast: 1.2,
    asciiInvert: false,
    asciiX: 50,
    asciiY: 50,
    overlayColor: '#000000',
    overlayOpacity: 0,
    blur: 0,
  },
  layout: {
    width: 720,
    padTop: 56,
    padRight: 48,
    padBottom: 56,
    padLeft: 48,
    ratioMode: 'auto',
    ratioW: 4,
    ratioH: 5,
    alignY: 'top',
    radius: 8,
    border: {
      enabled: false,
      style: 'solid',
      color: '#3c3c43',
      opacity: 0.6,
      width: 1.5,
      inset: 16,
    },
  },
  meta: {
    showTitle: false,
    title: '',
    titleSize: 26,
    titleColor: '#2b2b33',
    showSubtitle: false,
    subtitle: '',
    subtitleSize: 15,
    subtitleColor: '#6b6b76',
    showAuthor: false,
    author: '',
    authorSize: 13,
    authorColor: '#8a8a95',
    authorAlign: 'right',
    authorPosition: 'bottom',
    authorGap: 32,
    align: 'center',
    position: 'top',
    gap: 28,
    innerGap: 6,
  },
  bubble: {
    bubbleRadius: 16,
    bubbleColor: '#ffffff',
    showProfile: true,
    profileSize: 30,
    showName: true,
    nameSize: 15,
    bubbleMaxWidth: 72,
    gap: 14,
  },
  characters: {},
  customFonts: [],
  stickers: [],
  imageSlots: {
    enabled: false,
    // 위·아래는 높이, 왼쪽·오른쪽은 너비
    top: { ...slot(180), marginBottom: 24 },
    bottom: { ...slot(180), marginTop: 24 },
    left: { ...slot(160), marginRight: 24 },
    right: { ...slot(160), marginLeft: 24 },
  },
  previewZoom: 1,
  exportOptions: {
    format: 'png',
    scale: 2,
    quality: 0.95,
    fileName: '발췌',
    splitRatio: 'off',
    pageNumbers: true,
  },
};

/** 미리보기는 빈 상태로 시작한다. */
export const SAMPLE_CONTENT = '';

/** 스티커 외곽선·그림자의 기본값 (예전에 올린 스티커에는 이 값들이 없다) */
export const STICKER_LOOK = {
  outline: false,
  outlineColor: '#ffffff',
  outlineWidth: 6,
  shadow: false,
  shadowColor: '#000000',
  shadowOpacity: 0.35,
  shadowDistance: 6,
  shadowBlur: 8,
};
