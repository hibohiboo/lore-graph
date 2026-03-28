import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getDriver } from '@repo/graph-db';
import { createConversationRoute } from './routes/conversation.js';

let driver: ReturnType<typeof getDriver> | null = null;
const db = () => (driver ??= getDriver());

const app = new Hono();

app.use('/api/*', cors());

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.route('/api/conversation', createConversationRoute(db));

export default app;
