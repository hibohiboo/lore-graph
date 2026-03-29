import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { type FactRecord } from '@repo/graph-db';

const FactRecordSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
});

const FactListResponseSchema = z.object({
  facts: z.array(FactRecordSchema),
});

export const useFactList = () => {
  const [facts, setFacts] = useState<FactRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchFacts = useCallback(() => {
    fetch('/api/facts')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        const parsed = FactListResponseSchema.parse(data);
        setFacts(parsed.facts);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      });
  }, []);

  useEffect(() => {
    fetchFacts();
  }, [fetchFacts]);

  const deleteFact = (fact: FactRecord) => {
    fetch('/api/facts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectName: fact.subject,
        predicate: fact.predicate,
        objectName: fact.object,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        fetchFacts();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      });
  };

  return { facts, error, deleteFact, refetch: fetchFacts };
};
