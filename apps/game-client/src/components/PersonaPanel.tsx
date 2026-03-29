import { useState } from 'react';
import { usePersonaList } from '../hooks/usePersonaList';

const NPC_NAME = '酒場の娘';
const emptyForm = () => ({ role: '', personality: '', knowledgeScope: '' });

export const PersonaPanel = () => {
  const { personas, error, upsertPersona, deletePersona } = usePersonaList();
  const [form, setForm] = useState(emptyForm());

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    upsertPersona({ name: NPC_NAME, ...form });
    setForm(emptyForm());
  };

  const handleEdit = (persona: { role: string; personality: string; knowledgeScope: string }) => {
    setForm({ role: persona.role, personality: persona.personality, knowledgeScope: persona.knowledgeScope });
  };

  return (
    <section>
      <h2>NPCペルソナ管理（{NPC_NAME}）</h2>
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <input
          placeholder="職業・役割"
          value={form.role}
          onChange={(e) => handleChange('role', e.target.value)}
        />
        <input
          placeholder="性格・口調"
          value={form.personality}
          onChange={(e) => handleChange('personality', e.target.value)}
        />
        <input
          placeholder="知識範囲"
          value={form.knowledgeScope}
          onChange={(e) => handleChange('knowledgeScope', e.target.value)}
        />
        <button onClick={handleSubmit}>
          登録 / 更新
        </button>
      </div>
      {personas.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>NPC名</th>
              <th style={{ textAlign: 'left' }}>職業・役割</th>
              <th style={{ textAlign: 'left' }}>性格・口調</th>
              <th style={{ textAlign: 'left' }}>知識範囲</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {personas.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.role}</td>
                <td>{p.personality}</td>
                <td>{p.knowledgeScope}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => handleEdit(p)} style={{ marginRight: '0.25rem' }}>
                    編集
                  </button>
                  <button onClick={() => deletePersona(p.name)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>登録されたペルソナはありません。</p>
      )}
    </section>
  );
};
