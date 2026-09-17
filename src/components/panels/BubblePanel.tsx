import { useStore } from '../../store';
import { CharacterList } from './CharacterList';
import { ColorField, Hint, NumberSlider, Toggle } from '../ui';

export function BubblePanel({ detectedNames }: { detectedNames: string[] }) {
  const { settings, patch } = useStore();
  const bubble = settings.bubble;

  return (
    <>
      <CharacterList detectedNames={detectedNames} />

      <hr className="divider" />

      <div className="panel-head"><span>말풍선</span></div>
      <Hint>
        본문에서 대사를 드래그하고 팝업의 <strong>말풍선</strong> 버튼을 누르면
        말풍선이 됩니다. 인물을 고르면 그 캐릭터의 색·프로필·이름이 함께 붙습니다.
        <br />
        같은 자리의 <strong>대본</strong> 버튼은 <code>이름　대사</code> 처럼 두 칸으로
        나란히 놓습니다.
        <br />
        <strong>말풍선 안 글자색은 '대사' 색입니다.</strong> 아래 '말풍선 색' 은
        인물을 고르지 않은 말풍선에 쓰이고, 캐릭터는 저마다 제 색을 씁니다.
      </Hint>
          <ColorField label="말풍선 색" value={bubble.bubbleColor}
            onChange={(bubbleColor) => patch('bubble', { bubbleColor })} />
          <NumberSlider label="말풍선 둥글기" value={bubble.bubbleRadius} min={0} max={32}
            onChange={(bubbleRadius) => patch('bubble', { bubbleRadius })} />
          <NumberSlider label="말풍선 최대 너비" value={bubble.bubbleMaxWidth} min={40} max={100} unit="%"
            onChange={(bubbleMaxWidth) => patch('bubble', { bubbleMaxWidth })} />
          <NumberSlider label="말풍선 간격" value={bubble.gap} min={0} max={48}
            onChange={(gap) => patch('bubble', { gap })} />
          <Toggle label="프로필 이미지 표시" checked={bubble.showProfile}
            onChange={(showProfile) => patch('bubble', { showProfile })} />
          <NumberSlider label="프로필 크기" value={bubble.profileSize} min={20} max={72}
            onChange={(profileSize) => patch('bubble', { profileSize })} />
          <Toggle label="캐릭터 이름 표시" checked={bubble.showName}
            onChange={(showName) => patch('bubble', { showName })} />
          <NumberSlider label="이름 크기" value={bubble.nameSize} min={8} max={24}
            onChange={(nameSize) => patch('bubble', { nameSize })} />

    </>
  );
}
