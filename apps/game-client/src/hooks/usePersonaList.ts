import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { NpcPersonaSchema, type NpcPersona } from '@repo/schema';

const PersonaListResponseSchema = z.object({
  personas: z.array(NpcPersonaSchema),
});

export const usePersonaList = () => {
  const [personas, setPersonas] = useState<NpcPersona[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchPersonas = useCallback(() => {
    fetch('/api/personas')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        const parsed = PersonaListResponseSchema.parse(data);
        setPersonas(parsed.personas);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      });
  }, []);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  const upsertPersona = (persona: NpcPersona) => {
    fetch('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(persona),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        fetchPersonas();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      });
  };

  const deletePersona = (name: string) => {
    fetch('/api/personas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        fetchPersonas();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      });
  };

  return { personas, error, upsertPersona, deletePersona, refetch: fetchPersonas };
};
