import { Hono } from 'hono';
import { listNpcNames } from '@repo/npc-mind';

export const createNpcsRoute = () => {
  const app = new Hono();

  app.get('/', (c) => c.json({ npcs: listNpcNames() }));

  return app;
};
