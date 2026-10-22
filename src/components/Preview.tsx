import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../store';
import { AsciiArt, PatternFill } from './BackgroundArt';
import { PageBorder } from './PageBorder';
import { PageGuides, usePagePlan } from './PageGuides';
import { ensureWebFont } from '../lib/webfonts';
import type { ImageSlot, Settings, SlotSide } from '../types';

function escapeAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * 캐릭터별 색을 동적 CSS 규칙으로 만든다.
 *
 * 색을 요소마다 박지 않고 **변수로 넘긴다** — 역할 span 은 styles.css 의
 * '글자색이 정해지는 차례' 한 줄만 보고, 어디서 변수를 정했느냐로 차례가 갈린다.
 * 예전에는 상자와 안쪽 span 이 각자 color 를 가져 늘 안쪽이 이겼고,
 * 그래서 캐릭터 색이 공용 색에 묻히는 일이 되풀이됐다.
 */
function characterCss(settings: Settings): string {
  const { characters, roles } = settings;
  if (!roles.enabled) return '';

  return Object.values(characters)
    .map((character) => {
      const name = escapeAttr(character.name);
      const bubble = `.te-capture .te-bubble[data-te-speaker="${name}"]`;
      const script = `.te-capture .te-script[data-te-speaker="${name}"]`;

      const rules = [
        // 이 인물의 이름·대사 색. 역할 span 이든 상자든 speaker 만 같으면 닿는다.
        `.te-capture [data-te-speaker="${name}"]{`
        + `--te-name-ink:${character.color};`
        + `--te-say-ink:${character.dialogueColor || 'var(--te-dialogue)'};}`,
        // 말풍선·대본 안 글자는 둘 다 이 인물의 대사색을 쓴다.
        `${bubble} .te-bubble-text{`
        + `--te-box-ink:${character.dialogueColor || 'var(--te-dialogue)'};`
        + `background:${character.bubbleColor || 'var(--bub-bg)'};}`,
        `${script} .te-script-text{`
        + `--te-box-ink:${character.dialogueColor || 'var(--te-dialogue)'};}`,
      ];

      if (character.isMe) {
        /*
         * 내 쪽은 오른쪽에 붙으므로 이름줄도 통째로 좌우를 뒤집는다.
         * (프로필)이름 이 아니라 이름(프로필) 이라야 오른쪽 끝이 가지런하다.
         * row-reverse 에서는 main-start 가 오른쪽이라 flex-start 가 오른쪽 끝이다.
         */
        rules.push(
          `${bubble}{align-items:flex-end;}`,
          `${bubble} .te-bubble-name{flex-direction:row-reverse;}`,
          // 꼬리만 반대쪽으로 — 색은 위에서 이미 이 인물 것으로 정했다
          `${bubble} .te-bubble-text{`
          + `border-radius:var(--bub-radius) var(--bub-tail) var(--bub-radius) var(--bub-radius);}`,
          `.te-capture.bub-profile ${bubble.slice('.te-capture '.length)} .te-bubble-text`
          + `{margin-left:0;margin-right:calc(var(--bub-avatar) + 8px);}`,
        );
      }
      if (character.avatar) {
        rules.push(`${bubble} .te-bubble-name::before{background-image:url("${character.avatar}");}`);
      }
      /*
       * `이름: "대사"` 를 통째로 드래그해 상자로 만들면 이름이 두 번 나온다
       * (이름표 + 본문 속 `이름:`). 같은 인물일 때만 본문 쪽을 감춘다.
       * 이름 '바로 뒤' 의 빈칸도 함께 — 남겨 두면 글이 한 칸 밀린다.
       * 바로 뒤만이어야 한다: 예전에는 그 인물의 빈칸 조각을 모두 감춰,
       * `"안녕." (웃으며) *강조*` 가 `"안녕."웃으며강조` 로 붙어 나왔다.
       */
      for (const [box, body] of [[bubble, '.te-bubble-text'], [script, '.te-script-text']]) {
        const nameSel = `.te-capture.bub-name ${box.slice('.te-capture '.length)} ${body}`
          + ` [data-te-role="name"][data-te-speaker="${name}"]`;
        rules.push(
          `${nameSel},${nameSel} + [data-te-role="narration"][data-te-blank]{display:none;}`,
        );
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
    case 'pattern':
      return (
        <div className="bg-layer" style={{ ...base, background: bg.color }}>
          <PatternFill
            kind={bg.patternKind}
            scale={bg.patternScale}
            color={bg.patternColor}
            angle={bg.patternAngle}
            opacity={bg.patternOpacity}
          />
        </div>
      );
    case 'ascii':
      return (
        <div className="bg-layer" style={{ ...base, background: bg.color, overflow: 'hidden' }}>
          <AsciiArt
            url={bg.asciiUrl}
            color={bg.asciiColor}
            columns={bg.asciiColumns}
            fontSize={bg.asciiFontSize}
            contrast={bg.asciiContrast}
            invert={bg.asciiInvert}
            x={bg.asciiX}
            y={bg.asciiY}
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

const SLOT_LABEL: Record<SlotSide, string> = { top: '위', bottom: '아래', left: '왼쪽', right: '오른쪽' };

/**
 * 본문 위·아래·왼쪽·오른쪽에 붙는 이미지 칸.
 * 이미지는 배경처럼 background 로 깔아, 채우기·위치·크기를 배경과 같은 방식으로 다룬다.
 * 조절 중이면 칸 위에 드래그(위치)·휠(크기)을 받는 덮개를 얹는다.
 */
function SlotBox({
  side, slot, adjusting, onChange,
}: { side: SlotSide; slot: ImageSlot; adjusting: boolean; onChange: (change: Partial<ImageSlot>) => void }) {
  const drag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const vertical = side === 'left' || side === 'right';

  const style: CSSProperties = {
    flex: '0 0 auto',
    margin: `${slot.marginTop}px ${slot.marginRight}px ${slot.marginBottom}px ${slot.marginLeft}px`,
    width: vertical ? `${slot.size}px` : undefined,
    height: vertical ? (slot.length > 0 ? `${slot.length}px` : undefined) : `${slot.size}px`,
    // 본문이 짧아도 납작해지지 않게, 높이를 맞추는 칸은 적어도 너비만큼은 높이를 갖는다.
    minHeight: vertical && slot.length === 0 ? `${slot.size}px` : undefined,
    // 높이를 정하지 않은 왼쪽·오른쪽 칸은 본문 높이를 따라 늘어난다.
    alignSelf: vertical && slot.length > 0 ? 'flex-start' : 'stretch',
    border: slot.borderWidth > 0 ? `${slot.borderWidth}px solid ${slot.borderColor}` : undefined,
    borderRadius: `${slot.radius}px`,
    boxShadow: slot.shadow
      ? `0 ${Math.round(slot.shadowBlur / 3)}px ${slot.shadowBlur}px rgba(0, 0, 0, ${slot.shadowOpacity})`
      : undefined,
  };

  // 이미지를 아직 안 넣은 칸은 자리만 보여 주고 결과물에는 넣지 않는다.
  if (!slot.url) {
    return (
      <div className={`te-slot is-empty te-slot-${side}`} style={style} data-export-ignore="true">
        <span>{SLOT_LABEL[side]} 이미지 슬롯</span>
      </div>
    );
  }

  return (
    <div className={`te-slot te-slot-${side}`} style={style}>
      <div
        className="te-slot-image"
        style={{
          backgroundImage: `url("${slot.url}")`,
          backgroundSize: slot.fit === 'custom' ? `${slot.scale}% auto` : slot.fit,
          backgroundPosition: `${slot.x}% ${slot.y}%`,
        }}
      />
      {adjusting ? (
        <div
          className="bg-drag"
          data-export-ignore="true"
          title="드래그해서 위치를, 휠을 굴려 크기를 조절하세요"
          onWheel={(event) => {
            event.preventDefault();
            // 꽉 채우기 상태에서 휠을 굴리면 그 자리에서 직접 지정으로 넘어간다 (배경과 같다).
            const base = slot.fit === 'custom' ? slot.scale : 100;
            const next = Math.min(400, Math.max(10, base * (event.deltaY > 0 ? 0.94 : 1.06)));
            onChange({ fit: 'custom', scale: Math.round(next) });
          }}
          onPointerDown={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            drag.current = { x: event.clientX, y: event.clientY, w: box.width, h: box.height };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start) return;
            // background-position 은 값이 커질수록 이미지가 왼쪽·위로 간다 — 부호를 뒤집는다.
            const dx = ((event.clientX - start.x) / start.w) * 100;
            const dy = ((event.clientY - start.y) / start.h) * 100;
            drag.current = { ...start, x: event.clientX, y: event.clientY };
            onChange({
              x: Math.min(100, Math.max(0, slot.x - dx)),
              y: Math.min(100, Math.max(0, slot.y - dy)),
            });
          }}
          onPointerUp={(event) => {
            drag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { drag.current = null; }}
        >
          <span className="bg-drag-badge">
            {SLOT_LABEL[side]} 슬롯 조절 중{slot.fit === 'custom' ? ` · ${Math.round(slot.scale)}%` : ''}
          </span>
        </div>
      ) : null}
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
  // 나눠 저장할 자리를 미리보기에 점선으로 보이려면 결과물 상자를 직접 알아야 한다
  const [captureNode, setCaptureNode] = useState<HTMLDivElement | null>(null);
  const plan = usePagePlan(captureNode, settings.exportOptions.splitRatio, settings);
  const attachCapture = useCallback((node: HTMLDivElement | null) => {
    captureRef(node);
    setCaptureNode(node);
  }, [captureRef]);
  const { patch, adjustingImage, adjustingSlot } = useStore();
  const slots = settings.imageSlots;
  const slotOn = (side: SlotSide) => slots.enabled && slots[side].enabled;
  const renderSlot = (side: SlotSide) => (slotOn(side) ? (
    <SlotBox
      side={side}
      slot={slots[side]}
      adjusting={adjustingSlot === side}
      onChange={(change) => patch('imageSlots', { [side]: { ...slots[side], ...change } })}
    />
  ) : null);
  const scale = typography.horizontalScale;
  const drag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const css = useMemo(() => characterCss(settings), [settings]);

  // 고른 본문 글꼴만 받아 온다 (미리 여덟 벌을 받아 두지 않는다)
  useEffect(() => { ensureWebFont(typography.fontFamily); }, [typography.fontFamily]);

  const adjustingAscii = adjustingImage && background.type === 'ascii' && Boolean(background.asciiUrl);
  const canAdjust = adjustingAscii
    || (adjustingImage && background.type === 'image' && Boolean(background.imageUrl));

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
    // 쪽 번호는 테두리 안쪽에 둔다 — 그냥 두면 테두리 선 위에 겹쳐 찍힌다
    ['--te-pageno-inset' as string]: layout.border.enabled
      ? `${layout.border.inset + layout.border.width * (layout.border.style === 'double' ? 4 : 1) + 10}px`
      : '14px',
    /* 곁말: 대사보다 2px 작게, 회색으로. 크기는 대사 크기를 따라 움직인다 */
    ['--te-paren-size' as string]: `${Math.max(1, typography.dialogueFontSize - 2)}px`,
    ['--te-paren' as string]: '#8a8a93',
    ['--te-paragraph-gap' as string]: `${typography.paragraphGap}px`,
    // 드래그해서 만드는 말풍선
    ['--bub-radius' as string]: `${settings.bubble.bubbleRadius}px`,
    ['--bub-bg' as string]: settings.bubble.bubbleColor,
    ['--bub-name-size' as string]: `${settings.bubble.nameSize}px`,
    ['--bub-avatar' as string]: `${settings.bubble.profileSize}px`,
    ['--bub-max' as string]: `${settings.bubble.bubbleMaxWidth}%`,
    ['--bub-gap' as string]: `${settings.bubble.gap}px`,
    /*
     * 꼬리 쪽 모서리. 각지면 꼬리로 보이고, 둥글면 그냥 둥근 상자가 된다.
     * 2px 는 '깎다 만' 정도라 꼬리는 그대로 보이면서 날카롭지 않다.
     */
    ['--bub-tail' as string]: '2px',
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
      ref={attachCapture}
      className={[
        'te-capture',
        roles.enabled ? '' : 'roles-off',
        settings.hideEmphasisMarks ? 'hide-marks' : '',
        settings.parenAside ? 'paren-aside' : '',
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
            if (adjustingAscii) {
              // 아스키 아트의 크기는 곧 글자 크기다 (가로 글자 수는 그대로)
              const next = background.asciiFontSize * (event.deltaY > 0 ? 0.94 : 1.06);
              patch('background', { asciiFontSize: Math.round(Math.min(40, Math.max(2, next)) * 10) / 10 });
              return;
            }
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
            if (adjustingAscii) {
              // 아스키 아트는 글 상자 가운데의 자리라, 끄는 방향 그대로 움직인다
              patch('background', {
                asciiX: Math.min(100, Math.max(0, background.asciiX + dx)),
                asciiY: Math.min(100, Math.max(0, background.asciiY + dy)),
              });
              return;
            }
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
            {adjustingAscii
              ? ` · 글자 ${background.asciiFontSize}px`
              : background.imageFit === 'custom' ? ` · ${Math.round(background.imageScale)}%` : ''}
          </span>
        </div>
      ) : null}
      {background.overlayOpacity > 0 ? (
        <div
          className="bg-overlay"
          style={{ background: background.overlayColor, opacity: background.overlayOpacity }}
        />
      ) : null}

      {/* 배경 위 · 글 아래 — 글에는 닿지 않는다 */}
      <PageBorder border={layout.border} radius={layout.radius} />
      {plan ? <PageGuides cuts={plan.cuts} /> : null}
      <div className="te-content" style={contentStyle}>
        {renderSlot('top')}
        {/* 왼쪽·오른쪽 슬롯이 본문과 한 줄에 서도록 가로로 묶는다 */}
        <div className="te-middle">
          {renderSlot('left')}
          <div className="te-main">
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
          {renderSlot('right')}
        </div>
        {renderSlot('bottom')}
      </div>
    </div>
  );
}
