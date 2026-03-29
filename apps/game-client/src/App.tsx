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
    </main>
  );
}

export default App;
