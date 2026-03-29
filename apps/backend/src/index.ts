import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getDriver } from '@repo/graph-db';
import { createConversationRoute } from './routes/conversation.js';
import { createSeedRoute } from './routes/seed.js';
import { createFactsRoute } from './routes/facts.js';
import { createPersonasRoute } from './routes/personas.js';
import { createNpcsRoute } from './routes/npcs.js';

let driver: ReturnType<typeof getDriver> | null = null;
const db = () => (driver ??= getDriver());

const app = new Hono();

app.use('/api/*', cors());

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.route('/api/conversation', createConversationRoute(db));
app.route('/api/seed', createSeedRoute(db));
app.route('/api/facts', createFactsRoute(db));
app.route('/api/personas', createPersonasRoute(db));
app.route('/api/npcs', createNpcsRoute());

export default app;
