import { useEffect, useRef } from 'react';
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
  const { playerMessage, setPlayerMessage, history, newFacts, loading, error, sendMessage } =
    useConversation(npcName);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, loading]);

  return (
    <section>
      <h2>{npcName} と話す</h2>

      {history.length > 0 || loading ? (
        <div className="chat-history" role="log" aria-label="会話履歴">
          {history.map((msg, i) =>
            msg.role === 'player' ? (
              <div key={i} className="chat-bubble chat-bubble--player">
                <span className="speaker-label">あなた：</span>
                <p>{msg.content}</p>
              </div>
            ) : (
              <div key={i} className="chat-bubble chat-bubble--npc">
                <p className="npc-name-badge">{npcName}</p>
                <blockquote>{msg.content}</blockquote>
              </div>
            )
          )}
          {loading ? (
            <div className="chat-bubble chat-bubble--npc">
              <p className="npc-name-badge">{npcName}</p>
              <blockquote><LoadingDots /></blockquote>
            </div>
          ) : null}
          <div ref={scrollRef} aria-hidden="true" />
        </div>
      ) : null}

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
