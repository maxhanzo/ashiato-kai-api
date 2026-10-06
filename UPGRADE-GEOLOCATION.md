# Deploy the geolocation update

This is a full copy of the supplied backend with the geolocation feature added.
Keep your existing project directory, Git history and `.wrangler` directory.
Copy the archive contents into that directory, merging folders and replacing the
corresponding project files. Do not delete your local D1 state.

New files/directories:

- `src/geolocation.ts` and `src/geolocation-manifest.ts`
- `public/geolocation/` (48 prepared GeoJSON assets; commit this directory)
- `geodata/` (small metadata and coordinate source evidence)
- `scripts/build-geolocation.mjs` (optional asset regeneration)
- `GEOLOCATION.md`, `UPGRADE-GEOLOCATION.md`, `THIRD_PARTY_NOTICES.md`

Updated files:

- `src/index.ts`: new routes and version 1.3.0
- `wrangler.jsonc`: `ASSETS` binding and Worker-first routing
- `package.json` / `package-lock.json`: optional mapshaper build tooling
- `tests/http.test.mjs`: geolocation coverage
- `README.md` and `.gitignore`

Your existing D1 name, ID and binding are preserved. If your own configuration
has changed since you supplied the archive, merge its `assets` section rather
than overwriting those newer settings.

From the existing project root:

```bash
npm ci
npm run cf-typegen
npm run typecheck
npm test
npm run dev
```

Open these local URLs:

- http://localhost:8787/api/v1/geolocation/Oita
- http://localhost:8787/api/v1/geolocation/Yamaguchi
- http://localhost:8787/api/v1/geolocation

Capital and boundary data are already built. You do **not** need to run
`geodata:build`, import the 72 MB source, recreate statistics, or execute SQL.
Geolocation tests need no database import; full-data regression tests remain
optional via the existing `TEST_DB` setting.

When local checks pass, stop the local server and run:

```bash
npm run deploy
```

Wrangler uploads the Worker and the static assets together. No separate manual
asset upload is needed. The new routes run through the Worker and count as
Worker requests; adding static assets does not make API requests exempt from
your plan's Worker limits.

Verify the deployed responses:

```bash
curl -I 'https://ashiato-kai-api.ashiato-kai.workers.dev/api/v1/geolocation/Oita'
curl 'https://ashiato-kai-api.ashiato-kai.workers.dev/api/v1/geolocation/Oita'
curl 'https://ashiato-kai-api.ashiato-kai.workers.dev/api/v1/geolocation'
curl 'https://ashiato-kai-api.ashiato-kai.workers.dev/api/v1/groups/48167'
```

Oita should return a GeoJSON FeatureCollection with a boundary and capital Point;
the overview should contain 47 prefectures. Also check one existing search and
statistics lookup. Commit the project files and assets, keeping generated types,
`.wrangler`, `.geodata-cache`, `node_modules` and database files out of Git.

## Validation performed for this package

- TypeScript type checking passed.
- All six test cases passed with the supplied database, including existing
  searches, groups and statistics reconciliation.
- All 47 detail boundaries and 47 overview boundaries passed Shapely geometry
  validity checks; all 47 capital markers fall inside their detail boundaries.
- Real local Workers runtime checks passed for all 47 asset routes, the overview,
  conditional ETag/304 requests, HEAD, and 400/404/405 responses.
- `wrangler deploy --dry-run` accepted the Worker and asset configuration.

The public Cloudflare deployment and iOS rendering remain for you to verify after
deployment; no production changes were made while preparing this package.

## Historical-region addition

No D1 migration is required for Karafuto or Korea. Deploy the new committed files under `public/geolocation/` together with the updated Worker manifest. To regenerate them before deployment, run `npm run geodata:build:historical` (or `npm run geodata:build:all` for all modern and historical assets).
