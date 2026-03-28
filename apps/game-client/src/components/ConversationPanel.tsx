import { useConversation } from '../hooks/useConversation';

type Props = {
  npcName: string;
};

export const ConversationPanel = ({ npcName }: Props) => {
  const { playerMessage, setPlayerMessage, npcReply, newFacts, loading, error, sendMessage } =
    useConversation(npcName);

  return (
    <section>
      <h2>{npcName} と話す</h2>
      <textarea
        value={playerMessage}
        onChange={(e) => setPlayerMessage(e.target.value)}
        placeholder="メッセージを入力..."
        rows={3}
        style={{ width: '100%' }}
      />
      <button onClick={sendMessage} disabled={loading || !playerMessage.trim()}>
        {loading ? '考え中...' : '送信'}
      </button>
      {error && <p style={{ color: 'red' }}>エラー: {error}</p>}
      {npcReply && (
        <div>
          <h3>返答:</h3>
          <blockquote>{npcReply}</blockquote>
        </div>
      )}
      {newFacts.length > 0 ? (
        <details>
          <summary>新たに判明したFact ({newFacts.length}件)</summary>
          <ul>
            {newFacts.map((f, i) => (
              <li key={i}>
                {f.subjectName} — {f.predicate} — {f.objectName}
                <small> (確信度: {f.certainty})</small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
};
