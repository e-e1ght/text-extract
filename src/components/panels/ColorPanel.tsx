import { useStore } from '../../store';
import { ColorField, Hint, Toggle } from '../ui';

/** 역할(서술·대사·이름·강조)별 공통 색. 캐릭터별 색은 말풍선 패널에서 다룬다. */
export function ColorPanel() {
  const { settings, patch } = useStore();
  const roles = settings.roles;

  return (
    <>
      <Toggle
        label="대사 / 서술 자동 구분"
        checked={roles.enabled}
        onChange={(enabled) => patch('roles', { enabled })}
        hint='따옴표 안은 대사, *…* 는 강조 서술'
      />
      <ColorField label="서술 색" value={roles.narration} onChange={(narration) => patch('roles', { narration })} />
      <ColorField label="대사 색" value={roles.dialogue} onChange={(dialogue) => patch('roles', { dialogue })} />
      <ColorField label="캐릭터 이름 색" value={roles.name} onChange={(name) => patch('roles', { name })} />
      <ColorField label="강조 서술 색" value={roles.emphasis} onChange={(emphasis) => patch('roles', { emphasis })} />
      <Toggle label="대사 기울임" checked={roles.dialogueItalic}
        onChange={(dialogueItalic) => patch('roles', { dialogueItalic })} />
      <Toggle label="강조 서술 기울임" checked={roles.emphasisItalic}
        onChange={(emphasisItalic) => patch('roles', { emphasisItalic })} />

      <Hint>
        캐릭터마다 다른 색을 쓰려면 <strong>말풍선</strong> 패널에서 캐릭터를 추가하세요.
        거기서 정한 색이 여기 공통 색보다 우선합니다.
      </Hint>
    </>
  );
}
