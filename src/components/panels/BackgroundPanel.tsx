import { useStore } from '../../store';
import { ColorField, NumberSlider } from '../ui';
import { BackgroundFields } from './BackgroundFields';
import { ImageSection } from './ImageSection';
import { SlotSection } from './SlotSection';

export function BackgroundPanel({ editorRoot }: { editorRoot: HTMLElement | null }) {
  const { settings, patch, adjustingImage, setAdjustingImage } = useStore();
  const bg = settings.background;
  return (
    <>
      <ImageSection editorRoot={editorRoot} />

      <hr className="divider" />

      <div className="panel-head"><span>배경</span></div>
      <BackgroundFields
        bg={bg}
        onChange={(change) => patch('background', change)}
        adjusting={adjustingImage}
        onAdjust={setAdjustingImage}
      />

      <hr className="divider" />
      <ColorField label="오버레이 색" value={bg.overlayColor} onChange={(overlayColor) => patch('background', { overlayColor })} />
      <NumberSlider label="오버레이 농도" value={bg.overlayOpacity} min={0} max={0.9} step={0.01} unit=""
        hint="배경 위 글자 가독성 보정" onChange={(overlayOpacity) => patch('background', { overlayOpacity })} />
      <NumberSlider label="배경 흐림" value={bg.blur} min={0} max={30}
        onChange={(blur) => patch('background', { blur })} />

      <hr className="divider" />

      <SlotSection />
    </>
  );
}
