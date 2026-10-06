# Ashiato Kai API v1.2 — precomputed statistics

## Tables

SurnameStatistics: SurnameRomaji, SurnameKanji, Count, Rank.
NameStatistics: NameRomaji, NameKanji, Count, Rank.
PrefectureStatistics: PrefectureName, Count, Rank.

sql/create-statistics.sql creates and populates all three tables from ImmigrantGroupShipPrefecture with CREATE TABLE AS SELECT, then creates indexes for top-ten and name lookups. Counts and global ranks are computed once. It never modifies the source table. API requests SELECT directly from the new tables with no GROUP BY or window functions.

The script uses IF NOT EXISTS: rerunning after success does not duplicate data or refresh an existing snapshot. If a first attempt fails partway through, inspect the error before retrying. Existing table contents are deliberately trusted, so do not use these names for unrelated or manually created empty tables. Source updates, if ever needed, require a separate explicit snapshot rebuild; this script does not refresh existing tables.

## Update existing project (from v1 or v1.1)

Stop npm run dev using Ctrl+C. Copy all files in src/ and tests/ into the corresponding existing directories. Copy sql/create-statistics.sql and sql/verify-statistics.sql. No new npm dependency or Wrangler configuration change is required. Keep your existing database and generated types. The ZIP includes complete project configuration for convenience.

All commands below run from the ashiato-kai-api project root.

### 1. Build snapshots locally and verify

Your local source table is already populated from the previous working setup. Do not reimport it.

```bash
npx wrangler d1 execute ashiato-kai --local --file=sql/create-statistics.sql
npx wrangler d1 execute ashiato-kai --local --file=sql/verify-statistics.sql
npm run typecheck
npm test
npm run dev
```

If types are missing after copying the full project, run npm install and npm run cf-typegen before typecheck.

Expected verification totals:

| StatisticsTable | Categories | Immigrants |
|---|---:|---:|
|SurnameStatistics|15360|245677|
|PrefectureStatistics|49|245677|

Ehime: Rank 15, Count 5303.

### 2. Test local HTTP endpoints

Open these URLs while the server is running:

- http://localhost:8787/api/v1/statistics/surnames/top
- http://localhost:8787/api/v1/statistics/names/top
- http://localhost:8787/api/v1/statistics/names?NameRomaji=Tadanobu
- http://localhost:8787/api/v1/statistics/prefectures/top
- http://localhost:8787/api/v1/statistics/surnames?SurnameRomaji=Ueda
- http://localhost:8787/api/v1/statistics/prefectures?PrefectureName=Ehime

Also confirm your existing immigrant search and group endpoints still work.

### 3. Create Cloudflare tables BEFORE deploying updated code

Stop the server or use a second terminal in the project directory.

```bash
npx wrangler d1 execute ashiato-kai --remote --file=sql/create-statistics.sql
npx wrangler d1 execute ashiato-kai --remote --file=sql/verify-statistics.sql
```

Check that totals match the table above. If either command fails, stop and inspect the error before deploying. Only these new SQL files need uploading; the original database must not be uploaded again. sql/statistics-indexes.sql from v1.1 is no longer required. Any previously created source indexes can remain.

### 4. Deploy

```bash
npm run deploy
```

Live URLs:

- https://ashiato-kai-api.ashiato-kai.workers.dev/api/v1/statistics/surnames/top
- https://ashiato-kai-api.ashiato-kai.workers.dev/api/v1/statistics/names/top
- https://ashiato-kai-api.ashiato-kai.workers.dev/api/v1/statistics/names?NameRomaji=Tadanobu
- https://ashiato-kai-api.ashiato-kai.workers.dev/api/v1/statistics/prefectures/top
- https://ashiato-kai-api.ashiato-kai.workers.dev/api/v1/statistics/surnames?SurnameRomaji=Ueda
- https://ashiato-kai-api.ashiato-kai.workers.dev/api/v1/statistics/prefectures?PrefectureName=Ehime

Expected Ehime response:

```json
[{"Rank":15,"PrefectureName":"Ehime","Count":5303}]
```

## Semantics

Existing statistics endpoints and response fields remain unchanged. The new prefecture lookup uses exact ASCII case-insensitive matching and returns an array (usually one object). All matches are preserved if differently cased source categories exist. No match returns HTTP 200 with []. Missing, blank, repeated or unknown query parameters return 400. Only PrefectureName is allowed on the prefecture lookup. Only SurnameRomaji is allowed on the surname lookup. Only NameRomaji is allowed on the name lookup. Top endpoints accept no query parameters.

Each original Romaji/Japanese pair is a separate surname or given-name category. Name lookups return every matching NameRomaji/NameKanji pair, so one Romanised name can expose all spellings present in the historical records. Count is immigrant records, not family groups or current population. Ranking is global across all original categories before lookup. Ties use competition rank (1, 2, 2, 4). Top endpoints return exactly ten entries, resolving equal-count ordering with original field values in SQLite binary order. Surname lookups return every matching pair without a ten-row limit.

No script merges, trims, modernises or infers Japanese spellings. Nulls and source placeholders remain categories. In particular UEDA / 調査中 represents four records with a placeholder (“under investigation”), not a verified surname spelling.

One-hour Cache API response caching remains as an additional optimisation. The cache namespace changed to ashiato-statistics-v3. Old browser responses can persist until their expiry, but previous endpoint results are equivalent. Uncached requests now use small indexed snapshot tables; they do not scan all 245,677 immigrants. Snapshot creation itself still reads the source and writes the new tables once. No extra database service is needed.

## Verification performed

Type checking and five tests passed. Full-data tests independently verified every surname and prefecture count and global rank, total reconciliation, index-based prefecture lookup, migration rerun behaviour, ties, all surname variants, parameter rejection, and continued operation after the source table was removed from a disposable test database. Original database remained read-only. Existing name/group tests also passed.

Tests used SQLite-backed D1 adapters. Remote D1 execution, Cloudflare cache behaviour and deployment must be verified using the commands above; they have not been performed on your account.
