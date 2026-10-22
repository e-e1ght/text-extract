import { useStore } from '../../store';
import { ColorField, Hint, Toggle } from '../ui';

/** 역할(서술·대사·이름·강조)별 공통 색. 캐릭터별 색은 말풍선 패널에서 다룬다. */
export function ColorPanel() {
  const { settings, patch, set } = useStore();
  const roles = settings.roles;

  return (
    <>
      <Toggle
        label="대사 / 서술 자동 구분"
        checked={roles.enabled}
        onChange={(enabled) => patch('roles', { enabled })}
        hint='따옴표 안은 대사, *…* 는 강조 서술, ( ) 는 곁말. 끄면 입력하는 글도 구분하지 않습니다'
      />
      <ColorField label="서술 색" value={roles.narration} onChange={(narration) => patch('roles', { narration })} />
      <ColorField label="대사 색" value={roles.dialogue} onChange={(dialogue) => patch('roles', { dialogue })} />
      <ColorField label="캐릭터 이름 색" value={roles.name} onChange={(name) => patch('roles', { name })} />
      <ColorField label="강조 서술 색" value={roles.emphasis} onChange={(emphasis) => patch('roles', { emphasis })} />
      <Toggle label="대사 기울임" checked={roles.dialogueItalic}
        onChange={(dialogueItalic) => patch('roles', { dialogueItalic })} />
      <Toggle label="강조 서술 기울임" checked={roles.emphasisItalic}
        onChange={(emphasisItalic) => patch('roles', { emphasisItalic })} />
      {/* 결과물에서 기호가 어떻게 보일지 — 서식이라 저장 탭이 아니라 여기 둔다 */}
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

      <Hint>
        캐릭터마다 다른 색을 쓰려면 <strong>말풍선</strong> 패널에서 캐릭터를 추가하세요.
        거기서 정한 색이 여기 공통 색보다 우선합니다.
      </Hint>
    </>
  );
}
