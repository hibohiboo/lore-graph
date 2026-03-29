import './App.css';
import { SeedPanel } from './components/SeedPanel';
import { FactListPanel } from './components/FactListPanel';
import { ConversationPanel } from './components/ConversationPanel';
import { PersonaPanel } from './components/PersonaPanel';

function App() {
  return (
    <main>
      <h1>Lore Graph</h1>
      <p className="app-title-sub">— 酒場の娘に話しかけてみよう —</p>

      <ConversationPanel npcName="酒場の娘" />

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
