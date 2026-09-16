import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../store';
import { ensureWebFont } from '../lib/webfonts';
import type { Settings } from '../types';

function escapeAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** 캐릭터별 색상·말풍선을 동적 CSS 규칙으로 만든다. */
function characterCss(settings: Settings): string {
  const { characters, roles, theme } = settings;
  if (!roles.enabled) return '';

  return Object.values(characters)
    .map((character) => {
      const name = escapeAttr(character.name);
      const rules = [
        `.te-capture [data-te-role="name"][data-te-speaker="${name}"]{color:var(--te-ink,${character.color});}`,
      ];
      if (character.dialogueColor) {
        rules.push(
          `.te-capture [data-te-role="dialogue"][data-te-speaker="${name}"]{color:var(--te-ink,${character.dialogueColor});}`,
        );
      }

      const msgBubble = `.messenger-mode [data-te-role="dialogue"][data-te-speaker="${name}"]`;

      if (theme === 'messenger') {
        // '내 쪽' 기본 모양이 먼저, 캐릭터가 따로 정한 색이 나중 — 뒤에 온 규칙이 이긴다.
        if (character.isMe) {
          /*
           * 줄 전체를 text-align 으로 밀면 말풍선 아래 딸린 글까지 오른쪽으로 간다.
           * 말풍선과 이름만 옮기도록 각각에 건다.
           * 이름줄은 통째로 좌우를 뒤집어 (프로필)이름 이 아니라 이름(프로필) 이 되게 한다 —
           * row-reverse 에서는 main-start 가 오른쪽이라 flex-start 가 오른쪽 끝이다.
           */
          rules.push(
            `${msgBubble}{margin-left:auto;margin-right:0;`
            + `border-top-left-radius:var(--msg-radius);border-top-right-radius:var(--msg-tail);}`,
            `.messenger-mode [data-te-role="name"][data-te-speaker="${name}"]`
            + `{justify-content:flex-start;flex-direction:row-reverse;}`,
            `.messenger-mode.msg-profile [data-te-role="dialogue"][data-te-speaker="${name}"]`
            + `{margin-right:calc(var(--msg-avatar) + 8px);}`,
            `${msgBubble}{background:var(--msg-my-bubble);color:var(--te-ink,var(--msg-my-bubble-text));}`,
          );
        }
        if (character.bubbleColor) {
          rules.push(`${msgBubble}{background:${character.bubbleColor};}`);
        }
        if (character.bubbleTextColor) {
          rules.push(`${msgBubble}{color:var(--te-ink,${character.bubbleTextColor});}`);
        }
        if (character.avatar) {
          rules.push(
            `.messenger-mode [data-te-role="name"][data-te-speaker="${name}"]::before`
            + `{background-image:url("${character.avatar}");}`,
          );
        }
      }
      return rules.join('');
    })
    .join('');
}

function backgroundLayer(settings: Settings): ReactNode {
  const bg = settings.background;
  const spread = bg.blur > 0 ? -(bg.blur * 2 + 8) : 0;
  const base: CSSProperties = {
    position: 'absolute',
    inset: `${spread}px`,
    filter: bg.blur > 0 ? `blur(${bg.blur}px)` : undefined,
  };

  switch (bg.type) {
    case 'gradient':
      return (
        <div
          className="bg-layer"
          style={{ ...base, background: `linear-gradient(${bg.gradientAngle}deg, ${bg.gradientFrom}, ${bg.gradientTo})` }}
        />
      );
    case 'image':
      if (!bg.imageUrl) return <div className="bg-layer" style={{ ...base, background: bg.color }} />;
      return (
        <div
          className="bg-layer"
          style={{
            ...base,
            backgroundColor: bg.color,
            backgroundImage: `url("${bg.imageUrl}")`,
            backgroundSize: bg.imageFit === 'repeat'
              ? 'auto'
              : bg.imageFit === 'custom' ? `${bg.imageScale}% auto` : bg.imageFit,
            backgroundRepeat: bg.imageFit === 'repeat' ? 'repeat' : 'no-repeat',
            backgroundPosition: `${bg.imageX}% ${bg.imageY}%`,
          }}
        />
      );
    case 'video':
      if (!bg.videoUrl) return <div className="bg-layer" style={{ ...base, background: bg.color }} />;
      return (
        <div className="bg-layer" style={{ ...base, backgroundColor: bg.color, overflow: 'hidden' }}>
          <video
            src={bg.videoUrl}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      );
    default:
      return <div className="bg-layer" style={{ ...base, background: bg.color }} />;
  }
}

/** 제목 + 부제목. 본문 서식(글꼴·자간·행간·장평)을 그대로 물려받는다. */
function TitleBlock({ settings }: { settings: Settings }) {
  const { meta } = settings;
  const visible = (meta.showTitle && meta.title) || (meta.showSubtitle && meta.subtitle);
  if (!visible) return null;

  const spacing = meta.position === 'top'
    ? { marginBottom: `${meta.gap}px` }
    : { marginTop: `${meta.gap}px` };

  return (
    <div className="meta-block" style={{ textAlign: meta.align, gap: `${meta.innerGap}px`, ...spacing }}>
      {meta.showTitle && meta.title ? (
        <div className="meta-title" style={{ fontSize: `${meta.titleSize}px`, color: meta.titleColor }}>
          {meta.title}
        </div>
      ) : null}
      {meta.showSubtitle && meta.subtitle ? (
        <div className="meta-subtitle" style={{ fontSize: `${meta.subtitleSize}px`, color: meta.subtitleColor }}>
          {meta.subtitle}
        </div>
      ) : null}
    </div>
  );
}

/** 제작자는 위치도 정렬도 제목과 따로 잡는다. */
function AuthorBlock({ settings }: { settings: Settings }) {
  const { meta } = settings;
  if (!meta.showAuthor || !meta.author) return null;
  // 간격은 본문을 바라보는 쪽에만 준다
  const spacing = meta.authorPosition === 'top'
    ? { marginBottom: `${meta.authorGap}px` }
    : { marginTop: `${meta.authorGap}px` };
  return (
    <div
      className="meta-author"
      style={{
        fontSize: `${meta.authorSize}px`,
        color: meta.authorColor,
        textAlign: meta.authorAlign,
        ...spacing,
      }}
    >
      {meta.author}
    </div>
  );
}

interface PreviewProps {
  settings: Settings;
  captureRef: (node: HTMLDivElement | null) => void;
  children: ReactNode;
}

export function Preview({ settings, captureRef, children }: PreviewProps) {
  const { layout, typography, roles, background, meta } = settings;
  const { patch, adjustingImage } = useStore();
  const scale = typography.horizontalScale;
  const drag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const css = useMemo(() => characterCss(settings), [settings]);

  // 고른 본문 글꼴만 받아 온다 (미리 여덟 벌을 받아 두지 않는다)
  useEffect(() => { ensureWebFont(typography.fontFamily); }, [typography.fontFamily]);

  const canAdjust = adjustingImage && background.type === 'image' && Boolean(background.imageUrl);

  const frameStyle: CSSProperties = {
    width: `${layout.width}px`,
    minHeight: layout.ratioMode === 'fixed'
      ? `${Math.round((layout.width * layout.ratioH) / layout.ratioW)}px`
      : undefined,
    borderRadius: `${layout.radius}px`,
    // 역할 서식은 CSS 변수로 넘겨 다시 파싱하지 않고도 즉시 반영되게 한다.
    ['--te-narration' as string]: roles.narration,
    ['--te-dialogue' as string]: roles.dialogue,
    ['--te-name' as string]: roles.name,
    ['--te-emph' as string]: roles.emphasis,
    ['--te-emph-style' as string]: roles.emphasisItalic ? 'italic' : 'normal',
    ['--te-dialogue-style' as string]: roles.dialogueItalic ? 'italic' : 'normal',
    ['--te-dialogue-size' as string]: `${typography.dialogueFontSize}px`,
    ['--te-paragraph-gap' as string]: `${typography.paragraphGap}px`,
    // 메신저 모드 — 같은 본문을 말풍선 모양으로만 다르게 보여준다
    ['--msg-radius' as string]: `${settings.messenger.bubbleRadius}px`,
    ['--msg-bubble' as string]: settings.messenger.bubbleColor,
    ['--msg-bubble-text' as string]: settings.messenger.bubbleTextColor,
    ['--msg-my-bubble' as string]: settings.messenger.myBubbleColor,
    ['--msg-my-bubble-text' as string]: settings.messenger.myBubbleTextColor,
    ['--msg-name-size' as string]: `${settings.messenger.nameSize}px`,
    ['--msg-avatar' as string]: `${settings.messenger.profileSize}px`,
    ['--msg-max' as string]: `${settings.messenger.bubbleMaxWidth}%`,
    ['--msg-gap' as string]: `${settings.messenger.gap}px`,
    // 꼬리 쪽 모서리는 아예 각지게 — 조금이라도 둥글리면 꼬리로 보이지 않는다
    ['--msg-tail' as string]: '0px',
  };

  const contentStyle: CSSProperties = {
    paddingTop: `${layout.padTop}px`,
    paddingRight: `${layout.padRight}px`,
    paddingBottom: `${layout.padBottom}px`,
    paddingLeft: `${layout.padLeft}px`,
    justifyContent: layout.alignY === 'top' ? 'flex-start' : layout.alignY === 'center' ? 'center' : 'flex-end',
  };

  const typeStyle: CSSProperties = {
    fontFamily: typography.fontFamily,
    fontWeight: typography.fontWeight,
    fontSize: `${typography.fontSize}px`,
    lineHeight: typography.lineHeight,
    letterSpacing: `${typography.letterSpacing}px`,
    textAlign: typography.textAlign,
    wordBreak: typography.wordBreak,
    overflowWrap: typography.wordBreak === 'break-all' ? 'anywhere' : 'break-word',
    textIndent: `${typography.indent}px`,
    /*
     * '서술 색' 은 본문의 바탕색이기도 하다.
     * 대사 구분을 끄면 역할 span 이 없어 이 색만 남는데, 예전에는 여기서
     * 고정색으로 떨어져 서술 색을 바꿔도 아무 일도 일어나지 않았다.
     */
    color: roles.narration,
  };

  // 장평: 넓은 폭으로 줄바꿈을 계산한 뒤 가로로 눌러 실제 폭에 맞춘다.
  const scaleStyle: CSSProperties = scale === 1
    ? {}
    : { width: `${100 / scale}%`, transform: `scaleX(${scale})`, transformOrigin: '0 0' };

  return (
    <div
      ref={captureRef}
      className={[
        'te-capture',
        roles.enabled ? '' : 'roles-off',
        settings.hideEmphasisMarks ? 'hide-marks' : '',
        settings.theme === 'messenger' ? 'messenger-mode' : '',
        settings.theme === 'messenger' ? `msg-narration-${settings.messenger.narrationStyle}` : '',
        // 이름·프로필 표시 여부는 드래그 말풍선도 따르므로 테마를 가리지 않는다
        settings.messenger.showProfile ? 'msg-profile' : '',
        settings.messenger.showName ? 'msg-name' : '',
      ].filter(Boolean).join(' ')}
      style={frameStyle}
    >
      {css ? <style>{css}</style> : null}
      {backgroundLayer(settings)}
      {canAdjust ? (
        <div
          className="bg-drag"
          data-export-ignore="true"
          title="드래그해서 위치를, 휠을 굴려 크기를 조절하세요"
          onWheel={(event) => {
            event.preventDefault();
            /*
             * 크기는 '직접 크기 지정' 일 때만 뜻이 있다.
             * 꽉 채우기 상태에서 휠을 굴리면 그 자리에서 직접 지정으로 넘어간다
             * (100% = 지금 보이는 너비라 크기가 튀지 않는다).
             */
            const custom = background.imageFit === 'custom';
            const base = custom ? background.imageScale : 100;
            const next = Math.min(400, Math.max(10, base * (event.deltaY > 0 ? 0.94 : 1.06)));
            patch('background', {
              imageFit: 'custom',
              imageScale: Math.round(next),
            });
          }}
          onPointerDown={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            drag.current = { x: event.clientX, y: event.clientY, w: box.width, h: box.height };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start) return;
            // background-position 은 값이 커질수록 이미지가 왼쪽·위로 간다.
            // 끄는 방향과 이미지가 같이 움직이도록 부호를 뒤집는다.
            const dx = ((event.clientX - start.x) / start.w) * 100;
            const dy = ((event.clientY - start.y) / start.h) * 100;
            drag.current = { ...start, x: event.clientX, y: event.clientY };
            patch('background', {
              imageX: Math.min(100, Math.max(0, background.imageX - dx)),
              imageY: Math.min(100, Math.max(0, background.imageY - dy)),
            });
          }}
          onPointerUp={(event) => {
            drag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { drag.current = null; }}
        >
          <span className="bg-drag-badge">
            배경 조절 중 — 드래그로 위치, 휠로 크기
            {background.imageFit === 'custom' ? ` · ${Math.round(background.imageScale)}%` : ''}
          </span>
        </div>
      ) : null}
      {background.overlayOpacity > 0 ? (
        <div
          className="bg-overlay"
          style={{ background: background.overlayColor, opacity: background.overlayOpacity }}
        />
      ) : null}

      <div className="te-content" style={contentStyle}>
        {/* 제목·제작자도 장평과 본문 서식을 함께 받도록 같은 래퍼 안에 둔다 */}
        <div className="te-scale" style={scaleStyle}>
          <div className="te-type" style={typeStyle}>
            {/* 제목과 제작자가 같은 쪽이면 제작자를 바깥쪽에 둔다 */}
            {meta.authorPosition === 'top' ? <AuthorBlock settings={settings} /> : null}
            {meta.position === 'top' ? <TitleBlock settings={settings} /> : null}
            {children}
            {meta.position === 'bottom' ? <TitleBlock settings={settings} /> : null}
            {meta.authorPosition === 'bottom' ? <AuthorBlock settings={settings} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
