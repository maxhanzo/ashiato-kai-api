import { Hono } from 'hono';
import statistics from './statistics';
import geolocation from './geolocation';
import { D1Repository } from './repository';
import { ImmigrantService } from './service';
import { parseGroupID, parseSearch, ValidationError } from './validation';
const app = new Hono<{ Bindings: { ashiato_kai: D1Database; ASSETS: Fetcher } }>();
app.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    c.header('Allow', 'GET, HEAD');
    return c.json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET and HEAD are supported' } }, 405);
  }
  await next();
});
app.get('/', c => c.json({ name: 'Ashiato Kai API', version: '1.3.0' }));
app.get('/api/v1/immigrants', async c => {
  const filters = parseSearch(new URL(c.req.url).searchParams);
  const service = new ImmigrantService(new D1Repository(c.env.ashiato_kai));
  return c.json(await service.search(filters));
});
app.get('/api/v1/groups/:groupID', async c => {
  const id = parseGroupID(c.req.param('groupID'));
  const service = new ImmigrantService(new D1Repository(c.env.ashiato_kai));
  const group = await service.group(id);
  return group ? c.json(group) : c.json({ error: { code: 'NOT_FOUND', message: 'Group not found' } }, 404);
});
app.route('/api/v1/statistics', statistics);
app.route('/api/v1/geolocation', geolocation);
app.notFound(c => c.json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }, 404));
app.onError((error, c) => {
  if (error instanceof ValidationError) return c.json({ error: { code: 'INVALID_REQUEST', message: error.message } }, 400);
  console.error('API request failed', error);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to retrieve records' } }, 500);
});
export default app;
