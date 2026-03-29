import { useState } from 'react';
import { z } from 'zod';
import { ExtractedFactSchema } from '@repo/schema';

const SeedResponseSchema = z.object({
  facts: z.array(ExtractedFactSchema),
  warning: z.string().optional(),
});

type ExtractedFact = z.infer<typeof ExtractedFactSchema>;

export const useSeed = () => {
  const [text, setText] = useState('');
  const [registeredFacts, setRegisteredFacts] = useState<ExtractedFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setWarning(null);

    fetch('/api/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        const parsed = SeedResponseSchema.parse(data);
        setRegisteredFacts(parsed.facts);
        if (parsed.warning) setWarning(parsed.warning);
        else setText('');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return { text, setText, registeredFacts, loading, error, warning, submit };
};
