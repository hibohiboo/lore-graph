import { useState } from 'react';

type ExtractedFact = {
  subjectName: string;
  predicate: string;
  objectName: string;
  certainty: number;
};

type SeedResponse = {
  facts: ExtractedFact[];
};

export const useSeed = () => {
  const [text, setText] = useState('');
  const [registeredFacts, setRegisteredFacts] = useState<ExtractedFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);

    fetch('/api/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<SeedResponse>;
      })
      .then((data) => {
        setRegisteredFacts(data.facts);
        setText('');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return { text, setText, registeredFacts, loading, error, submit };
};
