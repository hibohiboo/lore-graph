import { useState } from 'react';
import { z } from 'zod';
import { ExtractedFactSchema } from '@repo/schema';

const ConversationResponseSchema = z.object({
  npcReply: z.string(),
  newFacts: z.array(ExtractedFactSchema),
});

type ExtractedFact = z.infer<typeof ExtractedFactSchema>;

export const useConversation = (npcName: string) => {
  const [playerMessage, setPlayerMessage] = useState('');
  const [npcReply, setNpcReply] = useState<string | null>(null);
  const [newFacts, setNewFacts] = useState<ExtractedFact[]>([]);
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
        return res.json();
      })
      .then((data) => {
        const parsed = ConversationResponseSchema.parse(data);
        setNpcReply(parsed.npcReply);
        setNewFacts(parsed.newFacts);
        setPlayerMessage('');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return { playerMessage, setPlayerMessage, npcReply, newFacts, loading, error, sendMessage };
};
