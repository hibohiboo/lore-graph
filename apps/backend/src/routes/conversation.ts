import { Hono } from 'hono';
import { z } from 'zod';
import { type Driver } from 'neo4j-driver';
import { getNpcFacts, getPersona, upsertPersona } from '@repo/graph-db';
import { getNpcDefinition } from '@repo/npc-mind';
import { generateNpcReply, generateFactsFromQuestion, extractFactsFromText, extractPersonaHintsFromReply } from '../services/llm.js';
import { mergeFactsToGraph } from '../services/graph-writer.js';
import { ConversationMessageSchema } from '@repo/schema';

const ConversationRequestSchema = z.object({
  npcName: z.string(),
  playerMessage: z.string(),
  history: z.array(ConversationMessageSchema).optional(),
});

export const createConversationRoute = (db: () => Driver) => {
  const app = new Hono();

  app.post('/', async (c) => {
    const body = ConversationRequestSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: body.error.message }, 400);
    }
    const { npcName, playerMessage, history } = body.data;

    const npcDef = getNpcDefinition(npcName);
    const [existingFacts, worldFacts, persona] = await Promise.all([
      getNpcFacts(db(), npcName),
      getNpcFacts(db(), '世界設定'),
      getPersona(db(), npcName),
    ]);
    const allExistingFacts = [...existingFacts, ...worldFacts];
    const newFacts = await generateFactsFromQuestion(npcName, playerMessage, allExistingFacts, persona, npcDef);
    if (newFacts.length > 0) {
      await mergeFactsToGraph(db(), npcName, newFacts);
    }
    const allFacts = [...(await getNpcFacts(db(), npcName)), ...worldFacts];
    const npcReply = await generateNpcReply(npcName, allFacts, playerMessage, persona, history, npcDef);

    const [replyFacts, personaHints] = await Promise.all([
      extractFactsFromText(npcReply, playerMessage),
      extractPersonaHintsFromReply(npcName, npcReply, persona),
    ]);

    if (replyFacts.length > 0) {
      await mergeFactsToGraph(db(), npcName, replyFacts);
    }

    const hasNewHints =
      personaHints.personalities.length > 0 ||
      personaHints.roles.length > 0 ||
      personaHints.knowledgeScopes.length > 0;

    if (hasNewHints) {
      const dedup = (existing: string[], additions: string[]) => {
        const set = new Set(existing);
        return [...existing, ...additions.filter((v) => !set.has(v))];
      };
      await upsertPersona(db(), {
        name: npcName,
        roles:          dedup(persona?.roles ?? [],          personaHints.roles),
        personalities:  dedup(persona?.personalities ?? [],  personaHints.personalities),
        knowledgeScopes:dedup(persona?.knowledgeScopes ?? [], personaHints.knowledgeScopes),
      });
    }

    return c.json({
      npcReply,
      newFacts: [...newFacts, ...replyFacts],
      newPersonaHints: hasNewHints ? personaHints : { personalities: [], roles: [], knowledgeScopes: [] },
    });
  });

  return app;
};
