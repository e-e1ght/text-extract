import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../store';
import { ensureWebFont } from '../lib/webfonts';
import type { Settings } from '../types';

function escapeAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** 캐릭터별 색상·말풍선을 동적 CSS 규칙으로 만든다. */
function characterCss(settings: Settings): string {
  const { characters, roles } = settings;
  if (!roles.enabled) return '';

  return Object.values(characters)
    .map((character) => {
      const name = escapeAttr(character.name);
      const bubble = `.te-capture .te-bubble[data-te-speaker="${name}"]`;
      /*
       * 이름 색만은 드래그로 준 색(--te-ink)에 양보하지 않는다.
       *
       * 본문을 통째로 드래그해 색을 바꾸면 이름까지 휩쓸리는데, 그러면 캐릭터
       * 이름 색을 아무리 바꿔도 먹지 않고 되돌릴 방법도 없었다.
       * 이름은 '누가 말하는가' 를 알려 주는 표지라 캐릭터 설정이 정하는 게 맞다.
       * (대사는 그대로 둔다 — 한 문장만 다른 색으로 강조하는 일이 실제로 있다.)
       */
      const rules = [
        `.te-capture [data-te-role="name"][data-te-speaker="${name}"],`
        + `${bubble} .te-bubble-name`
        + `{color:${character.color};}`,
      ];
      if (character.dialogueColor) {
        rules.push(
          `.te-capture [data-te-role="dialogue"][data-te-speaker="${name}"]{color:var(--te-ink,${character.dialogueColor});}`,
        );
      }

      // '내 쪽' 기본 모양이 먼저, 캐릭터가 따로 정한 색이 나중 — 뒤에 온 규칙이 이긴다.
      if (character.isMe) {
        /*
         * 내 쪽은 오른쪽에 붙으므로 이름줄도 통째로 좌우를 뒤집는다.
         * (프로필)이름 이 아니라 이름(프로필) 이라야 오른쪽 끝이 가지런하다.
         * row-reverse 에서는 main-start 가 오른쪽이라 flex-start 가 오른쪽 끝이다.
         */
        rules.push(
          `${bubble}{align-items:flex-end;}`,
          `${bubble} .te-bubble-name{flex-direction:row-reverse;}`,
          `${bubble} .te-bubble-text{`
          + `border-radius:var(--bub-radius) var(--bub-tail) var(--bub-radius) var(--bub-radius);`
          + `background:var(--bub-my-bg);color:var(--te-ink,var(--bub-my-fg));}`,
          `.te-capture.bub-profile ${bubble.slice('.te-capture '.length)} .te-bubble-text`
          + `{margin-left:0;margin-right:calc(var(--bub-avatar) + 8px);}`,
        );
      }
      if (character.bubbleColor) {
        rules.push(`${bubble} .te-bubble-text{background:${character.bubbleColor};}`);
      }
      if (character.bubbleTextColor) {
        rules.push(`${bubble} .te-bubble-text{color:var(--te-ink,${character.bubbleTextColor});}`);
      }
      if (character.avatar) {
        rules.push(`${bubble} .te-bubble-name::before{background-image:url("${character.avatar}");}`);
      }
      /*
       * `이름: "대사"` 를 통째로 드래그해 말풍선으로 만들면 이름이 두 번 나온다
       * (말풍선 이름표 + 본문 속 `이름:`). 같은 인물일 때만 본문 쪽을 감춘다.
       * 뒤따르는 빈칸도 함께 — 남겨 두면 말풍선 글이 한 칸 밀린다.
       */
      rules.push(
        `.te-capture.bub-name ${bubble.slice('.te-capture '.length)} .te-bubble-text`
        + ` [data-te-role="name"][data-te-speaker="${name}"],`
        + `.te-capture.bub-name ${bubble.slice('.te-capture '.length)} .te-bubble-text`
        + ` [data-te-role="narration"][data-te-blank][data-te-speaker="${name}"]`
        + `{display:none;}`,
      );
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
    // 드래그해서 만드는 말풍선
    ['--bub-radius' as string]: `${settings.bubble.bubbleRadius}px`,
    ['--bub-bg' as string]: settings.bubble.bubbleColor,
    ['--bub-fg' as string]: settings.bubble.bubbleTextColor,
    ['--bub-my-bg' as string]: settings.bubble.myBubbleColor,
    ['--bub-my-fg' as string]: settings.bubble.myBubbleTextColor,
    ['--bub-name-size' as string]: `${settings.bubble.nameSize}px`,
    ['--bub-avatar' as string]: `${settings.bubble.profileSize}px`,
    ['--bub-max' as string]: `${settings.bubble.bubbleMaxWidth}%`,
    ['--bub-gap' as string]: `${settings.bubble.gap}px`,
    // 꼬리 쪽 모서리는 아예 각지게 — 조금이라도 둥글리면 꼬리로 보이지 않는다
    ['--bub-tail' as string]: '0px',
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
        settings.bubble.showProfile ? 'bub-profile' : '',
        settings.bubble.showName ? 'bub-name' : '',
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
