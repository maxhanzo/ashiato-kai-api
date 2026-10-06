// Optional maintainer task. Normal development/deployment uses committed assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const sourceURL = 'https://raw.githubusercontent.com/piuccio/open-data-jp-prefectures-geojson/513fb852832c99470e16b95a30ddd68bf3469dc0/output/prefectures.geojson';
const expectedHash = 'c12ec2656d13fe9c59237e742274fbc072e6b4a540de3cc41d432042aef7bace';
const cache = path.join(root, '.geodata-cache');
await fs.mkdir(cache, { recursive: true });
const sourceIndex = process.argv.indexOf('--source');
const sourcePath = sourceIndex >= 0 ? path.resolve(process.argv[sourceIndex + 1]) : path.join(cache, 'source.geojson');
if (sourceIndex < 0) {
  try { await fs.access(sourcePath); } catch {
    console.log('Downloading pinned boundary source (about 72 MB)...');
    const response = await fetch(sourceURL);
    if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
    await fs.writeFile(sourcePath, Buffer.from(await response.arrayBuffer()));
  }
}
const sourceBytes = await fs.readFile(sourcePath);
if (createHash('sha256').update(sourceBytes).digest('hex') !== expectedHash) throw new Error('Boundary source checksum mismatch');
const metadata = JSON.parse(await fs.readFile(path.join(root, 'geodata/prefectures.json'), 'utf8'));
if (metadata.length !== 47) throw new Error('Expected 47 prefectures');
const byJapaneseName = new Map(metadata.map(p => [p.PrefectureNameJapanese, p]));
const attribution = {
  BoundarySource: 'MLIT National Land Numerical Information, via Fabio Crisci / piuccio',
  BoundarySourceURL: 'https://github.com/piuccio/open-data-jp-prefectures-geojson/tree/513fb852832c99470e16b95a30ddd68bf3469dc0',
  BoundaryDate: '2019-01-01',
  CapitalSource: 'Geospatial Information Authority of Japan (GSI), prefecture representative points',
  CapitalSourceURL: 'https://maps.gsi.go.jp/',
  CapitalSourceRetrieved: '2026-10-04',
  Notice: 'Simplified and enriched by Ashiato Kai. Modern geographic context, not historical immigration-era boundaries. See GEOLOCATION.md and THIRD_PARTY_NOTICES.md.',
};
function points(coords) { return typeof coords[0] === 'number' ? [coords] : coords.flatMap(points); }
function bounds(coords) {
  const xy = points(coords);
  return xy.reduce((b, [x,y]) => [Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)], [Infinity,Infinity,-Infinity,-Infinity]);
}
function area(ring) {
  return Math.abs(ring.reduce((a,p,i) => { const q=ring[(i+1)%ring.length]; return a+p[0]*q[1]-q[0]*p[1]; },0));
}
function decorate(f) {
  const p = byJapaneseName.get(f.properties.P);
  if (!p) throw new Error(`Unknown source prefecture: ${f.properties.P}`);
  return { type:'Feature', id:`JP-${p.PrefectureCode}`, bbox:bounds(f.geometry.coordinates),
    properties:{ Kind:'prefecture', PrefectureCode:p.PrefectureCode, PrefectureName:p.PrefectureName, PrefectureNameJapanese:p.PrefectureNameJapanese }, geometry:f.geometry };
}
const out = path.join(root, 'public/geolocation');
await fs.mkdir(out,{recursive:true});
const mapshaper = path.join(root, 'node_modules/mapshaper/bin/mapshaper');
for (const [kind,interval] of [['detail',150],['overview',1000]]) {
  const target=path.join(cache,kind+'.geojson');
  const args=[sourcePath,'-clean','-explode'];
  // Tiny islands remain in detailed maps; omit them only in the small overview.
  if(kind==='overview') args.push('-filter','this.area > 1000000');
  args.push('-simplify',`interval=${interval}`,'keep-shapes','-dissolve','P','-clean','-o',target,'format=geojson','force');
  execFileSync(process.execPath,[mapshaper,...args],{stdio:'inherit'});
  const features=JSON.parse(await fs.readFile(target,'utf8')).features.map(decorate).sort((a,b)=>a.id.localeCompare(b.id));
  if(features.length!==47 || new Set(features.map(f=>f.id)).size!==47) throw new Error('Incomplete boundary output');
  if(kind==='overview') {
    const collection={type:'FeatureCollection',bbox:bounds(features.map(f=>f.geometry.coordinates)),DataVersion:'2019-boundaries-v1',Attribution:attribution,features};
    await fs.writeFile(path.join(out,'japan.geojson'),JSON.stringify(collection)+'\n');
  } else {
    for(const boundary of features) {
      const p=byJapaneseName.get(boundary.properties.PrefectureNameJapanese);
      const polygons=boundary.geometry.type==='Polygon' ? [boundary.geometry.coordinates] : boundary.geometry.coordinates;
      const largest=polygons.reduce((a,b)=>area(a[0])>area(b[0])?a:b);
      const capital={type:'Feature',id:`JP-${p.PrefectureCode}-capital`,properties:{Kind:'capital',PrefectureCode:p.PrefectureCode,PrefectureName:p.PrefectureName,CapitalName:p.CapitalName,CapitalNameJapanese:p.CapitalNameJapanese,PointKind:p.CapitalPointKind},geometry:{type:'Point',coordinates:p.CapitalCoordinates}};
      const collection={type:'FeatureCollection',bbox:bounds([boundary.geometry.coordinates,p.CapitalCoordinates]),displayBbox:bounds([largest,p.CapitalCoordinates]),DataVersion:'2019-boundaries-v1',Attribution:attribution,features:[boundary,capital]};
      await fs.writeFile(path.join(out,p.PrefectureName.toLowerCase()+'.geojson'),JSON.stringify(collection)+'\n');
    }
  }
}
const historicalAliases = { karafuto:'karafuto', '樺太':'karafuto', korea:'korea', chosen:'korea', 'chōsen':'korea', '朝鮮':'korea', '조선':'korea' };
const manifest={...Object.fromEntries(metadata.flatMap(p=>[[p.PrefectureName.toLowerCase(),p.PrefectureName.toLowerCase()],[p.PrefectureNameJapanese,p.PrefectureName.toLowerCase()]])),...historicalAliases};
await fs.writeFile(path.join(root,'src/geolocation-manifest.ts'),'// Generated by npm run geodata:build. Small lookup only; geometry stays in static assets.\nexport const geolocationAssets: Readonly<Record<string, string>> = '+JSON.stringify(manifest,null,2)+';\n');
console.log('Generated 47 prefecture maps, Japan overview and route manifest. Historical aliases are preserved; run npm run geodata:build:historical to rebuild historical assets.');
