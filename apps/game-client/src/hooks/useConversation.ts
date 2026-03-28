import { useState } from 'react';

type ExtractedFact = {
  subjectName: string;
  predicate: string;
  objectName: string;
  certainty: number;
  at?: string;
  since?: string;
  until?: string;
};

type ConversationResponse = {
  npcReply: string;
  extractedFacts: ExtractedFact[];
};

export const useConversation = (npcName: string) => {
  const [playerMessage, setPlayerMessage] = useState('');
  const [npcReply, setNpcReply] = useState<string | null>(null);
  const [extractedFacts, setExtractedFacts] = useState<ExtractedFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!playerMessage.trim()) return;
    setLoading(true);
    setError(null);

    fetch('/api/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcName, playerMessage }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<ConversationResponse>;
      })
      .then((data) => {
        setNpcReply(data.npcReply);
        setExtractedFacts(data.extractedFacts);
        setPlayerMessage('');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return { playerMessage, setPlayerMessage, npcReply, extractedFacts, loading, error, sendMessage };
};
