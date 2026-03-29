import { useState } from 'react';
import './App.css';
import { SeedPanel } from './components/SeedPanel';
import { FactListPanel } from './components/FactListPanel';
import { ConversationPanel } from './components/ConversationPanel';
import { PersonaPanel } from './components/PersonaPanel';
import { useNpcList } from './hooks/useNpcList';

function App() {
  const { npcs, loading: npcsLoading } = useNpcList();
  const [selectedNpc, setSelectedNpc] = useState<string>('');

  const currentNpc = selectedNpc || npcs[0] || '';

  return (
    <main id="main">
      <a href="#main" className="skip-link">メインコンテンツへスキップ</a>
      <h1>Lore Graph</h1>
      <p className="app-title-sub">— 酒場の娘に話しかけてみよう —</p>

      {!npcsLoading && npcs.length > 1 ? (
        <div className="npc-selector">
          <label htmlFor="npc-select" className="npc-selector__label">NPC：</label>
          <select
            id="npc-select"
            className="npc-selector__select"
            value={currentNpc}
            onChange={(e) => setSelectedNpc(e.target.value)}
          >
            {npcs.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      ) : null}

      {currentNpc ? <ConversationPanel npcName={currentNpc} /> : null}

      <hr />

      <details>
        <summary style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '0.06em' }}>
          マスター設定
        </summary>
        <div className="admin-section" style={{ marginTop: '0.75rem' }}>
          <PersonaPanel />
          <SeedPanel />
          <FactListPanel />
        </div>
      </details>

      <footer>
        <a
          href="https://github.com/hibohiboo/lore-graph"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}

export default App;
