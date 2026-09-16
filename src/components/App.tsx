import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { installAllFonts } from '../lib/fonts';
import { History } from '../lib/history';
import { collectCharacters } from '../lib/parse';
import { useStore } from '../store';
import { Editor, readPlainText } from './Editor';
import { Preview } from './Preview';
import { SelectionPopup } from './SelectionPopup';
import { IconMoon, IconRedo, IconSun, IconUndo } from './icons';
import { Workspace } from './Workspace';
import { Stickers } from './Stickers';

const ZOOM_STEPS = [0.25, 0.4, 0.5, 0.65, 0.8, 1, 1.25, 1.5, 2, 3];

export function App() {
  const {
    settings, set, setSettings, initialContent, saveContent, setSelectedSticker, saveError,
  } = useStore();
  const [editorRoot, setEditorRoot] = useState<HTMLDivElement | null>(null);
  const [captureNode, setCaptureNode] = useState<HTMLDivElement | null>(null);
  const [stageNode, setStageNode] = useState<HTMLElement | null>(null);
  const [plainText, setPlainText] = useState('');
  /** 확대한 미리보기가 차지할 자리를 잡으려면 실제 높이를 알아야 한다. */
  const [previewHeight, setPreviewHeight] = useState(0);
  const saveTimer = useRef<number | undefined>(undefined);

  /**
   * 에디터는 테마를 바꿀 때 언마운트된다. 가장 최근 내용을 여기에 담아 두고
   * 다시 마운트될 때 그대로 돌려줘야 편집한 본문과 서식이 살아남는다.
   */
  const liveHtml = useRef(initialContent);

  /* 되돌리기 — 본문과 설정을 한 덩어리로 묶어 함께 되돌린다 */
  const history = useRef(new History()).current;
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  const pushTimer = useRef<number | undefined>(undefined);
  const editorRootRef = useRef<HTMLDivElement | null>(null);

  const refreshHistoryButtons = useCallback(() => {
    setHistoryState({ undo: history.canUndo, redo: history.canRedo });
  }, [history]);

  const recordHistory = useCallback(() => {
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      if (history.push({ html: liveHtml.current, settings })) refreshHistoryButtons();
    }, 450);
  }, [history, settings, refreshHistoryButtons]);

  const applySnapshot = useCallback((snapshot: ReturnType<History['undo']>) => {
    if (!snapshot) return;
    history.restoring = true;
    liveHtml.current = snapshot.html;
    const root = editorRootRef.current;
    if (root) {
      root.innerHTML = snapshot.html;
      setPlainText(readPlainText(root));
    }
    setSettings(() => snapshot.settings);
    saveContent(snapshot.html);
    refreshHistoryButtons();
    window.setTimeout(() => { history.restoring = false; }, 120);
  }, [history, setSettings, saveContent, refreshHistoryButtons]);

  const undo = useCallback(() => applySnapshot(history.undo()), [applySnapshot, history]);
  const redo = useCallback(() => applySnapshot(history.redo()), [applySnapshot, history]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // 설정이 바뀌어도 기록을 남긴다 (사이드바 서식까지 되돌리기 위함)
  useEffect(() => { recordHistory(); }, [settings, recordHistory]);
  useEffect(() => () => window.clearTimeout(pushTimer.current), []);

  const detectedNames = useMemo(() => collectCharacters(plainText), [plainText]);

  const handleHtmlChange = useCallback((html: string) => {
    liveHtml.current = html;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveContent(html), 600);
    recordHistory();
  }, [saveContent, recordHistory]);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  // 앱 테마는 최상위 요소에 건다 — body 를 포함한 모든 색이 함께 바뀌도록.
  useEffect(() => {
    document.documentElement.dataset.appTheme = settings.appTheme;
  }, [settings.appTheme]);

  // 저장해 둔 사용자 글꼴을 문서에 다시 심는다.
  useEffect(() => { void installAllFonts(settings.customFonts); }, [settings.customFonts]);

  /**
   * transform: scale 은 레이아웃 크기를 바꾸지 않는다.
   * 확대한 만큼 자리를 잡아 주지 않으면 미리보기가 아래 도구 막대를 덮어버린다.
   */
  useEffect(() => {
    if (!captureNode) return;
    const observer = new ResizeObserver(() => setPreviewHeight(captureNode.offsetHeight));
    observer.observe(captureNode);
    setPreviewHeight(captureNode.offsetHeight);
    return () => observer.disconnect();
  }, [captureNode]);

  /* 미리보기 확대·축소 */
  const zoom = settings.previewZoom;
  const stepZoom = (direction: 1 | -1) => {
    userSetZoom.current = true;
    const index = ZOOM_STEPS.findIndex((value) => Math.abs(value - zoom) < 0.001);
    const base = index >= 0 ? index : ZOOM_STEPS.indexOf(1);
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, base + direction))];
    set('previewZoom', next);
  };
  /** 작업 영역 폭에 맞춰 배율을 정한다 */
  const zoomToFit = useCallback(() => {
    if (!stageNode) return;
    const available = stageNode.clientWidth - 64;
    set('previewZoom', Math.min(1, Math.max(0.1, available / settings.layout.width)));
  }, [stageNode, set, settings.layout.width]);

  /*
   * 좁은 화면에서는 결과물이 화면을 넘어가 왼쪽이 잘려 보인다.
   * 사용자가 배율을 직접 건드리기 전까지는, 화면이 좁아지면 알아서 맞춘다.
   */
  const userSetZoom = useRef(false);
  useEffect(() => {
    if (!stageNode) return undefined;
    const fitIfNeeded = () => {
      if (userSetZoom.current) return;
      const available = stageNode.clientWidth - 64;
      if (available <= 0) return;
      const needed = Math.min(1, Math.max(0.1, available / settings.layout.width));
      if (Math.abs(needed - settings.previewZoom) > 0.01) set('previewZoom', needed);
    };
    fitIfNeeded();
    const observer = new ResizeObserver(fitIfNeeded);
    observer.observe(stageNode);
    return () => observer.disconnect();
  }, [stageNode, settings.layout.width, settings.previewZoom, set]);

  const isMessenger = settings.theme === 'messenger';
  const isEmpty = plainText.trim().length === 0;

  return (
    <div
      className={`app tools-${settings.sidebarSide}`}
      data-app-theme={settings.appTheme}
    >
      <header className="topbar">
        <span className="brand">텍스트 발췌기</span>

        {/* 테마는 결과물을 통째로 바꾸는 선택이라 가장 잘 보이는 자리에 둔다 */}
        <div className="theme-switch" role="group" aria-label="테마">
          {([['plain', '기본'], ['messenger', '메신저']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={settings.theme === value ? 'is-active' : ''}
              aria-pressed={settings.theme === value}
              onClick={() => set('theme', value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="topbar-right">
          <span className="topbar-hint">
            {isMessenger ? '대사가 말풍선으로 보입니다' : '미리보기에 바로 입력하세요'}
          </span>

          <div className="topbar-tools">
            <button
              type="button"
              className="top-button"
              title="되돌리기 (Ctrl+Z)"
              disabled={!historyState.undo}
              onClick={undo}
            >
              <IconUndo />
            </button>
            <button
              type="button"
              className="top-button"
              title="다시 실행 (Ctrl+Shift+Z)"
              disabled={!historyState.redo}
              onClick={redo}
            >
              <IconRedo />
            </button>
            <span className="top-sep" />
            <button
              type="button"
              className="top-button"
              title={settings.appTheme === 'dark' ? '라이트 모드로' : '다크 모드로'}
              onClick={() => set('appTheme', settings.appTheme === 'dark' ? 'light' : 'dark')}
            >
              {settings.appTheme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </div>
      </header>

      <div className="workarea">
        <Workspace
          editorRoot={editorRoot}
          captureNode={captureNode}
          detectedNames={detectedNames}
        />

        <main className="stage">
          {/* 스크롤은 안쪽에서만 일어나게 해, 확대 막대를 작업 영역 하단에 붙여 둔다 */}
          <div className="stage-scroll" ref={setStageNode}>
            <div className="stage-inner">
              {/* 확대해도 스크롤 범위가 맞도록 배율만큼 자리를 잡아 둔다 */}
              <div
                className="zoom-frame"
                style={{
                  width: settings.layout.width * zoom,
                  height: previewHeight > 0 ? previewHeight * zoom : undefined,
                  ['--preview-zoom' as string]: String(zoom),
                }}
                onPointerDown={(event) => {
                  if (!(event.target as HTMLElement).closest('.sticker')) setSelectedSticker(null);
                }}
              >
                <div className="zoom-inner" style={{ transform: `scale(${zoom})` }}>
                  <Preview settings={settings} captureRef={setCaptureNode}>
                    {/* 메신저는 같은 본문을 말풍선 모양으로 보여줄 뿐이라 에디터는 늘 같은 것을 쓴다 */}
                    <div className="editor-wrap">
                      <Editor
                        initialContent={liveHtml.current}
                        autoParse={settings.autoParse}
                        tidyBlankLines={settings.tidyBlankLines}
                        onRootChange={(node) => { editorRootRef.current = node; setEditorRoot(node); }}
                        onTextChange={setPlainText}
                        onHtmlChange={handleHtmlChange}
                      />
                      {isEmpty ? (
                        <p className="editor-placeholder" data-export-ignore="true">
                          여기에 본문을 붙여넣거나 바로 입력하세요.
                        </p>
                      ) : null}
                    </div>
                    <Stickers zoom={zoom} />
                  </Preview>
                </div>
              </div>

              {/* 처음 열었을 때만 보이는 사용법 — 결과물에는 들어가지 않는다 */}
              {isEmpty ? (
                <ul className="start-tips" data-export-ignore="true">
                  <li><code>이름: "대사"</code> 로 쓰면 이름과 대사를 알아서 구분합니다</li>
                  <li><code>*강조*</code> 는 강조 서술이 되고, 별표는 결과물에서 감춰집니다</li>
                  <li>글자를 드래그하면 색·크기·말풍선을 바꾸는 창이 열립니다</li>
                </ul>
              ) : null}
            </div>
          </div>

          <div className="zoom-bar" data-export-ignore="true">
            <button type="button" onClick={() => stepZoom(-1)} title="축소" disabled={zoom <= ZOOM_STEPS[0]}>−</button>
            <span className="zoom-value">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => stepZoom(1)} title="확대" disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}>+</button>
            <span className="zoom-sep" />
            <button
              type="button"
              onClick={() => { userSetZoom.current = true; set('previewZoom', 1); }}
            >
              100%
            </button>
            <button type="button" onClick={() => { userSetZoom.current = false; zoomToFit(); }}>
              화면 맞춤
            </button>
          </div>

          <SelectionPopup editorRoot={editorRoot} boundary={stageNode} zoom={zoom} />

          {saveError ? (
            <div className="save-warning" role="alert">{saveError}</div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
