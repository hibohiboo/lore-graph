import { useState } from 'react';
import { usePersonaList } from '../hooks/usePersonaList';
import { type NpcPersona } from '@repo/schema';

const NPC_NAME = '酒場の娘';

const emptyPersona = (): NpcPersona => ({
  name: NPC_NAME,
  roles: [],
  personalities: [],
  knowledgeScopes: [],
});

type Category = 'roles' | 'personalities' | 'knowledgeScopes';

const LABELS: Record<Category, string> = {
  roles: '職業・役割',
  personalities: '性格・口調',
  knowledgeScopes: '知識範囲',
};

const TagInput = ({
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
    <div style={{ marginBottom: '0.5rem' }}>
      <strong>{label}</strong>
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', margin: '0.25rem 0' }}>
        {items.map((item, i) => (
          <span
            key={i}
            style={{ background: '#eee', borderRadius: '4px', padding: '2px 6px', display: 'flex', gap: '4px', alignItems: 'center' }}
          >
            {item}
            <button
              onClick={() => onRemove(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`${label}を入力`}
          style={{ flex: 1 }}
        />
        <button onClick={handleAdd}>追加</button>
      </div>
    </div>
  );
};

export const PersonaPanel = () => {
  const { personas, error, upsertPersona, deletePersona } = usePersonaList();
  const [form, setForm] = useState<NpcPersona>(emptyPersona());

  const addItem = (category: Category, value: string) => {
    setForm((prev) => ({ ...prev, [category]: [...prev[category], value] }));
  };

  const removeItem = (category: Category, index: number) => {
    setForm((prev) => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = () => {
    upsertPersona(form);
    setForm(emptyPersona());
  };

  const handleEdit = (persona: NpcPersona) => {
    setForm({ ...persona });
  };

  const current = personas.find((p) => p.name === NPC_NAME);

  return (
    <section>
      <h2>NPCペルソナ管理（{NPC_NAME}）</h2>
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '0.75rem', marginBottom: '0.5rem' }}>
        {(Object.keys(LABELS) as Category[]).map((cat) => (
          <TagInput
            key={cat}
            label={LABELS[cat]}
            items={form[cat]}
            onAdd={(v) => addItem(cat, v)}
            onRemove={(i) => removeItem(cat, i)}
          />
        ))}
        <button onClick={handleSubmit}>登録 / 更新</button>
      </div>
      {current ? (
        <div>
          <strong>現在のペルソナ</strong>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.25rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>職業・役割</th>
                <th style={{ textAlign: 'left' }}>性格・口調</th>
                <th style={{ textAlign: 'left' }}>知識範囲</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{current.roles.join('、') || '—'}</td>
                <td>{current.personalities.join('、') || '—'}</td>
                <td>{current.knowledgeScopes.join('、') || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => handleEdit(current)} style={{ marginRight: '0.25rem' }}>
                    編集
                  </button>
                  <button onClick={() => deletePersona(current.name)}>削除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p>ペルソナが登録されていません。</p>
      )}
    </section>
  );
};
