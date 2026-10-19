import { alignImage, insertImage, selectionImage, type ImageAlign } from '../../lib/format';
import { readFileAsDataUrl } from '../../lib/exporters';
import { useStore } from '../../store';
import { Field, FileButton, Hint, NumberSlider } from '../ui';

/** 본문 속 이미지와 본문 위에 얹는 스티커. 이미지 탭 맨 위에 둔다. */
export function ImageSection({ editorRoot }: { editorRoot: HTMLElement | null }) {
  const { settings, set, selectedSticker, setSelectedSticker } = useStore();
  const pickedIndex = settings.stickers.findIndex((sticker) => sticker.id === selectedSticker);
  const pickedSticker = pickedIndex >= 0 ? settings.stickers[pickedIndex] : null;
  const updateSticker = (id: string, change: Partial<(typeof settings.stickers)[number]>) => {
    set('stickers', settings.stickers.map((s) => (s.id === id ? { ...s, ...change } : s)));
  };

  return (
    <>
      <Field label="본문 이미지" hint="본문 속 · 본문 위">
        <div className="button-row">
          <FileButton
            label="본문에 넣기"
            accept="image/*"
            onPick={async (file) => {
              if (!editorRoot) return;
              editorRoot.focus();
              insertImage(editorRoot, await readFileAsDataUrl(file));
            }}
          />
          <FileButton
            label="스티커로 올리기"
            accept="image/*"
            onPick={async (file) => {
              const url = await readFileAsDataUrl(file);
              const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
              set('stickers', [
                ...settings.stickers,
                { id, url, x: 30, y: 30, width: 30, rotation: 0, opacity: 1 },
              ]);
              setSelectedSticker(id);
            }}
          />
        </div>
      </Field>

      {selectionImage(editorRoot) ? (
        <>
          <Field label="고른 이미지 크기">
            <div className="button-row">
              {[25, 50, 75, 100].map((percent) => (
                <button
                  key={percent}
                  type="button"
                  className="mini-button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const image = selectionImage(editorRoot);
                    if (image) image.style.width = `${percent}%`;
                  }}
                >
                  {percent}%
                </button>
              ))}
            </div>
          </Field>
          <Field label="고른 이미지 정렬">
            <div className="button-row">
              {([['왼쪽', 'left'], ['가운데', 'center'], ['오른쪽', 'right']] as Array<[string, ImageAlign]>)
                .map(([label, value]) => (
                  <button
                    key={value}
                    type="button"
                    className="mini-button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const image = selectionImage(editorRoot);
                      if (image) alignImage(image, value);
                    }}
                  >
                    {label}
                  </button>
                ))}
            </div>
          </Field>
        </>
      ) : null}

      {settings.stickers.length > 0 ? (
        <div className="slot-list">
          {settings.stickers.map((sticker, index) => (
            <div className="slot-row" key={sticker.id}>
              <img className="slot-thumb" src={sticker.url} alt="" />
              <span className="slot-name">스티커 {index + 1}</span>
              <button type="button" className="mini-button" onClick={() => setSelectedSticker(sticker.id)}>
                고르기
              </button>
              <button
                type="button"
                className="mini-button danger"
                onClick={() => set('stickers', settings.stickers.filter((s) => s.id !== sticker.id))}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {/* 고른 스티커의 각도·크기·투명도는 손잡이로도 되지만, 숫자로 정확히 맞출 자리도 둔다 */}
      {pickedSticker ? (
        <>
          <NumberSlider
            label={`스티커 각도 (${pickedIndex + 1}번)`}
            value={Math.round(pickedSticker.rotation)}
            min={-180}
            max={180}
            unit="°"
            hint="0 으로 두면 그대로"
            onChange={(rotation) => updateSticker(pickedSticker.id, { rotation })}
          />
          <NumberSlider
            label="스티커 크기"
            value={Math.round(pickedSticker.width)}
            min={3}
            max={200}
            unit="%"
            onChange={(width) => updateSticker(pickedSticker.id, { width })}
          />
          <NumberSlider
            label="스티커 투명도"
            value={Math.round(pickedSticker.opacity * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => updateSticker(pickedSticker.id, { opacity: value / 100 })}
          />
        </>
      ) : null}
      {settings.stickers.length > 0 ? (
        <Hint>
          스티커는 미리보기에서 바로 끌어 옮기고, 고른 뒤 오른쪽 아래 손잡이로 크기를,
          위쪽 손잡이로 각도를 바꿉니다. (Shift 를 누르면 15도 단위, 더블클릭하면 0도)
        </Hint>
      ) : null}
    </>
  );
}
