import { useEffect, useRef } from 'react';
import { useConversation, type PersonaHints } from '../hooks/useConversation';

const LoadingDots = () => (
  <span className="loading-dots" aria-label="考え中">
    <span className="loading-dot" />
    <span className="loading-dot" />
    <span className="loading-dot" />
  </span>
);

const CATEGORY_LABELS: Record<keyof PersonaHints, string> = {
  personalities: '性格・口調',
  roles: '職業・役割',
  knowledgeScopes: '知識範囲',
};

type Props = {
  npcName: string;
};

export const ConversationPanel = ({ npcName }: Props) => {
  const { playerMessage, setPlayerMessage, history, newFacts, newPersonaHints, loading, error, sendMessage } =
    useConversation(npcName);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, loading]);

  const personaEntries = (Object.keys(CATEGORY_LABELS) as (keyof PersonaHints)[])
    .flatMap((cat) => newPersonaHints[cat].map((v) => ({ category: cat, value: v })));

  const totalDiscoveries = newFacts.length + personaEntries.length;

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

      {totalDiscoveries > 0 ? (
        <details>
          <summary>新たに判明したこと ({totalDiscoveries}件)</summary>

          {newFacts.length > 0 ? (
            <div className="discovery-section">
              <p className="discovery-label">
                <span className="discovery-tag discovery-tag--fact">Fact</span>
                記録された事実
              </p>
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
            </div>
          ) : null}

          {personaEntries.length > 0 ? (
            <div className="discovery-section">
              <p className="discovery-label">
                <span className="discovery-tag discovery-tag--persona">ペルソナ</span>
                追加されたペルソナ
              </p>
              <ul className="persona-hint-list">
                {personaEntries.map((entry, i) => (
                  <li key={i} className="persona-hint-chip">
                    <span className="persona-hint-category">{CATEGORY_LABELS[entry.category]}</span>
                    <span className="persona-hint-value">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </details>
      ) : null}
    </section>
  );
};
