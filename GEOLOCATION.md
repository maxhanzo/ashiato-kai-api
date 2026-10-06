# Prefecture maps

The API serves prepared GeoJSON from Cloudflare Workers Static Assets. No D1
migration, R2 bucket, external API key or request-time GitHub download is needed.
The assets are included in this repository and uploaded with `npm run deploy`.

## Operations

| Method | Path | Result |
|---|---|---|
| GET / HEAD | `/api/v1/geolocation/Oita` | Oita boundary and capital marker |
| GET / HEAD | `/api/v1/geolocation/:PrefectureName` | One of the 47 modern prefectures |
| GET / HEAD | `/api/v1/geolocation` | Small Japan overview with 47 boundary features |

Use the database spelling of `PrefectureName`, for example `Oita`, `Ehime`,
`Yamaguchi` or `Hokkaido`. Romaji matching is case-insensitive and surrounding
whitespace is trimmed. The full Japanese names, such as `大分県`, also work when
URL-encoded. There is no fuzzy matching, suffix stripping or prefecture-code
lookup. All supported names and two-digit codes appear in
`geodata/prefectures.json`. Historical or unknown categories return 404; no map is
invented for records whose prefecture cannot be identified.

No query parameters are accepted. Unknown query parameters and blank/overlong
names return 400. Unsupported methods return 405 with `Allow: GET, HEAD`.
Errors use the existing API JSON error envelope. A missing deployed asset is a
500 configuration error; an unsupported prefecture is a 404. Successful responses
use `Content-Type: application/geo+json; charset=utf-8` and a one-day public cache
lifetime. ETags from Cloudflare are preserved; matching `If-None-Match` requests
can return 304. HEAD has no body.

## Response contract

The complete example is committed in `public/geolocation/oita.geojson`.
Both operations return a standard GeoJSON `FeatureCollection`. Coordinates are
longitude, latitude in decimal degrees, in the order expected by GeoJSON, not
Core Location's latitude, longitude initializer. This is display geography:
the underlying boundary data uses JGD2011 geographic coordinates, served in
GeoJSON's WGS84-compatible longitude/latitude convention without a datum/epoch
correction. It is not survey-precision data.

| Field | Meaning |
|---|---|
| `type` | `FeatureCollection` |
| `bbox` | `[west, south, east, north]`, encompassing every returned feature |
| `displayBbox` | Detail only: bounds of the largest polygon plus the capital marker; a suggested initial camera region |
| `DataVersion` | `2019-boundaries-v1`; version of this prepared snapshot |
| `Attribution` | Source names, URLs, boundary date and capital-source retrieval date |
| `features` | Two features for a prefecture, or 47 for Japan |

A prefecture detail contains:

1. **Boundary:** `id: "JP-44"` for Oita, `properties.Kind: "prefecture"`, with
   `PrefectureCode`, `PrefectureName` and `PrefectureNameJapanese` properties.
   Geometry is `Polygon` or `MultiPolygon`. Preserve interior rings (holes) and
   all polygon components when drawing it.
2. **Capital marker:** `id: "JP-44-capital"`, `properties.Kind: "capital"`, with
   `PrefectureCode`, `PrefectureName`, `CapitalName`, `CapitalNameJapanese` and
   `PointKind`. Geometry is `Point`. Oita's marker is
   `[131.61264, 33.238129]` and its names are `Oita` / `大分市`.

Capital markers use GSI's prefecture representative points, located in the
respective seats of government. They are approximate city-label positions, not
city centroids or a promise of the current office entrance. Tokyo's marker is located at the Tokyo Metropolitan Government seat in Nishi-Shinjuku, but the display label is **Tokyo / 東京**. Shinjuku is the ward containing the metropolitan government offices, not a capital city of Tokyo. Capital-name translations are maintained in the
small metadata file; coordinate provenance is retained separately.

The overview contains only boundary features, with the same IDs and prefecture
properties as the detailed response. Highlight a selected prefecture by matching
`PrefectureCode` (for example `44`) or `id` (`JP-44`). It has no capital markers and
no selection query parameter, so all clients can reuse the same overview file.

## MapKit integration

Pass the response bytes to `MKGeoJSONDecoder().decode(data)` and inspect each
`MKGeoJSONFeature`'s properties and geometry. Draw every polygon component,
including holes, and place an annotation for the capital Point. Handle both
Polygon and MultiPolygon; a single polygon is not enough for island prefectures.

Use the feature's `Kind` property to distinguish the boundary from the capital.
Parse the collection's `displayBbox` separately if using that camera hint:
MapKit's geometry decoder does not expose arbitrary collection metadata as your
app's model. Convert bounds to a map region/rect and add visual padding.

For Tokyo, Okinawa and other island prefectures, `bbox` can span a large ocean
area. `displayBbox` deliberately focuses the initial camera on the largest land
component; it can exclude distant islands. The geometry still includes those
islands. Use `bbox` to show the full returned extent instead.

The iOS app controls fill/stroke colors, labels, marker appearance and the inset
layout. Disable scrolling, zooming, rotation and pitch in the app for a static
map. This backend update does not include or compile an iOS view.

## Data preparation and attribution

- Boundaries: the supplied piuccio repository, pinned to commit
  `513fb852832c99470e16b95a30ddd68bf3469dc0`, derived from MLIT's
  `N03-19_190101` data (2019-01-01).
- Capital positions: GSI prefecture search results retrieved 2026-10-04.
  `geodata/capital-source-snapshot.json` retains only the selected source records
  and their URLs. The API never queries that service at runtime.
- Capital names: manually curated Romaji/Japanese names, checked against the
  Statistics Bureau's administrative map; Tokyo is displayed as `Tokyo / 東京`; its marker remains at the metropolitan government seat in Nishi-Shinjuku.
- All prefectures are processed together to maintain shared-border topology.
  Geometry is cleaned before and after simplification.
- Detail: 150-metre mapshaper simplification interval, splitting component
  polygons before simplifying with `keep-shapes`, then dissolving by prefecture.
  Small islands are retained where possible; cleaning and simplification can
  merge touching components, remove defects or simplify tiny holes.
- Overview: 1,000-metre simplification interval; island components of 1 km² or
  less are omitted to keep the inset small. All 47 prefectures remain present.
- Source extent and territorial depiction follow the upstream data. These are
  modern reference maps, **not boundaries reconstructed for 1908–1984**.

Keep `THIRD_PARTY_NOTICES.md` with redistributions and provide the source credits
in the app's map attribution or data-information view. These processed maps are
an Ashiato Kai derivative, not an official government map product.

## Rebuilding assets (optional)

Prepared files are committed. Neither `npm run dev` nor `npm run deploy` rebuilds
or downloads the large source. For maintainers who intentionally need a rebuild:

```bash
npm ci
npm run geodata:build
npm run cf-typegen
npm run typecheck
npm test
```

The builder downloads the pinned approximately 72 MB source to the ignored
`.geodata-cache/` directory and verifies its SHA-256. It uses the pinned mapshaper
dev dependency, the committed capital metadata and deterministic output paths.
To use an existing copy of that exact source:

```bash
npm run geodata:build -- --source /absolute/path/to/prefectures.geojson
```

A changed source deliberately fails the checksum. For a planned data refresh,
review source terms, update provenance and `DataVersion`, rebuild the assets,
review geometry/markers and rerun tests. Clients may keep the prior response for
up to 24 hours after a deployment.

## Deploying this update

See `UPGRADE-GEOLOCATION.md`. There is no SQL to execute for these routes.
Cloudflare configuration reference:
https://developers.cloudflare.com/workers/static-assets/binding/

MapKit decoder reference:
https://developer.apple.com/documentation/mapkit/mkgeojsondecoder

## Historical regions

The same endpoint also serves two historical reference regions used by immigration-era records:

| Route | Historical region | Administrative capital represented |
|---|---|---|
| `/api/v1/geolocation/Karafuto` | Karafuto (樺太) | Toyohara (豊原), present-day Yuzhno-Sakhalinsk |
| `/api/v1/geolocation/Korea` | Korea (朝鮮 / 조선) under Japanese rule | Keijo (京城 / 경성), present-day Seoul |

Aliases include `樺太`, `朝鮮`, `조선`, `Chosen`, and `Chōsen`. These assets use `GeographyType: historical-territory` and `DataVersion: historical-regions-v1`; they are deliberately **not** included in `japan.geojson`, which remains a modern 47-prefecture overview.

`karafuto.geojson` is derived from public-domain Natural Earth Sakhalin geometry and clipped at 50° N, following the territorial limit established by Article IX of the 1905 Treaty of Portsmouth. `korea.geojson` dissolves the modern North/South outer geometries so the modern inter-Korean boundary is absent. It is a historical reference outline, not a reconstruction of internal colonial administrative divisions.

Rebuild only these committed assets with `npm run geodata:build:historical`, or rebuild all geolocation assets with `npm run geodata:build:all`. The curated reproducible source snapshot is `geodata/historical-regions-source.geojson`.

Historical-region maps are contextual research aids. They must not be interpreted as statements about present-day sovereignty or borders.
