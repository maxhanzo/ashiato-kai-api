import { Hono } from 'hono';
import { ValidationError } from './validation';
import { geolocationAssets } from './geolocation-manifest';

const geolocation = new Hono<{ Bindings: { ASSETS: Fetcher } }>();

geolocation.use('*', async (c, next) => {
  if ([...new URL(c.req.url).searchParams].length) {
    throw new ValidationError('This endpoint accepts no query parameters');
  }
  await next();
});

// Only a manifest entry can become an asset path; input is never used as a path.
// Fetch through the Cloudflare binding, with no D1 query or external network call.
async function serveAsset(assets: Fetcher, file: string, request: Request): Promise<Response> {
  const headers = new Headers();
  const etag = request.headers.get('If-None-Match');
  if (etag) headers.set('If-None-Match', etag);
  const asset = await assets.fetch(new Request(`https://assets.local/geolocation/${file}.geojson`, { headers }));
  if (asset.status !== 200 && asset.status !== 304) {
    throw new Error(`Geolocation asset unavailable: ${file} (${asset.status})`);
  }
  const outputHeaders = new Headers(asset.headers);
  outputHeaders.set('Content-Type', 'application/geo+json; charset=utf-8');
  outputHeaders.set('Cache-Control', 'public, max-age=86400');
  outputHeaders.set('X-Content-Type-Options', 'nosniff');
  return new Response(asset.body, { status: asset.status, headers: outputHeaders });
}

geolocation.get('/', c => serveAsset(c.env.ASSETS, 'japan', c.req.raw));
geolocation.get('/:PrefectureName', async c => {
  const name = c.req.param('PrefectureName').trim();
  if (!name || name.length > 200) {
    throw new ValidationError('PrefectureName must contain 1–200 characters');
  }
  const file = geolocationAssets[name.toLowerCase()];
  if (!Object.hasOwn(geolocationAssets, name.toLowerCase())) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Geolocation map not found' } }, 404);
  }
  return serveAsset(c.env.ASSETS, file, c.req.raw);
});

export default geolocation;
