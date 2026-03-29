import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { ExtractedFactSchema } from '@repo/schema';
import { type FactRecord } from '@repo/graph-db';

const SeedResponseSchema = z.object({
  facts: z.array(ExtractedFactSchema),
  warning: z.string().optional(),
});

const FactRecordSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
});

const WorldFactsResponseSchema = z.object({
  facts: z.array(FactRecordSchema),
});

type ExtractedFact = z.infer<typeof ExtractedFactSchema>;

export const useSeed = () => {
  const [text, setText] = useState('');
  const [registeredFacts, setRegisteredFacts] = useState<ExtractedFact[]>([]);
  const [worldFacts, setWorldFacts] = useState<FactRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const fetchWorldFacts = useCallback(() => {
    fetch('/api/seed')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        const parsed = WorldFactsResponseSchema.parse(data);
        setWorldFacts(parsed.facts);
      })
      .catch(() => {
        // 一覧取得失敗は無視（登録・削除時に再取得）
      });
  }, []);

  useEffect(() => {
    fetchWorldFacts();
  }, [fetchWorldFacts]);

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
        if (parsed.warning) {
          setWarning(parsed.warning);
        } else {
          setText('');
          fetchWorldFacts();
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const deleteFact = (fact: FactRecord) => {
    fetch('/api/seed', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectName: fact.subject, predicate: fact.predicate, objectName: fact.object }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        fetchWorldFacts();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      });
  };

  return { text, setText, registeredFacts, worldFacts, loading, error, warning, submit, deleteFact };
};
