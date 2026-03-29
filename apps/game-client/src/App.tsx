import './App.css';
import { SeedPanel } from './components/SeedPanel';
import { FactListPanel } from './components/FactListPanel';
import { ConversationPanel } from './components/ConversationPanel';
import { PersonaPanel } from './components/PersonaPanel';

function App() {
  return (
    <main>
      <h1>Lore Graph</h1>
      <PersonaPanel />
      <hr />
      <SeedPanel />
      <hr />
      <FactListPanel />
      <hr />
      <ConversationPanel npcName="酒場の娘" />
    </main>
  );
}

export default App;
