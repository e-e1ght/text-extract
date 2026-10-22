import { useStore } from '../../store';
import { ButtonGroup, Hint, NumberSlider, TextInput, Toggle } from '../ui';

export function MetaPanel() {
  const { settings, patch } = useStore();
  const meta = settings.meta;

  return (
    <>
      <Hint>제목·부제목·제작자의 <strong>색과 크기</strong>는 미리보기에서 그 글을 드래그한 뒤 편집 패널에서 고릅니다.</Hint>
      <Toggle label="제목 표시" checked={meta.showTitle} onChange={(showTitle) => patch('meta', { showTitle })} />
      {meta.showTitle ? (
        <>
          <TextInput label="제목" value={meta.title} placeholder="제목을 입력하세요"
            onChange={(title) => patch('meta', { title })} />
        </>
      ) : null}

      <Toggle label="부제목 표시" checked={meta.showSubtitle} onChange={(showSubtitle) => patch('meta', { showSubtitle })} />
      {meta.showSubtitle ? (
        <>
          <TextInput label="부제목" value={meta.subtitle} placeholder="부제목"
            onChange={(subtitle) => patch('meta', { subtitle })} />
        </>
      ) : null}

      <Toggle label="제작자 표시" checked={meta.showAuthor} onChange={(showAuthor) => patch('meta', { showAuthor })} />
      {meta.showAuthor ? (
        <>
          <TextInput label="제작자" value={meta.author} placeholder="@아이디 / 이름"
            onChange={(author) => patch('meta', { author })} />
        </>
      ) : null}

      <hr className="divider" />
      {/* 제목과 제작자의 자리잡기는 한곳에 모아 둔다 — 서로 보면서 정하는 값들이다 */}
      <div className="panel-head"><span>위치와 정렬</span></div>
      <ButtonGroup
        label="제목 위치"
        value={meta.position}
        options={[{ label: '본문 위', value: 'top' as const }, { label: '본문 아래', value: 'bottom' as const }]}
        onChange={(position) => patch('meta', { position })}
      />
      <ButtonGroup
        label="제목 정렬"
        value={meta.align}
        options={[
          { label: '왼쪽', value: 'left' as const },
          { label: '가운데', value: 'center' as const },
          { label: '오른쪽', value: 'right' as const },
        ]}
        onChange={(align) => patch('meta', { align })}
      />
      {meta.showAuthor ? (
        <>
          <ButtonGroup
            label="제작자 위치"
            value={meta.authorPosition}
            options={[{ label: '본문 위', value: 'top' as const }, { label: '본문 아래', value: 'bottom' as const }]}
            onChange={(authorPosition) => patch('meta', { authorPosition })}
            hint="제목과 같은 쪽이면 바깥쪽"
          />
          <ButtonGroup
            label="제작자 정렬"
            value={meta.authorAlign}
            options={[
              { label: '왼쪽', value: 'left' as const },
              { label: '가운데', value: 'center' as const },
              { label: '오른쪽', value: 'right' as const },
            ]}
            onChange={(authorAlign) => patch('meta', { authorAlign })}
          />
        </>
      ) : null}
      <NumberSlider label="제목과 본문 사이 간격" value={meta.gap} min={0} max={200}
        onChange={(gap) => patch('meta', { gap })} />
      <NumberSlider label="제목·부제목 사이 간격" value={meta.innerGap} min={0} max={60}
        onChange={(innerGap) => patch('meta', { innerGap })} />
      {meta.showAuthor ? (
        <NumberSlider label="본문과 제작자 간격" value={meta.authorGap} min={0} max={160}
          onChange={(authorGap) => patch('meta', { authorGap })} />
      ) : null}
    </>
  );
}
