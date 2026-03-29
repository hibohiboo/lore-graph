import { Hono } from 'hono';
import { z } from 'zod';
import { type Driver } from 'neo4j-driver';
import { getNpcFacts } from '@repo/graph-db';
import { generateNpcReply, generateFactsFromQuestion } from '../services/llm.js';
import { mergeFactsToGraph } from '../services/graph-writer.js';

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

    const existingFacts = await getNpcFacts(db(), npcName);
    const newFacts = await generateFactsFromQuestion(npcName, playerMessage, existingFacts);
    if (newFacts.length > 0) {
      await mergeFactsToGraph(db(), npcName, newFacts);
    }
    const allFacts = await getNpcFacts(db(), npcName);
    const npcReply = await generateNpcReply(npcName, allFacts, playerMessage);

    return c.json({ npcReply, newFacts });
  });

  return app;
};
