import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = JSON.parse(await fs.readFile(path.join(root, 'geodata/historical-regions-source.geojson'), 'utf8'));
const out = path.join(root, 'public/geolocation');
await fs.mkdir(out, { recursive: true });

const byId = new Map(source.features.map(f => [f.id, f]));
const koreaSource = byId.get('source-korea-peninsula');
const sakhalinSource = byId.get('source-sakhalin');
if (!koreaSource || !sakhalinSource) throw new Error('Historical source snapshot is incomplete');

function clipRingMaxLatitude(ring, maxLat) {
  const output = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    const aIn = a[1] <= maxLat, bIn = b[1] <= maxLat;
    if (aIn) output.push(a);
    if (aIn !== bIn) {
      const t = (maxLat - a[1]) / (b[1] - a[1]);
      output.push([a[0] + t * (b[0] - a[0]), maxLat]);
    }
  }
  if (output.length && (output[0][0] !== output.at(-1)[0] || output[0][1] !== output.at(-1)[1])) output.push([...output[0]]);
  return output;
}
function clipGeometryMaxLatitude(geometry, maxLat) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const clipped = polygons.map(poly => poly.map(r => clipRingMaxLatitude(r, maxLat)).filter(r => r.length >= 4)).filter(p => p.length);
  if (!clipped.length) throw new Error('Clipping removed entire geometry');
  return clipped.length === 1 ? { type: 'Polygon', coordinates: clipped[0] } : { type: 'MultiPolygon', coordinates: clipped };
}
function points(coords) { return typeof coords[0] === 'number' ? [coords] : coords.flatMap(points); }
function bounds(coords) { return points(coords).reduce((b,[x,y]) => [Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)], [Infinity,Infinity,-Infinity,-Infinity]); }
function collection({id,name,nameJa,nameKo,context,validFrom,validTo,capital,geometry,boundaryBasis}) {
  const boundary = { type:'Feature', id, properties:{ Kind:'historical-region', PrefectureName:name, PrefectureNameJapanese:nameJa, RegionName:name, RegionNameJapanese:nameJa, ...(nameKo?{RegionNameKorean:nameKo}:{}), GeographyType:'historical-territory', HistoricalContext:context, ValidFrom:validFrom, ValidTo:validTo, BoundaryBasis:boundaryBasis }, geometry };
  const marker = { type:'Feature', id:`${id}-capital`, properties:{ Kind:'capital', PrefectureName:name, PrefectureNameJapanese:nameJa, RegionName:name, CapitalName:capital.name, CapitalNameJapanese:capital.nameJa, ...(capital.nameKo?{CapitalNameKorean:capital.nameKo}:{}), ModernName:capital.modernName, PointKind:'historical-administrative-capital-reference-point' }, geometry:{ type:'Point', coordinates:capital.coordinates } };
  const bbox = bounds([geometry.coordinates, capital.coordinates]);
  return { type:'FeatureCollection', bbox, displayBbox:bbox, DataVersion:'historical-regions-v1', Attribution:{ BoundarySource:'Natural Earth public-domain geometry, curated by Ashiato Kai', BoundarySourceURL:'https://www.naturalearthdata.com/', BoundaryTermsURL:'https://www.naturalearthdata.com/about/terms-of-use/', HistoricalBoundaryNotice:boundaryBasis, Notice:'Historical reference geography for immigration-era records. It must not be interpreted as a statement about present-day sovereignty or borders. See GEOLOCATION.md and THIRD_PARTY_NOTICES.md.' }, features:[boundary,marker] };
}

const karafuto = collection({ id:'HIST-KARAFUTO', name:'Karafuto', nameJa:'樺太', context:'Karafuto under Japanese administration', validFrom:'1905-09-05', validTo:'1945-08-25', boundaryBasis:'Southern Sakhalin clipped at 50° N in accordance with Article IX of the 1905 Treaty of Portsmouth; small adjacent islands may be omitted by the source map scale.', capital:{name:'Toyohara',nameJa:'豊原',modernName:'Yuzhno-Sakhalinsk',coordinates:[142.733,46.959]}, geometry:clipGeometryMaxLatitude(sakhalinSource.geometry,50) });
const korea = collection({ id:'HIST-KOREA', name:'Korea', nameJa:'朝鮮', nameKo:'조선', context:'Korea under Japanese rule', validFrom:'1910-08-29', validTo:'1945-08-15', boundaryBasis:'Outer peninsula geometry derived by dissolving modern North Korea and South Korea Natural Earth country geometries; the modern inter-Korean boundary is intentionally absent. This is reference geography, not a reconstruction of internal 1910–1945 administrative divisions.', capital:{name:'Keijo',nameJa:'京城',nameKo:'경성',modernName:'Seoul',coordinates:[126.978,37.5665]}, geometry:koreaSource.geometry });

await fs.writeFile(path.join(out,'karafuto.geojson'), JSON.stringify(karafuto)+'\n');
await fs.writeFile(path.join(out,'korea.geojson'), JSON.stringify(korea)+'\n');
console.log('Generated historical maps: Karafuto and Korea.');
