import { useState } from 'react';
import { copyNodeToClipboard, exportNode } from '../../lib/exporters';
import { deleteSlot, downloadPreset, loadSlots, readPresetFile, saveSlot, type PresetSlot } from '../../lib/presets';
import { stripAllFormatting } from '../../lib/format';
import { useStore } from '../../store';
import { ButtonGroup, Field, Hint, NumberSlider, Select, TextInput, Toggle } from '../ui';
import type { ExportOptions } from '../../types';

export function ExportPanel({
  captureNode, editorRoot,
}: { captureNode: HTMLElement | null; editorRoot: HTMLElement | null }) {
  const { settings, patch, set, replaceSettings, resetSettings } = useStore();
  const options = settings.exportOptions;

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [slots, setSlots] = useState<PresetSlot[]>(() => loadSlots());
  const [slotName, setSlotName] = useState('');

  const announce = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(''), 2600);
  };

  const runExport = async () => {
    if (!captureNode) return;
    setBusy(true);
    setStatus('저장하는 중…');
    try {
      await exportNode(captureNode, options);
      announce('저장했습니다.');
    } catch (error) {
      announce(error instanceof Error ? `저장 실패: ${error.message}` : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const runCopy = async () => {
    if (!captureNode) return;
    setBusy(true);
    try {
      const ok = await copyNodeToClipboard(captureNode, options.scale);
      announce(ok ? '클립보드에 복사했습니다.' : '이 브라우저는 이미지 복사를 지원하지 않습니다.');
    } catch {
      announce('복사에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ButtonGroup
        label="저장 형식"
        value={options.format}
        options={[
          { label: 'PNG', value: 'png' as ExportOptions['format'] },
          { label: 'JPG', value: 'jpeg' as ExportOptions['format'] },
          { label: 'PDF', value: 'pdf' as ExportOptions['format'] },
        ]}
        onChange={(format) => patch('exportOptions', { format })}
      />
      <Select
        label="해상도"
        value={options.scale}
        options={[
          { label: '1배 (화면 크기)', value: 1 },
          { label: '2배 (권장)', value: 2 },
          { label: '3배 (고화질)', value: 3 },
          { label: '4배', value: 4 },
        ]}
        onChange={(scale) => patch('exportOptions', { scale })}
      />
      {options.format === 'jpeg' ? (
        <NumberSlider label="JPG 품질" value={options.quality} min={0.4} max={1} step={0.01} unit=""
          onChange={(quality) => patch('exportOptions', { quality })} />
      ) : null}
      <TextInput label="파일 이름" value={options.fileName} placeholder="발췌"
        onChange={(fileName) => patch('exportOptions', { fileName })} />

      <div className="button-row">
        <button type="button" className="primary-button" disabled={busy || !captureNode} onClick={runExport}>
          {busy ? '처리 중…' : '이미지로 저장'}
        </button>
        <button type="button" className="mini-button" disabled={busy || !captureNode} onClick={runCopy}>
          클립보드 복사
        </button>
      </div>
      {status ? <p className="status-line" role="status">{status}</p> : null}

      <hr className="divider" />

      <div className="panel-head"><span>서식 저장</span></div>
      <Hint>편집 옵션과 본문은 이 브라우저에 자동 저장되어, 새로고침하거나 다시 방문해도 그대로 남습니다.</Hint>

      <Field label="이 브라우저에 이름 붙여 저장">
        <div className="button-row">
          <input
            type="text"
            value={slotName}
            placeholder="서식 이름"
            onChange={(e) => setSlotName(e.target.value)}
          />
          <button
            type="button"
            className="mini-button"
            disabled={!slotName.trim()}
            onClick={() => {
              setSlots(saveSlot(slotName, settings));
              setSlotName('');
              announce('서식을 저장했습니다.');
            }}
          >
            저장
          </button>
        </div>
      </Field>

      {slots.length > 0 ? (
        <div className="slot-list">
          {slots.map((slot) => (
            <div className="slot-row" key={slot.name}>
              <span className="slot-name">{slot.name}</span>
              <button type="button" className="mini-button"
                onClick={() => { replaceSettings(slot.settings); announce(`'${slot.name}' 서식을 적용했습니다.`); }}>
                적용
              </button>
              <button type="button" className="mini-button danger"
                onClick={() => setSlots(deleteSlot(slot.name))}>
                삭제
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Field label="서식 파일" hint="다른 사람과 공유할 때">
        <div className="button-row">
          <button type="button" className="mini-button"
            onClick={() => downloadPreset(slotName || options.fileName, settings)}>
            파일로 내보내기
          </button>
          <label className="file-button" htmlFor="preset-import">파일 불러오기</label>
          <input
            id="preset-import"
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              try {
                const preset = await readPresetFile(file);
                replaceSettings(preset.settings);
                announce(`'${preset.name}' 서식을 불러왔습니다.`);
              } catch (error) {
                announce(error instanceof Error ? error.message : '서식 파일을 읽지 못했습니다.');
              }
            }}
          />
        </div>
      </Field>

      <hr className="divider" />

      <div className="panel-head"><span>편집 설정</span></div>
      <Toggle
        label="입력하는 동안 대사 자동 인식"
        checked={settings.autoParse}
        onChange={(autoParse) => set('autoParse', autoParse)}
      />
      <Toggle
        label="결과물에서 * 기호 감추기"
        checked={settings.hideEmphasisMarks}
        onChange={(hideEmphasisMarks) => set('hideEmphasisMarks', hideEmphasisMarks)}
        hint="강조 서식은 그대로 두고 별표만 숨깁니다"
      />
      <Toggle
        label="괄호 안은 작은 회색 글씨로"
        checked={settings.parenAside}
        onChange={(parenAside) => set('parenAside', parenAside)}
        hint="( ) 안의 글을 대사보다 4px 작은 회색으로 바꾸고 괄호는 감춥니다"
      />
      <Toggle
        label="붙여넣을 때 빈 줄 정리"
        checked={settings.tidyBlankLines}
        onChange={(tidyBlankLines) => set('tidyBlankLines', tidyBlankLines)}
        hint="문단 사이는 '문단 간격' 값으로 띄웁니다"
      />
      <Field label="도구 위치">
        <div className="button-row">
          <button
            type="button"
            className="mini-button"
            onClick={() => set('sidebarSide', settings.sidebarSide === 'left' ? 'right' : 'left')}
          >
            도구를 {settings.sidebarSide === 'left' ? '오른쪽' : '왼쪽'}으로 옮기기
          </button>
        </div>
      </Field>

      <hr className="divider" />

      <div className="panel-head"><span>초기화</span></div>
      <div className="button-row">
        <button
          type="button"
          className="mini-button danger"
          onClick={() => {
            if (!window.confirm('모든 서식을 지우고 기본값으로 되돌릴까요?\n\n패널 편집 옵션과 본문에 직접 준 서식(볼드·색·크기)이 모두 사라집니다.\n본문 글자는 그대로 남습니다.')) return;
            resetSettings();
            if (editorRoot) {
              stripAllFormatting(editorRoot);
              // DOM 을 직접 바꿨으므로 알려 줘야 저장된 본문까지 갱신된다.
              // 이걸 빠뜨리면 새로고침했을 때 예전 서식이 되살아난다.
              editorRoot.dispatchEvent(new Event('input', { bubbles: true }));
            }
            announce('모든 서식을 기본값으로 되돌렸습니다.');
          }}
        >
          모든 서식 초기화
        </button>
        <button
          type="button"
          className="mini-button"
          onClick={() => {
            if (!window.confirm('패널 편집 옵션만 기본값으로 되돌릴까요? 본문에 직접 준 서식은 남습니다.')) return;
            resetSettings();
            announce('편집 옵션을 되돌렸습니다.');
          }}
        >
          편집 옵션만
        </button>
      </div>
      <Hint>본문에 직접 준 서식만 지우려면, 글자를 드래그한 뒤 팝업의 <strong>지우기</strong>를 누르세요.</Hint>
    </>
  );
}
