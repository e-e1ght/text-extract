import { useEffect, useRef, useState } from 'react';
import {
  copyNodeToClipboard, exportNode, pickSaveTarget, releaseExported, type ExportedFile,
} from '../../lib/exporters';
import { deleteSlot, downloadPreset, loadSlots, readPresetFile, saveSlot, type PresetSlot } from '../../lib/presets';
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
  // 방금 저장한 파일 — 브라우저가 자동 다운로드를 막았으면 여기서 직접 눌러 받는다.
  const [exported, setExported] = useState<ExportedFile[]>([]);
  const exportedRef = useRef<ExportedFile[]>([]);
  useEffect(() => () => releaseExported(exportedRef.current), []);

  const announce = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(''), 2600);
  };
  // 서식 저장 칸은 아래쪽에 있어 위의 알림이 눈에 띄지 않는다 — 따로 보여 준다.
  const [presetStatus, setPresetStatus] = useState('');
  const announcePreset = (message: string) => {
    setPresetStatus(message);
    window.setTimeout(() => setPresetStatus(''), 2600);
  };
  const [resetStatus, setResetStatus] = useState('');
  const announceReset = (message: string) => {
    setResetStatus(message);
    window.setTimeout(() => setResetStatus(''), 2600);
  };

  const runExport = async () => {
    if (!captureNode) return;
    // 저장 창은 누른 순간에만 열리므로 무엇보다 먼저 고른다.
    const target = await pickSaveTarget(captureNode, options);
    if (target === 'cancelled') return;
    setBusy(true);
    setStatus('저장하는 중…');
    releaseExported(exportedRef.current);
    exportedRef.current = [];
    setExported([]);
    try {
      const files = await exportNode(captureNode, options, target ?? undefined);
      exportedRef.current = files;
      setExported(files);
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

  /** 본문을 빈 줄 하나로. 빈 줄을 남겨야 바로 이어서 쓸 수 있다. */
  const clearBody = () => {
    if (!editorRoot) return;
    const line = document.createElement('div');
    line.appendChild(document.createElement('br'));
    editorRoot.replaceChildren(line);
    // DOM 을 직접 바꿨으니 알려 줘야 저장된 본문과 되돌리기 기록이 따라온다
    editorRoot.dispatchEvent(new Event('input', { bubbles: true }));
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
      {'showSaveFilePicker' in window ? (
        <Hint>저장할 위치를 묻는 창이 뜹니다. 나눔선으로 여러 장이 되면 담을 폴더를 고릅니다.</Hint>
      ) : null}
      {exported.length > 0 ? (
        <p className="export-again">
          받아지지 않았다면 눌러 받으세요:
          {exported.map((file) => (
            <a key={file.url} href={file.url} download={file.name}>{file.name}</a>
          ))}
        </p>
      ) : null}

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
            onClick={async () => {
              try {
                if (await downloadPreset(slotName || options.fileName, settings)) {
                  announcePreset('서식 파일을 내보냈습니다.');
                }
              } catch {
                announcePreset('서식 파일을 내보내지 못했습니다.');
              }
            }}>
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
                announcePreset(`'${preset.name}' 서식을 불러왔습니다.`);
              } catch (error) {
                announcePreset(error instanceof Error ? error.message : '서식 파일을 읽지 못했습니다.');
              }
            }}
          />
        </div>
      </Field>
      {presetStatus ? <p className="status-line" role="status">{presetStatus}</p> : null}

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
        hint="( ) 안의 글을 대사보다 2px 작은 회색으로 바꾸고 괄호는 감춥니다"
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
            if (!window.confirm('전부 지우고 처음 상태로 되돌릴까요?\n\n본문 글, 편집 옵션, 제목·캐릭터·스티커·배경이 모두 사라집니다.\n잘못 눌렀다면 바로 Ctrl+Z 로 되돌릴 수 있습니다.')) return;
            resetSettings();
            clearBody();
            announceReset('전부 처음 상태로 되돌렸습니다.');
          }}
        >
          전부 초기화
        </button>
        {/* 아래 둘은 지우는 범위가 좁고 Ctrl+Z 로 되돌릴 수 있어 묻지 않는다 */}
        <button
          type="button"
          className="mini-button"
          onClick={() => {
            resetSettings();
            announceReset('편집 옵션을 되돌렸습니다. (Ctrl+Z 로 되돌리기)');
          }}
        >
          편집 옵션만
        </button>
        <button
          type="button"
          className="mini-button"
          disabled={!editorRoot}
          onClick={() => {
            clearBody();
            announceReset('본문을 지웠습니다. (Ctrl+Z 로 되돌리기)');
          }}
        >
          본문만 지우기
        </button>
      </div>
      {resetStatus ? <p className="status-line" role="status">{resetStatus}</p> : null}
      <Hint>본문에 직접 준 서식만 지우려면, 글자를 드래그한 뒤 팝업의 <strong>지우기</strong>를 누르세요.</Hint>
    </>
  );
}
