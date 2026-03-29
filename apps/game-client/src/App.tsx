import './App.css';
import { SeedPanel } from './components/SeedPanel';
import { FactListPanel } from './components/FactListPanel';
import { ConversationPanel } from './components/ConversationPanel';

function App() {
  return (
    <main>
      <h1>Lore Graph</h1>
      <SeedPanel />
      <hr />
      <FactListPanel />
      <hr />
      <ConversationPanel npcName="酒場の娘" />
    </main>
  );
}

export default App;
