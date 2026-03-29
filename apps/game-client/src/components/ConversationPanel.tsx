import { useConversation } from '../hooks/useConversation';

const LoadingDots = () => (
  <span className="loading-dots" aria-label="考え中">
    <span className="loading-dot" />
    <span className="loading-dot" />
    <span className="loading-dot" />
  </span>
);

type Props = {
  npcName: string;
};

export const ConversationPanel = ({ npcName }: Props) => {
  const { playerMessage, setPlayerMessage, npcReply, newFacts, loading, error, sendMessage } =
    useConversation(npcName);

  return (
    <section>
      <h2>{npcName} と話す</h2>
      <label className="speaker-label" htmlFor="player-message">あなた：</label>
      <textarea
        id="player-message"
        value={playerMessage}
        onChange={(e) => setPlayerMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendMessage();
        }}
        placeholder="メッセージを入力… (Ctrl+Enter で送信)"
        rows={3}
        aria-label={`${npcName}へのメッセージ`}
      />
      <button type="button" className="btn-send" onClick={sendMessage} disabled={loading || !playerMessage.trim()}>
        {loading ? <LoadingDots /> : '送信'}
      </button>
      {error ? <p className="inline-error" role="alert">エラー: {error}</p> : null}
      {npcReply ? (
        <div className="npc-reply" aria-live="polite">
          <p className="npc-name-badge">{npcName}</p>
          <blockquote>{npcReply}</blockquote>
        </div>
      ) : null}
      {newFacts.length > 0 ? (
        <details>
          <summary>新たに判明したこと ({newFacts.length}件)</summary>
          <ul className="fact-pill-list">
            {newFacts.map((f, i) => (
              <li key={i} className="fact-pill">
                <span className="fact-pill-subject">{f.subjectName}</span>
                <span className="fact-pill-predicate">—{f.predicate}—</span>
                <span className="fact-pill-object">{f.objectName}</span>
                <span className="fact-pill-certainty">{Math.round(f.certainty * 100)}%</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
};
