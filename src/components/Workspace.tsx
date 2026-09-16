import { useRef, type ReactNode } from 'react';
import { useStore } from '../store';
import {
  IconBubble, IconClose, IconFrame, IconHeading, IconImage,
  IconPalette, IconSave, IconText,
} from './icons';
import { TextPanel } from './panels/TextPanel';
import { ColorPanel } from './panels/ColorPanel';
import { BackgroundPanel } from './panels/BackgroundPanel';
import { LayoutPanel } from './panels/LayoutPanel';
import { MetaPanel } from './panels/MetaPanel';
import { ThemePanel } from './panels/ThemePanel';
import { ExportPanel } from './panels/ExportPanel';

export type PanelId =
  | 'meta' | 'text' | 'color' | 'messenger' | 'background' | 'layout' | 'export';

const RAIL: Array<{ id: PanelId; label: string; icon: ReactNode }> = [
  { id: 'meta', label: '제목 · 제작자', icon: <IconHeading /> },
  { id: 'text', label: '본문', icon: <IconText /> },
  { id: 'color', label: '색상', icon: <IconPalette /> },
  { id: 'messenger', label: '말풍선 · 캐릭터', icon: <IconBubble /> },
  { id: 'background', label: '배경', icon: <IconImage /> },
  { id: 'layout', label: '이미지 영역', icon: <IconFrame /> },
  { id: 'export', label: '저장 · 설정', icon: <IconSave /> },
];

const MIN_PANEL = 280;
const MAX_PANEL = 640;

interface WorkspaceProps {
  editorRoot: HTMLElement | null;
  captureNode: HTMLElement | null;
  detectedNames: string[];
}

/** 아이콘 레일 + 열려 있는 패널 하나. 포토샵처럼 필요한 것만 꺼내 쓴다. */
export function Workspace({ editorRoot, captureNode, detectedNames }: WorkspaceProps) {
  const { settings, set } = useStore();
  const active = settings.activePanel;
  const current = RAIL.find((item) => item.id === active);

  /* 패널 폭 드래그 */
  const dragging = useRef(false);

  const body = (() => {
    switch (active) {
      case 'text': return <TextPanel editorRoot={editorRoot} />;
      case 'color': return <ColorPanel />;
      case 'background': return <BackgroundPanel />;
      case 'layout': return <LayoutPanel />;
      case 'meta': return <MetaPanel />;
      case 'messenger': return <ThemePanel detectedNames={detectedNames} />;
      case 'export': return <ExportPanel captureNode={captureNode} editorRoot={editorRoot} />;
      default: return null;
    }
  })();

  return (
    <>
      <nav className="rail" aria-label="도구">
        {RAIL.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rail-button${active === item.id ? ' is-active' : ''}`}
            aria-pressed={active === item.id}
            onClick={() => set('activePanel', active === item.id ? null : item.id)}
          >
            {item.icon}
            <span className="rail-tip">{item.label}</span>
            {item.id === 'messenger' && detectedNames.length > 0 ? (
              <span className="rail-dot" />
            ) : null}
          </button>
        ))}

      </nav>

      {current ? (
        <section className="dock" style={{ width: settings.sidebarWidth }}>
          <header className="dock-head">
            <h2>{current.label}</h2>
            <button
              type="button"
              className="dock-close"
              title="패널 닫기"
              onClick={() => set('activePanel', null)}
            >
              <IconClose />
            </button>
          </header>
          <div className="dock-body">{body}</div>

          <div
            className="dock-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="패널 너비 조절"
            onPointerDown={(event) => {
              dragging.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!dragging.current) return;
              const next = settings.sidebarSide === 'left'
                ? event.clientX - 56
                : window.innerWidth - event.clientX - 56;
              set('sidebarWidth', Math.round(Math.min(MAX_PANEL, Math.max(MIN_PANEL, next))));
            }}
            onPointerUp={(event) => {
              dragging.current = false;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onDoubleClick={() => set('sidebarWidth', 336)}
          />
        </section>
      ) : null}
    </>
  );
}
