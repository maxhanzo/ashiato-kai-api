# Ashiato Kai API

A read-only REST API helping people find records of relatives who immigrated from Japan to Brazil, discover their recorded Japanese names, and identify the people who travelled with them.

The database was compiled by Max Ueda from official immigration records translated by volunteers from the Brazilian Japanese community around 2007–2008. The supplied dataset contains **245,677 immigrant records**, **64,401 travelling groups**, and arrival years from **1908 to 1984**.

Japanese names are returned as recorded, including Kanji, Katakana and Hiragana. The API never generates Japanese spellings from Romaji. Matching records provide research leads; a name match alone does not establish identity or ancestry.

**Base URL:** https://api.ashiato-kai.com  
**Implementation version:** 1.3.0  
**API route version:** v1

## Technology and architecture

- TypeScript and Hono for routing, validation and JSON responses.
- Cloudflare Workers for hosting.
- Cloudflare D1, based on SQLite, for storage.
- Parameterised SQL for user-supplied filter values.
- Precomputed, indexed statistics tables for inexpensive ranking and count lookups.

| File | Responsibility |
|---|---|
| `src/index.ts` | Main routes, method restrictions and JSON errors |
| `src/models.ts` | Record types and repository interface |
| `src/repository.ts` | Immigrant and group queries |
| `src/service.ts` | Construction and consistency checking of group responses |
| `src/validation.ts` | Main-search and group-ID validation |
| `src/statistics.ts` | Statistics routes, validation, caching and snapshot-table queries |
| `src/geolocation.ts` | Prefecture-map routes backed by static assets |
| `public/geolocation/` | Prepared modern Japan/prefecture and historical-region GeoJSON |
| `sql/indexes.sql` | Main-search and group indexes |
| `sql/create-statistics.sql` | Create and populate statistics snapshots and indexes |
| `sql/verify-statistics.sql` | Check snapshot totals and example results |
| `tests/` | Validation, HTTP, repository and snapshot tests |

## Available operations

All operations use GET and return JSON. HEAD is also supported, without a response body. Other methods return 405.

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | API name and implementation version |
| GET | `/api/v1/immigrants` | Search immigrant records |
| GET | `/api/v1/groups/:groupID` | Retrieve a travelling group |
| GET | `/api/v1/statistics/surnames/top` | Ten most common Romaji + Japanese surname pairs |
| GET | `/api/v1/statistics/names/top` | Ten most common Romaji + Japanese given-name pairs |
| GET | `/api/v1/statistics/names` | All Japanese-writing variants of a Romaji given name, with global ranks and counts |
| GET | `/api/v1/statistics/prefectures/top` | Ten prefecture categories with the most immigrant records |
| GET | `/api/v1/statistics/surnames` | All variants of a Romaji surname, with global ranks and counts |
| GET | `/api/v1/statistics/prefectures` | Count and global rank for a named prefecture |
| GET | `/api/v1/geolocation/:RegionName` | Modern prefecture or supported historical-region boundary, capital marker and camera bounds |
| GET | `/api/v1/geolocation` | Simplified Japan overview with 47 prefectures |

There are no write endpoints, individual-record-by-ID endpoints or separate ship/year lookup endpoints in this version. Authentication is not required. Browser cross-origin CORS access is not configured; native iOS clients do not require CORS.

### 1. API information

```http
GET /
```

```json
{"name":"Ashiato Kai API","version":"1.3.0"}
```

This identifies the API; it does not test database health.

### 2. Search immigrant records

```http
GET /api/v1/immigrants?NameRomaji=Tadao&SurnameRomaji=Ueda
```

| Query parameter | Required | Meaning |
|---|---|---|
| `NameRomaji` | No* | Recorded given name in Romaji |
| `SurnameRomaji` | No* | Recorded surname in Romaji |
| `NameKanji` | No* | Recorded given name in Japanese script |
| `SurnameKanji` | No* | Recorded surname in Japanese script |
| `Destination` | No | Recorded destination |
| `Year` | No | Arrival year, four digits |
| `Farm` | No | Recorded farm |
| `ArrivalDate` | No | Valid date in `YYYY-MM-DD` format |
| `DepartureDate` | No | Valid date in `YYYY-MM-DD` format |
| `ShipName` | No | Recorded ship name |
| `PrefectureName` | No | Recorded prefecture of origin |

*No individual parameter is required; at least one parameter from the table must be supplied.

**At least one search parameter is mandatory.** Any supported parameter may be used by itself, including `NameKanji`, `SurnameKanji`, `Year`, `ShipName`, `PrefectureName`, `Destination`, `Farm`, `ArrivalDate` and `DepartureDate`. Parameters may be freely combined, and all supplied filters are combined with AND. Parameter names are case-sensitive and retain the database terminology. Client applications may impose narrower UX rules without changing the API contract.

Text comparisons use SQLite NOCASE: exact matching with ASCII case-insensitivity. For Japanese-script values, matching is exact Unicode text; SQLite NOCASE does not transliterate or normalise Kanji/Kana. `Ueda` matches `UEDA`; partial names, fuzzy matching and accent folding are not supported. Leading and trailing input whitespace is trimmed; stored values are preserved. Each supplied text value must contain 1–200 characters after trimming. Unknown parameters, repeated parameters and supplied blank values return 400. Omit unused optional parameters entirely.

The result is an array of **all matching rows**, ordered by `immigrantID`, without pagination or deduplication by name. No match returns `[]` with HTTP 200. `NameKanji` and `SurnameKanji` are both returned and accepted as search parameters, either independently or in combination with any other supported filter.

Kanji fields can initiate a search by themselves, for example `?SurnameKanji=上田`, or be combined with other filters such as `?SurnameKanji=上田&Year=1955`.

Example with additional filters:

```bash
curl -G 'https://api.ashiato-kai.com/api/v1/immigrants' \
  --data-urlencode 'NameRomaji=Tadao' \
  --data-urlencode 'SurnameRomaji=Ueda' \
  --data-urlencode 'Year=1955' \
  --data-urlencode 'PrefectureName=Yamaguchi'
```

```json
[
  {
    "immigrantID": 177819,
    "groupID": 48167,
    "Destination": "NÃO CONSTA",
    "Year": 1955,
    "Farm": "NÃO CONSTA",
    "ArrivalDate": "1955-09-15",
    "DepartureDate": "1955-08-04",
    "ShipName": "AMERICA-MARU",
    "PrefectureName": "Yamaguchi",
    "NameRomaji": "TADAO",
    "SurnameRomaji": "UEDA",
    "SurnameKanji": "上田",
    "NameKanji": "只雄"
  }
]
```

### 3. Retrieve a travelling group

```http
GET /api/v1/groups/10000
```

`groupID` must be a positive safe integer. A group can contain relatives, friends, acquaintances or a single person. Group membership does not imply a specific family relationship.

Shared attributes are returned once; individual attributes appear in `immigrants` ordered by `immigrantID`:

```json
{
  "groupID": 10000,
  "Destination": "SÃO PAULO",
  "Year": 1930,
  "Farm": "SÃO FRANCISCO",
  "ArrivalDate": "1930-04-30",
  "DepartureDate": "1930-03-15",
  "ShipName": "LA PLATA-MARU",
  "PrefectureName": "Aomori",
  "immigrants": [
    {"immigrantID":2,"NameRomaji":"SABURO","SurnameRomaji":"ANDO","SurnameKanji":"安東","NameKanji":"三郎"},
    {"immigrantID":3,"NameRomaji":"KIN","SurnameRomaji":"ANDO","SurnameKanji":"安東","NameKanji":"キン"},
    {"immigrantID":4,"NameRomaji":"SHIGERU","SurnameRomaji":"HACHISUKA","SurnameKanji":"蜂須賀","NameKanji":"茂"}
  ]
}
```

An absent group returns 404. Inconsistent shared attributes cause a server error rather than silently discarding differences.

### 4. Top ten surname pairs

```http
GET /api/v1/statistics/surnames/top
```

Accepts no query parameters. Returns ten entries ordered by descending `Count`, then `SurnameRomaji` and `SurnameKanji`. Example first entry:

```json
{"Rank":1,"SurnameRomaji":"SATO","SurnameKanji":"佐藤","Count":3511}
```

Each distinct original Romaji + Japanese pair is counted separately. `UEDA / 上田` and `UEDA / 植田` are different categories.

### 5. Top ten given-name pairs

```http
GET /api/v1/statistics/names/top
```

Accepts no query parameters. Returns ten entries ordered by descending `Count`, then `NameRomaji` and `NameKanji`. Each distinct original Romaji + Japanese pair is counted separately.

### 6. Top ten prefectures

```http
GET /api/v1/statistics/prefectures/top
```

Accepts no query parameters. Returns ten entries ordered by descending `Count`, then `PrefectureName`. Example first entry:

```json
{"Rank":1,"PrefectureName":"Kumamoto","Count":23888}
```

### 7. Look up surname ranks

```http
GET /api/v1/statistics/surnames?SurnameRomaji=Ueda
```

Requires only `SurnameRomaji`, exactly once. Matching is exact and ASCII case-insensitive. All recorded variants are returned, not just variants in the top ten:

```json
[
  {"Rank":32,"SurnameRomaji":"UEDA","SurnameKanji":"上田","Count":673},
  {"Rank":196,"SurnameRomaji":"UEDA","SurnameKanji":"植田","Count":195},
  {"Rank":2742,"SurnameRomaji":"UEDA","SurnameKanji":"上江田","Count":12},
  {"Rank":7324,"SurnameRomaji":"UEDA","SurnameKanji":"調査中","Count":4},
  {"Rank":11198,"SurnameRomaji":"UEDA","SurnameKanji":"宇榮田","Count":1}
]
```

Ranks are global, calculated across all surname pairs before the Romaji lookup. No match returns `[]` with HTTP 200.

### 8. Look up given-name spellings and ranks

```http
GET /api/v1/statistics/names?NameRomaji=Tadanobu
```

Requires only `NameRomaji`, exactly once. Matching is exact and ASCII case-insensitive. Every recorded `NameRomaji` + `NameKanji` pair is returned, so a single Romanised name can expose all Japanese spellings present in the historical records. Ranks are global across all given-name pairs. No match returns `[]` with HTTP 200.

### 9. Look up a prefecture count

```http
GET /api/v1/statistics/prefectures?PrefectureName=Ehime
```

Requires only `PrefectureName`, exactly once. Matching is exact and ASCII case-insensitive:

```json
[{"Rank":15,"PrefectureName":"Ehime","Count":5303}]
```

Returns an array, normally containing one entry. No match returns `[]` with HTTP 200. Both statistical lookups reject unknown, duplicate or blank query parameters and values longer than 200 characters after trimming.

### 10. Prefecture maps and Japan overview

```http
GET /api/v1/geolocation/Oita
GET /api/v1/geolocation
```

These routes return GeoJSON from Cloudflare Static Assets without D1 queries.
The prefecture response includes its outline, capital marker and camera bounds;
the overview includes all 47 modern prefectures. Historical lookups also support Karafuto (樺太) and Korea (朝鮮 / 조선); these are not added to the modern Japan overview. See [GEOLOCATION.md](GEOLOCATION.md)
for the complete contract, MapKit guidance and data limitations, and
[UPGRADE-GEOLOCATION.md](UPGRADE-GEOLOCATION.md) to deploy this update.

## Data and ranking semantics

| Table | Role | Rows/categories |
|---|---|---:|
| `ImmigrantGroupShipPrefecture` | Authoritative immigrant records | 245,677 |
| `SurnameStatistics` | Precomputed pair counts and ranks | 15,360 |
| `PrefectureStatistics` | Precomputed prefecture counts and ranks | 49 |

Each statistics table's `Count` values sum to 245,677. Prefecture categories are source labels, not a claim that modern Japan has 49 prefectures.

- Counts measure records in this dataset, not families, living descendants or all Japanese immigration outside its coverage.
- Ties use competition ranking: `1, 2, 2, 4`. Top lists contain ten entries, using the original text fields in SQLite binary order to resolve ties at the cutoff.
- Original spellings, nulls, empty strings and placeholders are preserved. `NÃO CONSTA` means “not recorded”; it is not converted to null. `調査中` means “under investigation” and is a placeholder, not a verified Japanese surname spelling.
- Names in `NameKanji` or `SurnameKanji` may include Kana despite their historical column names.
- Shared group fields were consistent across the supplied dataset. No kinship relationships are inferred.

Statistics responses use one-hour HTTP/Cloudflare Cache API caching. Uncached statistics requests still read only the small indexed snapshot tables. Geolocation responses have one-day HTTP caching. Other endpoints have no explicit application response cache. Snapshots are static: changing the source does not automatically update counts or ranks.

## Errors

```json
{"error":{"code":"INVALID_REQUEST","message":"At least one search parameter is required"}}
```

| HTTP status | Code | Meaning |
|---|---|---|
| 200 | — | Successful response, including an empty search array |
| 400 | `INVALID_REQUEST` | Invalid or missing parameters |
| 404 | `NOT_FOUND` | Unknown endpoint, absent group or unsupported prefecture map |
| 405 | `METHOD_NOT_ALLOWED` | Unsupported HTTP method; `Allow: GET, HEAD` |
| 500 | `INTERNAL_ERROR` | Database, group-consistency or static-asset failure |

Server errors expose a generic public message. Diagnostic errors are logged on the server.

## Local setup

Use Node.js 24 LTS with npm and a Wrangler-supported operating system. Commit `package-lock.json` for reproducible dependency installation.

```bash
npm ci
npm run cf-typegen
npm run typecheck
```

If npm reports blocked installation scripts, review them with `npm install-scripts ls`. The existing project uses esbuild, workerd and fsevents installation scripts; approve only dependencies you have reviewed, then run `npm rebuild` if required.

`wrangler.jsonc` binds `ashiato_kai` to the D1 database. The existing configuration points to this project's database. For a separate deployment, create your own D1 database and replace its name/ID in that configuration. Database IDs are identifiers, not authentication secrets. Authenticate using `npx wrangler login`; do not commit credentials.

### Initialise an empty local database

The data is not included in the repository. Obtain the authorised source database separately. Export only its final table:

```bash
sqlite3 -readonly '/absolute/path/to/ShinAshiato.db' \
  '.dump ImmigrantGroupShipPrefecture' > ashiato-kai-raw.sql

sed '/^BEGIN TRANSACTION;$/d; /^COMMIT;$/d; /^PRAGMA foreign_keys=OFF;$/d' \
  ashiato-kai-raw.sql > ashiato-kai.sql
```

From the project root, initialise the empty local D1 database:

```bash
npx wrangler d1 execute ashiato-kai --local --file=ashiato-kai.sql
npx wrangler d1 execute ashiato-kai --local --file=sql/indexes.sql
npx wrangler d1 execute ashiato-kai --local --file=sql/create-statistics.sql
npx wrangler d1 execute ashiato-kai --local --file=sql/verify-statistics.sql
npm run dev
```

Open http://localhost:8787. Local Wrangler data and remote Cloudflare data are separate. **Do not reimport the source into an already populated database.** Existing installations only need the new migration scripts when applicable.

### Tests

```bash
npm run typecheck
npm test
```

Optional full-data tests:

```bash
TEST_DB='/absolute/path/to/ShinAshiato.db' npm test
```

Tests cover validation, HTTP responses, source queries, snapshot creation, repeated migration, ties, counts and global ranks. Full-data tests open the original database read-only and use disposable snapshots. They are skipped without `TEST_DB`. Node tests do not exercise Cloudflare's Cache API; the cache-unavailable notice is expected outside Workers. Tests do not replace live deployment checks.

## Cloudflare deployment

The project database and statistics tables are already deployed. A code-only update normally needs:

```bash
npm run cf-typegen
npm run typecheck
npm test
npm run deploy
```

For an existing remote source database that does not yet have the snapshot tables, create them **before** deploying v1.2:

```bash
npx wrangler d1 execute ashiato-kai --remote --file=sql/create-statistics.sql
npx wrangler d1 execute ashiato-kai --remote --file=sql/verify-statistics.sql
npm run deploy
```

Check both snapshot totals equal 245,677. For a new, empty remote database, first import the authorised source SQL and apply `sql/indexes.sql`, using `--remote` in place of `--local`.

The snapshot creation script uses `IF NOT EXISTS`. Rerunning does not duplicate rows, but it also does not refresh or repair existing snapshot tables. If data ever changes, prepare an explicit snapshot rebuild and update the cache namespace in `src/statistics.ts`; browsers can retain old responses until their one-hour expiry.

After deployment, verify:

```bash
curl 'https://api.ashiato-kai.com/'
curl 'https://api.ashiato-kai.com/api/v1/immigrants?NameRomaji=Tadao&SurnameRomaji=Ueda'
curl 'https://api.ashiato-kai.com/api/v1/groups/48167'
curl 'https://api.ashiato-kai.com/api/v1/statistics/prefectures?PrefectureName=Ehime'
```

## Repository contents

Commit source, prepared `public/geolocation/` assets, `geodata/` metadata, build scripts, tests, schema/index/snapshot SQL scripts, documentation, `package.json`, `package-lock.json`, `tsconfig.json` and `wrangler.jsonc`.

The supplied `.gitignore` excludes dependency folders, local D1 state, generated types/builds, environment secrets, logs and database exports. SQL under `sql/` remains trackable. Gitignore rules do not remove files already tracked by Git; inspect `git status` before committing. Keep original database files and full data exports outside the repository.

See `LICENSE` for the existing project code notice. Geography sources and their terms are documented separately in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Immigration-record rights are separate from code and geography licensing.
