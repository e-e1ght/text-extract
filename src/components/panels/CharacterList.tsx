import { useState } from 'react';
import { readFileAsDataUrl } from '../../lib/exporters';
import { newCharacter, useStore } from '../../store';
import { FileButton, Hint } from '../ui';

/** 캐릭터 목록과 색상. 말풍선 모양과 함께 다루는 편이 자연스러워 말풍선 패널에 둔다. */
export function CharacterList({ detectedNames }: { detectedNames: string[] }) {
  const { settings, upsertCharacter, setSettings } = useStore();
  const [newName, setNewName] = useState('');
  const roles = settings.roles;

  const known = new Set(Object.keys(settings.characters));
  const missing = detectedNames.filter((name) => !known.has(name));

  const registerAll = () => {
    setSettings((prev) => {
      const next = { ...prev.characters };
      for (const name of missing) next[name] = newCharacter(name, prev);
      return { ...prev, characters: next };
    });
  };

  const removeCharacter = (name: string) => {
    setSettings((prev) => {
      const next = { ...prev.characters };
      delete next[name];
      return { ...prev, characters: next };
    });
  };

  const add = () => {
    if (!newName.trim()) return;
    upsertCharacter(newName.trim(), {});
    setNewName('');
  };

  const hex = (value: string, fallback: string) =>
    (/^#[0-9a-f]{6}$/i.test(value) ? value : fallback);

  return (
    <>
      <div className="panel-head">
        <span>캐릭터</span>
        {missing.length > 0 ? (
          <button type="button" className="mini-button" onClick={registerAll}>
            본문에서 {missing.length}명 추가
          </button>
        ) : null}
      </div>

      <div className="button-row">
        <input
          type="text"
          value={newName}
          placeholder="캐릭터 이름 직접 추가"
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            add();
          }}
        />
        <button type="button" className="mini-button" disabled={!newName.trim()} onClick={add}>
          추가
        </button>
      </div>

      {Object.values(settings.characters).length === 0 ? (
        <Hint>
          본문에서 이름을 드래그해 팝업의 <strong>캐릭터</strong> 버튼으로 추가하거나, 위 칸에 직접 입력하세요.
          본문에 <code>이름: "대사"</code> 형태로 쓰면 자동으로도 찾아냅니다.
        </Hint>
      ) : null}

      <div className="character-list">
        {Object.values(settings.characters).map((character) => (
          <div className="character-row" key={character.name}>
            <div className="character-top">
              <div
                className="character-avatar"
                style={{
                  background: character.avatar
                    ? `center/cover no-repeat url(${character.avatar})`
                    : character.color,
                }}
              >
                {character.avatar ? '' : character.name.slice(0, 1)}
              </div>
              <span className="character-name">{character.name}</span>
              <label className="mini-check" title="오른쪽에 붙는 내 말풍선으로 보냅니다">
                <input
                  type="checkbox"
                  checked={character.isMe}
                  onChange={(event) => upsertCharacter(character.name, { isMe: event.target.checked })}
                />
                내 쪽
              </label>
            </div>

            <div className="character-grid">
              <label className="char-field">
                <span>이름</span>
                <input
                  type="color"
                  value={hex(character.color, '#000000')}
                  onChange={(event) => upsertCharacter(character.name, { color: event.target.value })}
                />
              </label>
              <label className="char-field">
                <span>대사</span>
                <input
                  type="color"
                  value={hex(character.dialogueColor, roles.dialogue)}
                  onChange={(event) => upsertCharacter(character.name, { dialogueColor: event.target.value })}
                />
              </label>

              <label className="char-field">
                <span>말풍선</span>
                <input
                  type="color"
                  value={hex(character.bubbleColor, settings.bubble.bubbleColor)}
                  onChange={(event) => upsertCharacter(character.name, { bubbleColor: event.target.value })}
                />
              </label>
              <label className="char-field">
                <span>말풍선 글자</span>
                <input
                  type="color"
                  value={hex(character.bubbleTextColor, settings.bubble.bubbleTextColor)}
                  onChange={(event) => upsertCharacter(character.name, { bubbleTextColor: event.target.value })}
                />
              </label>

              <div className="char-field char-action">
                <FileButton
                  label={character.avatar ? '프로필 바꾸기' : '프로필'}
                  accept="image/*"
                  onPick={async (file) => {
                    upsertCharacter(character.name, { avatar: await readFileAsDataUrl(file) });
                  }}
                />
              </div>
              <div className="char-field char-action">
                <button
                  type="button"
                  className="mini-button danger"
                  onClick={() => removeCharacter(character.name)}
                >
                  삭제
                </button>
              </div>
            </div>

            {character.avatar || character.dialogueColor
              || character.bubbleColor || character.bubbleTextColor ? (
              <div className="character-reset">
                {character.avatar ? (
                  <button type="button" className="mini-button"
                    onClick={() => upsertCharacter(character.name, { avatar: '' })}>
                    프로필 지우기
                  </button>
                ) : null}
                {character.dialogueColor || character.bubbleColor || character.bubbleTextColor ? (
                  <button
                    type="button"
                    className="mini-button"
                    title="비우면 공통 색을 씁니다"
                    onClick={() => upsertCharacter(character.name, {
                      dialogueColor: '', bubbleColor: '', bubbleTextColor: '',
                    })}
                  >
                    색 공통값으로
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
