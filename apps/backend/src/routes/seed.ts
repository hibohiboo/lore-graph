import { Hono } from 'hono';
import { z } from 'zod';
import { type Driver } from 'neo4j-driver';
import { extractFactsFromText } from '../services/llm.js';
import { mergeFactsToGraph } from '../services/graph-writer.js';

const WORLD_NPC = '世界設定';

const SeedRequestSchema = z.object({
  text: z.string(),
});

export const createSeedRoute = (db: () => Driver) => {
  const app = new Hono();

  app.post('/', async (c) => {
    const body = SeedRequestSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: body.error.message }, 400);
    }
    const { text } = body.data;

    const facts = await extractFactsFromText(text);
    if (facts.length > 0) {
      await mergeFactsToGraph(db(), WORLD_NPC, facts);
      return c.json({ facts });
    }

    return c.json({ facts: [], warning: '事実を抽出できませんでした。別の表現で試してください。' });
  });

  return app;
};
