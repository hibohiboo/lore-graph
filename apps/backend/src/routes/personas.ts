import { Hono } from 'hono';
import { type Driver } from 'neo4j-driver';
import { getAllPersonas, upsertPersona, deletePersona } from '@repo/graph-db';
import { NpcPersonaSchema } from '@repo/schema';
import { z } from 'zod';

const DeletePersonaSchema = z.object({
  name: z.string(),
});

export const createPersonasRoute = (db: () => Driver) => {
  const app = new Hono();

  app.get('/', async (c) => {
    const personas = await getAllPersonas(db());
    return c.json({ personas });
  });

  app.post('/', async (c) => {
    const body = NpcPersonaSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: body.error.message }, 400);
    }
    await upsertPersona(db(), body.data);
    return c.json({ ok: true });
  });

  app.delete('/', async (c) => {
    const body = DeletePersonaSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: body.error.message }, 400);
    }
    await deletePersona(db(), body.data.name);
    return c.json({ ok: true });
  });

  return app;
};
