import { useState, useEffect } from 'react';
import './App.css';
import { ConversationPanel } from './components/ConversationPanel';

type LoreNode = {
  id: string;
  label: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function App() {
  const [nodes, setNodes] = useState<LoreNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/nodes')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<LoreNode[]>;
      })
      .then((data) => {
        setNodes(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <main>
      <h1>Lore Graph</h1>
      {nodes.length === 0 ? (
        <p>No lore nodes found.</p>
      ) : (
        <ul>
          {nodes.map((node) => (
            <li key={node.id}>{node.label}</li>
          ))}
        </ul>
      )}
      <hr />
      <ConversationPanel npcName="酒場の娘" />
    </main>
  );
}

export default App;
