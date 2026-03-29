import './App.css';
import { SeedPanel } from './components/SeedPanel';
import { FactListPanel } from './components/FactListPanel';
import { ConversationPanel } from './components/ConversationPanel';
import { PersonaPanel } from './components/PersonaPanel';

function App() {
  return (
    <main>
      <h1>Lore Graph</h1>
      <ConversationPanel npcName="酒場の娘" />
      <hr />
      <PersonaPanel />
      <hr />
      <SeedPanel />
      <hr />
      <FactListPanel />
      <footer style={{ marginTop: '2rem', textAlign: 'center' }}>
        <a
          href="https://github.com/hibohiboo/lore-graph"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '0.75rem', color: '#888', textDecoration: 'none' }}
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}

export default App;

