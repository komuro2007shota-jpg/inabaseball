import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source=readFileSync(new URL('../src.js',import.meta.url),'utf8');
const legacy={home:'後攻校',away:'先攻校',date:'2026-10-16',events:[{pitch:'ストレート',result:'ボール',half:0,inning:1,batter:1}],lineupsReady:true};
function app(entries={}){
 const storage=new Map(Object.entries(entries)),nodes=new Map();
 const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',showModal(){},append(){},remove(){}});return nodes.get(s)};
 const context=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],createElement:()=>({remove(){}}),body:{append(){}}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},structuredClone,setTimeout:()=>{},confirm:()=>true,console});
 vm.runInContext(source,context);
 return {storage,run:s=>vm.runInContext(s,context),context};
}
test('旧形式を一度だけ移行し、元データは保持する',()=>{
 const raw=JSON.stringify(legacy),a=app({'ina-baseball-v1':raw});
 assert.equal(a.run('library.games.length'),1);
 assert.equal(a.run('data.events.length'),1);
 assert.ok(a.run('data.id'));
 a.run("data.events.push({pitch:'カーブ',result:'ストライク'});save()");
 assert.equal(a.storage.get('ina-baseball-v1'),raw);
 const b=app(Object.fromEntries(a.storage));
 assert.equal(b.run('library.games.length'),1);
 assert.equal(b.run('data.events.length'),2);
});
test('複数試合を切り替えても記録・カウントが独立し、選択中を復元する',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify(legacy)});
 a.run("var firstId=data.id;data={id:newGameId(),home:'新後攻',away:'新先攻',date:'2026-10-17',lineups:emptyLineups(),events:[]};save();var secondId=data.id");
 assert.equal(a.run('library.games.length'),2);
 a.run("openGame(firstId)");assert.equal(a.run('state().b'),1);
 a.run("openGame(secondId)");assert.equal(a.run('state().b'),0);
 assert.equal(a.run('data.lineups[0][0].name'),'');
 const b=app(Object.fromEntries(a.storage));
 assert.equal(b.run('data.away'),'新先攻');assert.equal(b.run('library.games.length'),2);
});
test('削除のキャンセル・別試合削除・全件削除後の再読込',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify(legacy)});
 a.run("var firstId=data.id;data={id:newGameId(),home:'新後攻',away:'新先攻',date:'2026-10-17',events:[]};save();var secondId=data.id");
 a.context.confirm=()=>false;a.run('deleteGame(firstId)');assert.equal(a.run('library.games.length'),2);
 a.context.confirm=()=>true;a.run('deleteGame(firstId)');assert.equal(a.run('library.games.length'),1);assert.equal(a.run('data.id'),a.run('secondId'));
 a.run('deleteGame(secondId)');assert.equal(a.run('library.games.length'),0);
 const b=app(Object.fromEntries(a.storage));assert.equal(b.run('library.games.length'),0);assert.equal(b.run('data.deleted'),true);assert.equal(b.run('page'),'games');
});
test('以前の削除状態はサンプル試合として復活させない',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify({deleted:true,events:[]})});
 assert.equal(a.run('library.games.length'),0);
 assert.equal(a.run('data.deleted'),true);
});
test('破損した新形式を旧形式で上書きしない',()=>{
 const raw='broken-json';
 assert.throws(()=>app({'ina-baseball-v2':raw,'ina-baseball-v1':JSON.stringify(legacy)}));
});
test('選択中の試合を削除したら残りの試合に切り替える',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify(legacy)});
 a.run("var originalId=data.id;data={id:newGameId(),home:'別後攻',away:'別先攻',date:'2026-10-17',events:[]};save();var deletingId=data.id;deleteGame(deletingId)");
 assert.equal(a.run('data.id'),a.run('originalId'));
 assert.equal(a.run('state().b'),1);
 const b=app(Object.fromEntries(a.storage));
 assert.equal(b.run('data.id'),a.run('originalId'));
 assert.equal(b.run('library.games.length'),1);
});
