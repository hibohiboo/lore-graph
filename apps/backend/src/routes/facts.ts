import { Hono } from 'hono';
import { z } from 'zod';
import { type Driver } from 'neo4j-driver';
import { getAllFacts, hardDeleteFact } from '@repo/graph-db';

const DeleteFactSchema = z.object({
  subjectName: z.string(),
  predicate: z.string(),
  objectName: z.string(),
});

export const createFactsRoute = (db: () => Driver) => {
  const app = new Hono();

  app.get('/', async (c) => {
    const facts = await getAllFacts(db());
    return c.json({ facts });
  });

  app.delete('/', async (c) => {
    const body = DeleteFactSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: body.error.message }, 400);
    }
    const { subjectName, predicate, objectName } = body.data;
    await hardDeleteFact(db(), subjectName, predicate, objectName);
    return c.json({ ok: true });
  });

  return app;
};
