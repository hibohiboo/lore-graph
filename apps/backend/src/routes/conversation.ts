import { Hono } from 'hono';
import { z } from 'zod';
import { type Driver } from 'neo4j-driver';
import { getNpcFacts } from '@repo/graph-db';
import { generateNpcReply, extractFacts } from '../services/llm.ts';
import { mergeFactsToGraph } from '../services/graph-writer.ts';

const ConversationRequestSchema = z.object({
  npcName: z.string(),
  playerMessage: z.string(),
});

export const createConversationRoute = (db: () => Driver) => {
  const app = new Hono();

  app.post('/', async (c) => {
    const body = ConversationRequestSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: body.error.message }, 400);
    }
    const { npcName, playerMessage } = body.data;

    const knownFacts = await getNpcFacts(db(), npcName);
    const npcReply = await generateNpcReply(npcName, knownFacts, playerMessage);
    const extractedFacts = await extractFacts(npcName, playerMessage, npcReply);
    await mergeFactsToGraph(db(), npcName, extractedFacts);

    return c.json({ npcReply, extractedFacts });
  });

  return app;
};
