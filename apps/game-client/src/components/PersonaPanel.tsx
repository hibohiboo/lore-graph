import { useState } from 'react';
import { usePersonaList } from '../hooks/usePersonaList';
import { type NpcPersona } from '@repo/schema';

const NPC_NAME = '酒場の娘';

type Category = 'roles' | 'personalities' | 'knowledgeScopes';

const LABELS: Record<Category, string> = {
  roles: '職業・役割',
  personalities: '性格・口調',
  knowledgeScopes: '知識範囲',
};

const CategorySection = ({
  label,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
}) => {
  const [input, setInput] = useState('');
  const inputId = `persona-input-${label}`;
  const handleAdd = () => {
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput('');
  };
  return (
    <div className="category-section">
      <h3>{label}</h3>
      {items.length > 0 ? (
        <ul className="tag-chip-list">
          {items.map((item, i) => (
            <li key={i} className="tag-chip">
              <span>{item}</span>
              <button
                type="button"
                className="tag-chip-remove"
                onClick={() => onRemove(i)}
                aria-label={`${label}「${item}」を削除`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="category-add-row">
        <label htmlFor={inputId} className="sr-only">{label}を入力</label>
        <input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`${label}を入力…`}
          autoComplete="off"
        />
        <button type="button" onClick={handleAdd} disabled={!input.trim()}>追加</button>
      </div>
    </div>
  );
};

export const PersonaPanel = () => {
  const { personas, error, upsertPersona, deletePersona } = usePersonaList();
  const current: NpcPersona = personas.find((p) => p.name === NPC_NAME) ?? {
    name: NPC_NAME,
    roles: [],
    personalities: [],
    knowledgeScopes: [],
  };

  const addItem = (category: Category, value: string) => {
    upsertPersona({ ...current, [category]: [...current[category], value] });
  };

  const removeItem = (category: Category, index: number) => {
    upsertPersona({ ...current, [category]: current[category].filter((_, i) => i !== index) });
  };

  const handleDeleteAll = () => {
    if (!window.confirm(`「${NPC_NAME}」のペルソナをすべて削除しますか？`)) return;
    deletePersona(NPC_NAME);
  };

  return (
    <section>
      <h2>NPCペルソナ（{NPC_NAME}）</h2>
      {error ? <p className="inline-error" role="alert">エラー: {error}</p> : null}
      {(Object.keys(LABELS) as Category[]).map((cat) => (
        <CategorySection
          key={cat}
          label={LABELS[cat]}
          items={current[cat]}
          onAdd={(v) => addItem(cat, v)}
          onRemove={(i) => removeItem(cat, i)}
        />
      ))}
      {personas.some((p) => p.name === NPC_NAME) ? (
        <button type="button" className="btn-danger" onClick={handleDeleteAll}>
          ペルソナをすべて削除
        </button>
      ) : null}
    </section>
  );
};
