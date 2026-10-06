import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
const dir=new URL('../.test-build/',import.meta.url);
await fs.mkdir(dir,{recursive:true});
for(const file of ['index','models','repository','service','validation','statistics','geolocation','geolocation-manifest']){
 const src=await fs.readFile(new URL(`../src/${file}.ts`,import.meta.url),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
 await fs.writeFile(new URL(file+'.js',dir),js);
}
const {default:app}=await import(new URL('index.js',dir));
test('HTTP validation, methods, JSON and live SQLite-backed responses',async()=>{
 const path=process.env.TEST_DB;
 const db=path?new DatabaseSync(path,{readOnly:true}):null;
 const env={ashiato_kai:{prepare(sql){return {bind(...values){return {async all(){return {results:db.prepare(sql).all(...values)}}}}}}}};
 const req=(p,init)=>app.request('http://localhost'+p,init,env);
 assert.equal((await req('/')).status,200);
 assert.equal((await req('/api/v1/immigrants')).status,400);
 assert.equal((await req('/api/v1/groups/abc')).status,400);
 assert.equal((await req('/api/v1/immigrants',{method:'POST'})).status,405);
 assert.equal((await req('/missing')).status,404);
 if(db){
  assert.equal((await req('/api/v1/immigrants?Year=1955')).status,200);
  assert.equal((await req('/api/v1/immigrants?ShipName=AMERICA-MARU')).status,200);
  assert.equal((await req('/api/v1/immigrants?PrefectureName=Yamaguchi')).status,200);
  assert.equal((await req('/api/v1/immigrants?NameRomaji=Tadao')).status,200);
  assert.equal((await req('/api/v1/immigrants?SurnameRomaji=Ueda')).status,200);
  assert.equal((await req('/api/v1/immigrants?NameKanji=%E5%8F%AA%E9%9B%84')).status,200);
  assert.equal((await req('/api/v1/immigrants?SurnameKanji=%E4%B8%8A%E7%94%B0')).status,200);
  assert.equal((await req('/api/v1/immigrants?SurnameKanji=%E4%B8%8A%E7%94%B0&Year=1955')).status,200);
  const res=await req('/api/v1/immigrants?NameRomaji=tadao&SurnameRomaji=ueda');
  assert.equal(res.status,200);
  const rows=await res.json();assert.ok(rows.length>1);
  const group=await (await req('/api/v1/groups/'+rows[0].groupID)).json();
  assert.ok(group.immigrants.length>0);
  assert.equal((await req('/api/v1/groups/9007199254740991')).status,404);
  db.close();
 }
});
const { StatisticsRepository } = await import(new URL('statistics.js',dir));
const migration=await fs.readFile(new URL('../sql/create-statistics.sql',import.meta.url),'utf8');
function binding(db){return {prepare(sql){return {bind(...values){return {async all(){return {results:db.prepare(sql).all(...values)}}}}}}};}
test('snapshot migration, global ranks, ties, lookup and independent API reads',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE ImmigrantGroupShipPrefecture(SurnameRomaji TEXT,SurnameKanji TEXT,NameRomaji TEXT,NameKanji TEXT,PrefectureName TEXT)');
 const insert=db.prepare('INSERT INTO ImmigrantGroupShipPrefecture VALUES(?,?,?,?,?)');
 for(const [r,k,n] of [['SATO','佐藤',6],['UEDA','上田',4],['OTHER','別',4],['UEDA','植田',2],['UEDA',null,1]])
  for(let i=0;i<n;i++)insert.run(r,k,r==='UEDA'?'TADANOBU':'OTHERNAME',r==='UEDA'?'忠信':'別名','Ehime');
 for(let i=0;i<12;i++)insert.run('EXTRA'+i,'字'+i,'NAME'+i,'名'+i,'Other');
 db.exec(migration);
 db.exec(migration); // Repeat does not append or duplicate records.
 assert.equal(db.prepare('SELECT SUM(Count) n FROM SurnameStatistics').get().n,29);
 const repo=new StatisticsRepository(binding(db));
 assert.deepEqual((await repo.surname('ueda')).map(x=>[x.Rank,x.Count]),[[2,4],[4,2],[5,1]]);
 assert.equal((await repo.topSurnames()).length,10);
 assert.equal((await repo.topNames()).length,10);
 assert.deepEqual((await repo.name('tadanobu')).map(x=>[x.NameKanji,x.Count]),[['忠信',7]]);
 assert.equal((await repo.surname("' OR 1=1 --")).length,0);
 assert.equal((await repo.prefecture('eHiMe'))[0].Count,17);
 assert.equal((await repo.prefecture('not recorded')).length,0);
 // Statistics remain available with no source table: requests do not aggregate it.
 db.exec('DROP TABLE ImmigrantGroupShipPrefecture');
 const env={ashiato_kai:binding(db)};
 for(const path of ['/surnames/top','/names/top','/prefectures/top','/surnames?SurnameRomaji=ueda','/names?NameRomaji=tadanobu','/prefectures?PrefectureName=Ehime']){
  const res=await app.request('http://localhost/api/v1/statistics'+path,{},env);
  assert.equal(res.status,200);assert.ok((await res.json()).length>0);
 }
 for(const query of ['', '?PrefectureName=', '?PrefectureName=Ehime&PrefectureName=Tokyo', '?name=Ehime'])
  assert.equal((await app.request('http://localhost/api/v1/statistics/prefectures'+query,{},env)).status,400);
 for(const query of ['', '?NameRomaji=', '?NameRomaji=Tadao&NameRomaji=Jiro', '?SurnameRomaji=Ueda'])
  assert.equal((await app.request('http://localhost/api/v1/statistics/names'+query,{},env)).status,400);
 db.close();
});
test('full dataset snapshot counts and ranks reconcile independently',{skip:!process.env.TEST_DB},async()=>{
 const source=new DatabaseSync(process.env.TEST_DB,{readOnly:true});
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE ImmigrantGroupShipPrefecture(SurnameRomaji TEXT,SurnameKanji TEXT,NameRomaji TEXT,NameKanji TEXT,PrefectureName TEXT)');
 const insert=db.prepare('INSERT INTO ImmigrantGroupShipPrefecture VALUES(?,?,?,?,?)');
 const counts=new Map();const names=new Map();const prefectures=new Map();let total=0;
 db.exec('BEGIN');
 for(const r of source.prepare('SELECT SurnameRomaji,SurnameKanji,NameRomaji,NameKanji,PrefectureName FROM ImmigrantGroupShipPrefecture').iterate()){
  insert.run(r.SurnameRomaji,r.SurnameKanji,r.NameRomaji,r.NameKanji,r.PrefectureName);total++;
  const key=JSON.stringify([r.SurnameRomaji,r.SurnameKanji]);counts.set(key,(counts.get(key)||0)+1);
  const nameKey=JSON.stringify([r.NameRomaji,r.NameKanji]);names.set(nameKey,(names.get(nameKey)||0)+1);
  prefectures.set(r.PrefectureName,(prefectures.get(r.PrefectureName)||0)+1);
 }
 db.exec('COMMIT');db.exec(migration);
 const frequencies=new Map();for(const n of counts.values())frequencies.set(n,(frequencies.get(n)||0)+1);
 let rank=1;const ranks=new Map();for(const n of [...frequencies.keys()].sort((a,b)=>b-a)){ranks.set(n,rank);rank+=frequencies.get(n);}
 for(const r of db.prepare('SELECT * FROM SurnameStatistics').all()){
  assert.equal(r.Count,counts.get(JSON.stringify([r.SurnameRomaji,r.SurnameKanji])));assert.equal(r.Rank,ranks.get(r.Count));
 }
 for(const r of db.prepare('SELECT * FROM NameStatistics').all()){
  assert.equal(r.Count,names.get(JSON.stringify([r.NameRomaji,r.NameKanji])));
  assert.equal(r.Rank,1+[...names.values()].filter(n=>n>r.Count).length);
 }
 for(const r of db.prepare('SELECT * FROM PrefectureStatistics').all()){
  assert.equal(r.Count,prefectures.get(r.PrefectureName));assert.equal(r.Rank,1+[...prefectures.values()].filter(n=>n>r.Count).length);
 }
 assert.equal(db.prepare('SELECT SUM(Count) n FROM SurnameStatistics').get().n,total);
 assert.equal(db.prepare('SELECT SUM(Count) n FROM NameStatistics').get().n,total);
 assert.equal(db.prepare('SELECT SUM(Count) n FROM PrefectureStatistics').get().n,total);
 const repo=new StatisticsRepository(binding(db));
 console.log('Snapshot categories:',counts.size,names.size,prefectures.size,'total:',total,'Ehime:',await repo.prefecture('Ehime'));
 console.log('Lookup query plan:',db.prepare("EXPLAIN QUERY PLAN SELECT Rank,PrefectureName,Count FROM PrefectureStatistics WHERE PrefectureName = ? COLLATE NOCASE ORDER BY Count DESC,PrefectureName").all('Ehime'));
 db.close();source.close();
});

test('geolocation: modern prefectures, historical regions, aliases, bounds, cache validation, HEAD and errors without D1', async () => {
 const metadata=JSON.parse(await fs.readFile(new URL('../geodata/prefectures.json',import.meta.url),'utf8'));
 let assetReads=0;
 const env={ashiato_kai:{prepare(){throw new Error('Geolocation must not query D1');}},ASSETS:{async fetch(request){
  assetReads++;
  const name=new URL(request.url).pathname.split('/').at(-1);
  const bytes=await fs.readFile(new URL('../public/geolocation/'+name,import.meta.url));
  const headers={'ETag':'"test-asset"'};
  return request.headers.get('If-None-Match')==='"test-asset"' ? new Response(null,{status:304,headers}) : new Response(bytes,{headers});
 }}};
 const req=(p,init)=>app.request('http://localhost'+p,init,env);
 const base='/api/v1/geolocation';
 const overview=await (await req(base)).json();
 assert.equal(overview.type,'FeatureCollection');assert.equal(overview.features.length,47);
 assert.equal(new Set(overview.features.map(f=>f.id)).size,47);
 for(const p of metadata){
  const response=await req(base+'/'+p.PrefectureName.toUpperCase());
  assert.equal(response.status,200);
  assert.match(response.headers.get('Content-Type'),/^application\/geo\+json/);
  assert.equal(response.headers.get('Cache-Control'),'public, max-age=86400');
  const j=await response.json();
  assert.equal(j.features.length,2);
  assert.equal(j.features[0].properties.PrefectureCode,p.PrefectureCode);
  assert.equal(j.features[1].properties.CapitalName,p.CapitalName);
  assert.deepEqual(j.features[1].geometry.coordinates,p.CapitalCoordinates);
  for(const f of j.features){
   const walk=(coords)=>{
    if(typeof coords[0]==='number'){
     assert.equal(coords.length,2);assert.ok(coords.every(Number.isFinite));
     const [x,y]=coords;assert.ok(x>=j.bbox[0]&&y>=j.bbox[1]&&x<=j.bbox[2]&&y<=j.bbox[3]);
    }else coords.forEach(walk);
   };walk(f.geometry.coordinates);
  }
  const g=j.features[0].geometry;
  assert.ok(['Polygon','MultiPolygon'].includes(g.type));
  for(const polygon of (g.type==='Polygon'?[g.coordinates]:g.coordinates))for(const ring of polygon){
   assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1));
  }
  const [x,y]=j.features[1].geometry.coordinates;
  assert.ok(x>=j.displayBbox[0]&&y>=j.displayBbox[1]&&x<=j.displayBbox[2]&&y<=j.displayBbox[3]);
 }
 assert.equal((await req(base+'/'+encodeURIComponent('大分県'))).status,200);
 for(const [name,expected,capital] of [['Karafuto','Karafuto','Toyohara'],['樺太','Karafuto','Toyohara'],['Korea','Korea','Keijo'],['朝鮮','Korea','Keijo'],['조선','Korea','Keijo'],['Chosen','Korea','Keijo']]){
  const response=await req(base+'/'+encodeURIComponent(name));
  assert.equal(response.status,200);
  const j=await response.json();
  assert.equal(j.DataVersion,'historical-regions-v1');assert.equal(j.features.length,2);
  assert.equal(j.features[0].properties.Kind,'historical-region');assert.equal(j.features[0].properties.RegionName,expected);assert.equal(j.features[0].properties.PrefectureName,expected);assert.ok(j.features[0].properties.PrefectureNameJapanese);assert.equal(j.features[1].properties.PrefectureName,expected);
  assert.equal(j.features[1].properties.CapitalName,capital);
  assert.equal(j.Attribution.Notice.includes('present-day sovereignty'),true);
 }
 const karafuto=await (await req(base+'/Karafuto')).json();
 assert.ok(karafuto.bbox[3] <= 50);assert.equal(karafuto.features[0].properties.GeographyType,'historical-territory');
 const korea=await (await req(base+'/Korea')).json();
 assert.equal(korea.features[0].properties.HistoricalContext,'Korea under Japanese rule');
 const head=await req(base+'/Oita',{method:'HEAD'});
 assert.equal(head.status,200);assert.equal(await head.text(),'');
 const conditional=await req(base+'/Oita',{headers:{'If-None-Match':'"test-asset"'}});
 assert.equal(conditional.status,304);assert.equal(await conditional.text(),'');
 const reads=assetReads;
 for(const name of ['Atlantis','constructor','__proto__','toString','oita.geojson'])assert.equal((await req(base+'/'+name)).status,404);
 for(const p of [base+'?name=Oita',base+'/Oita?extra=1',base+'/'+encodeURIComponent(' '),base+'/'+'a'.repeat(201)])assert.equal((await req(p)).status,400);
 assert.equal((await req('/geolocation/oita.geojson')).status,404);
 const post=await req(base+'/Oita',{method:'POST'});assert.equal(post.status,405);assert.equal(post.headers.get('Allow'),'GET, HEAD');
 assert.equal(assetReads,reads);
 const failed=await app.request('http://localhost'+base+'/Oita',{}, {ASSETS:{fetch:async()=>new Response('missing',{status:404})}});
 assert.equal(failed.status,500);assert.equal((await failed.json()).error.code,'INTERNAL_ERROR');
});
