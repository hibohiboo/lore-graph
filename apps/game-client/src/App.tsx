import './App.css';
import { SeedPanel } from './components/SeedPanel';
import { ConversationPanel } from './components/ConversationPanel';

function App() {
  return (
    <main>
      <h1>Lore Graph</h1>
      <SeedPanel />
      <hr />
      <ConversationPanel npcName="酒場の娘" />
    </main>
  );
}

export default App;
