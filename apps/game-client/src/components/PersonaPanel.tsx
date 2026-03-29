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
  const handleAdd = () => {
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput('');
  };
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <strong>{label}</strong>
      <ul style={{ margin: '0.25rem 0', paddingLeft: '1rem' }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{item}</span>
            <button onClick={() => onRemove(i)} style={{ fontSize: '0.75rem' }}>削除</button>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`${label}を入力`}
          style={{ flex: 1 }}
        />
        <button onClick={handleAdd} disabled={!input.trim()}>追加</button>
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

  return (
    <section>
      <h2>NPCペルソナ管理（{NPC_NAME}）</h2>
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
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
        <button onClick={() => deletePersona(NPC_NAME)} style={{ fontSize: '0.75rem', color: 'red' }}>
          ペルソナをすべて削除
        </button>
      ) : null}
    </section>
  );
};
