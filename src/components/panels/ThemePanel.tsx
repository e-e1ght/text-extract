import { useStore } from '../../store';
import { CharacterList } from './CharacterList';
import { ButtonGroup, ColorField, Hint, NumberSlider, Toggle } from '../ui';

export function ThemePanel({ detectedNames }: { detectedNames: string[] }) {
  const { settings, patch } = useStore();
  const messenger = settings.messenger;

  return (
    <>
      <CharacterList detectedNames={detectedNames} />

      <hr className="divider" />

      {/*
        말풍선 모양은 두 테마가 함께 씁니다.
        메신저는 대사를 통째로 말풍선으로 바꾸고, 기본 테마에서는 드래그해서 만든
        말풍선이 같은 모양을 따릅니다. 그래서 테마와 상관없이 늘 열어 둡니다.
      */}
      <div className="panel-head"><span>말풍선</span></div>
      <Hint>
        상단 막대의 <strong>메신저</strong> 테마에서는 모든 대사가 말풍선이 되고,
        <strong>기본</strong> 테마에서는 드래그한 글을 말풍선으로 만들 수 있습니다.
        아래 값은 두 경우 모두에 적용됩니다.
      </Hint>
          <ColorField label="말풍선 색" value={messenger.bubbleColor}
            onChange={(bubbleColor) => patch('messenger', { bubbleColor })} />
          <ColorField label="말풍선 글자색" value={messenger.bubbleTextColor}
            onChange={(bubbleTextColor) => patch('messenger', { bubbleTextColor })} />
          <ColorField label="내 말풍선 색" value={messenger.myBubbleColor}
            onChange={(myBubbleColor) => patch('messenger', { myBubbleColor })} />
          <ColorField label="내 말풍선 글자색" value={messenger.myBubbleTextColor}
            onChange={(myBubbleTextColor) => patch('messenger', { myBubbleTextColor })} />
          <NumberSlider label="말풍선 둥글기" value={messenger.bubbleRadius} min={0} max={32}
            onChange={(bubbleRadius) => patch('messenger', { bubbleRadius })} />
          <NumberSlider label="말풍선 최대 너비" value={messenger.bubbleMaxWidth} min={40} max={100} unit="%"
            onChange={(bubbleMaxWidth) => patch('messenger', { bubbleMaxWidth })} />
          <NumberSlider label="말풍선 간격" value={messenger.gap} min={0} max={48}
            onChange={(gap) => patch('messenger', { gap })} />
          <Toggle label="프로필 이미지 표시" checked={messenger.showProfile}
            onChange={(showProfile) => patch('messenger', { showProfile })} />
          <NumberSlider label="프로필 크기" value={messenger.profileSize} min={20} max={72}
            onChange={(profileSize) => patch('messenger', { profileSize })} />
          <Toggle label="캐릭터 이름 표시" checked={messenger.showName}
            onChange={(showName) => patch('messenger', { showName })} />
          <NumberSlider label="이름 크기" value={messenger.nameSize} min={8} max={24}
            onChange={(nameSize) => patch('messenger', { nameSize })} />

      {/* 서술을 흐리게·숨기는 건 대사만 남기는 메신저에서만 쓸모가 있다 */}
      {settings.theme === 'messenger' ? (
        <ButtonGroup
          label="서술 처리"
          value={messenger.narrationStyle}
          options={[
            { label: '그대로', value: 'plain' as const },
            { label: '흐리게', value: 'muted' as const },
            { label: '숨김', value: 'hidden' as const },
          ]}
          onChange={(narrationStyle) => patch('messenger', { narrationStyle })}
        />
      ) : null}
    </>
  );
}
