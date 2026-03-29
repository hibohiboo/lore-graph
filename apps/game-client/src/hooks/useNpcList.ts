import { useEffect, useState } from 'react';
import { z } from 'zod';

const NpcListResponseSchema = z.object({
  npcs: z.array(z.string()),
});

export const useNpcList = () => {
  const [npcs, setNpcs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/npcs')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        const parsed = NpcListResponseSchema.parse(data);
        setNpcs(parsed.npcs);
      })
      .catch(() => {
        setNpcs([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { npcs, loading };
};
