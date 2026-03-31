import { useState } from 'react';
import { z } from 'zod';
import { ExtractedFactSchema, ConversationMessageSchema, PersonaHintsSchema } from '@repo/schema';

const ConversationResponseSchema = z.object({
  npcReply: z.string(),
  newFacts: z.array(ExtractedFactSchema),
  newPersonaHints: PersonaHintsSchema.optional(),
});

type ExtractedFact = z.infer<typeof ExtractedFactSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type PersonaHints = z.infer<typeof PersonaHintsSchema>;

export const useConversation = (npcName: string) => {
  const [playerMessage, setPlayerMessage] = useState('');
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [newFacts, setNewFacts] = useState<ExtractedFact[]>([]);
  const [newPersonaHints, setNewPersonaHints] = useState<PersonaHints>({ personalities: [], roles: [], knowledgeScopes: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!playerMessage.trim()) return;
    setLoading(true);
    setError(null);

    const snapshot = playerMessage;
    const historySnapshot = history;

    fetch('/api/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcName, playerMessage: snapshot, history: historySnapshot }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then(
            (body: unknown) => {
              const msg =
                body && typeof body === 'object' && 'error' in body
                  ? String((body as { error: unknown }).error)
                  : `${res.status} ${res.statusText}`;
              throw new Error(msg);
            },
            () => { throw new Error(`${res.status} ${res.statusText}`); },
          );
        }
        return res.json();
      })
      .then((data) => {
        const parsed = ConversationResponseSchema.parse(data);
        const now = new Date().toISOString();
        setHistory((prev) => [
          ...prev,
          { role: 'player' as const, content: snapshot, timestamp: now },
          { role: 'npc' as const, content: parsed.npcReply, timestamp: now },
        ]);
        setNewFacts(parsed.newFacts);
        setNewPersonaHints(parsed.newPersonaHints ?? { personalities: [], roles: [], knowledgeScopes: [] });
        setPlayerMessage('');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return { playerMessage, setPlayerMessage, history, newFacts, newPersonaHints, loading, error, sendMessage };
};
