import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { parseSearch, parseGroupID } from '../src/validation.ts';
import { D1Repository } from '../src/repository.ts';
import { ImmigrantService } from '../src/service.ts';
test('at least one search filter, optional combinations and invalid requests', () => {
 const valid = [
  ['NameRomaji=Tadao',{NameRomaji:'Tadao'}],
  ['SurnameRomaji=Ueda',{SurnameRomaji:'Ueda'}],
  ['NameKanji=只雄',{NameKanji:'只雄'}],
  ['SurnameKanji=上田',{SurnameKanji:'上田'}],
  ['Destination=Santos',{Destination:'Santos'}],
  ['Year=1955',{Year:1955}],
  ['Farm=Fazenda',{Farm:'Fazenda'}],
  ['ArrivalDate=1955-01-01',{ArrivalDate:'1955-01-01'}],
  ['DepartureDate=1954-12-01',{DepartureDate:'1954-12-01'}],
  ['ShipName=AMERICA-MARU',{ShipName:'AMERICA-MARU'}],
  ['PrefectureName=Yamaguchi',{PrefectureName:'Yamaguchi'}],
  ['SurnameRomaji=Ueda&Year=1955',{SurnameRomaji:'Ueda',Year:1955}],
  ['SurnameKanji=上田&Year=1955',{SurnameKanji:'上田',Year:1955}],
  ['NameKanji=只雄&PrefectureName=Yamaguchi',{NameKanji:'只雄',PrefectureName:'Yamaguchi'}],
 ];
 for (const [query, expected] of valid) assert.deepEqual(parseSearch(new URLSearchParams(query)), expected);
 for(const q of ['', 'NameRomaji=', 'Year=55','ArrivalDate=1955-02-30','NameRomaji=T&x=1','NameRomaji=T&NameRomaji=Q']) assert.throws(()=>parseSearch(new URLSearchParams(q)));
 for(const id of ['-1','1e2','1x','9007199254740992']) assert.throws(()=>parseGroupID(id));
 assert.equal(parseGroupID('1000'),1000);
});
const path=process.env.TEST_DB;
test('real database queries and group response', {skip:!path}, async()=>{
 const db=new DatabaseSync(path,{readOnly:true});
 const adapter={prepare(sql){return {bind(...values){return {async all(){return {results:db.prepare(sql).all(...values)}}}}}}};
 const repo=new D1Repository(adapter);
 const service=new ImmigrantService(repo);
 const filters={NameRomaji:'tadao',SurnameRomaji:'ueda'};
 const rows=await service.search(filters);
 assert.ok(rows.length>1);
 assert.equal(rows.length,db.prepare('SELECT count(*) AS n FROM ImmigrantGroupShipPrefecture WHERE NameRomaji = ? COLLATE NOCASE AND SurnameRomaji = ? COLLATE NOCASE').get('tadao','ueda').n);
 assert.equal((await service.search({NameRomaji:"' OR 1=1 --",SurnameRomaji:'ueda'})).length,0);
 const group=await service.group(rows[0].groupID);
 assert.ok(group.immigrants.some(x=>x.immigrantID===rows[0].immigrantID));
 assert.deepEqual(Object.keys(group.immigrants[0]).sort(),['immigrantID','NameRomaji','SurnameRomaji','SurnameKanji','NameKanji'].sort());
 assert.equal(await service.group(9007199254740991),null);
 console.log('Tadao Ueda matches:',rows.length,'group members:',group.immigrants.length);
 db.close();
});
