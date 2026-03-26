import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getDriver, getAllNodes } from '@repo/graph-db';

const driver = getDriver();
const app = new Hono();

app.use('/api/*', cors());

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.get('/api/nodes', async (c) => {
  const nodes = await getAllNodes(driver);
  return c.json(nodes);
});

export default app;
