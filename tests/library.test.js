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

test('単独JSONの確認・別試合追加・元試合保持',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify(legacy)});
 a.context.importText=JSON.stringify(legacy);
 const before=a.storage.get('ina-baseball-v2');
 a.run("var preview=prepareImport(importText,'one.json')");
 assert.equal(a.run('preview.items[0].matches.length'),1);
 assert.equal(a.storage.get('ina-baseball-v2'),before);
 assert.equal(a.run('commitImport(preview)'),1);
 assert.equal(a.run('library.games.length'),2);
 assert.notEqual(a.run('library.games[0].id'),a.run('library.games[1].id'));
 assert.equal(a.run('library.games[0].events.length'),1);
});
test('同じIDの試合を選択して上書きし、他試合を保持',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify(legacy)});
 a.run("var exported=structuredClone(data);exported.events.push({...exported.events[0]});var oldId=data.id;data={...structuredClone(data),id:newGameId(),home:'他校'};save();var otherId=data.id;var otherBefore=JSON.stringify(data);var preview=prepareImport(JSON.stringify(exported),'one.json');preview.items[0].action='replace';commitImport(preview)");
 assert.equal(a.run('library.games.length'),2);
 assert.equal(a.run('library.games.find(g=>g.id===oldId).events.length'),2);
 assert.equal(a.run('JSON.stringify(library.games.find(g=>g.id===otherId))'),a.run('otherBefore'));
});
test('全試合JSONを復元し、不要な試合は読み込まない',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify({deleted:true,events:[]})});
 a.context.importText=JSON.stringify({version:2,games:[{...legacy,id:'import-a'},{...legacy,id:'import-b',home:'別校'}]});
 a.run("var preview=prepareImport(importText,'all.json');preview.items[1].action='skip';commitImport(preview)");
 assert.equal(a.run('library.games.length'),1);
 assert.equal(a.run('data.id'),'import-a');
 assert.equal(a.run('state().b'),1);
 const b=app(Object.fromEntries(a.storage));assert.equal(b.run('data.id'),'import-a');
});
test('不正なJSON・位置・走者・重複IDを拒否し、既存記録を変えない',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify(legacy)}),before=a.storage.get('ina-baseball-v2');
 for(const input of ['{broken',JSON.stringify({...legacy,events:[{...legacy.events[0],coursePoint:{x:'bad',y:0}}]}),JSON.stringify({...legacy,events:[{pitch:'ストレート',result:'安打',play:{moves:[{from:-1,batter:9,to:'0'}]}}]}),JSON.stringify({version:2,games:[{...legacy,id:'dup'},{...legacy,id:'dup'}]})]){
  a.context.importText=input;assert.throws(()=>a.run('prepareImport(importText,"bad.json")'));assert.equal(a.storage.get('ina-baseball-v2'),before);
 }
 assert.equal(a.run('data.home'),'後攻校');
});
test('保存失敗時には全試合と選択状態を維持する',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify(legacy)});
 a.context.importText=JSON.stringify(legacy);a.run('var preview=prepareImport(importText,"one.json");var original=JSON.stringify(library);var originalId=data.id');
 a.context.localStorage.setItem=()=>{throw new Error('保存容量が足りません')};
 assert.throws(()=>a.run('commitImport(preview)'),/保存容量/);
 assert.equal(a.run('JSON.stringify(library)'),a.run('original'));
 assert.equal(a.run('data.id'),a.run('originalId'));
});
test('スタメン・DH・交代・走者付きの書き出しを読み戻せる',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify(legacy)});
 a.run("data.events=[];data.lineups=emptyLineups();data.lineups.forEach((t,h)=>t.forEach((p,i)=>{p.name='選手'+h+i;p.number=String(i+1);p.throws='右';p.bats='左'}));data.dh=[false,true];data.lineups[1][0].position='DH';data.pitchers=[{name:'',number:''},{name:'先発P',number:'10'}];var beforeSub=rosterAt(1);var afterSub=structuredClone(beforeSub);afterSub.pitcher={name:'救援P',number:'11'};data.events=[{pitch:'カーブ',result:'安打',inning:1,half:0,batter:1,coursePoint:{x:.4,y:.3},point:{x:80,y:90},kind:'ゴロ',play:{moves:[{from:-1,batter:1,to:'0'}],countRuns:false}},{substitution:{team:1,before:beforeSub,after:afterSub,detail:'投手交代'},result:'投手交代',inning:1,half:0,batter:2}];save();var parsed=parseGameImport(JSON.stringify(library))");
 assert.equal(a.run('parsed[0].events[1].substitution.after.pitcher.name'),'救援P');
 assert.equal(a.run('parsed[0].events[0].play.moves[0].to'),'0');
 assert.equal(a.run('parsed[0].lineups[0][0].bats'),'左');
});
test('別画面で変更された保存内容を古いライブラリで上書きしない',()=>{
 const a=app({'ina-baseball-v1':JSON.stringify(legacy)});
 a.context.importText=JSON.stringify(legacy);a.run('var preview=prepareImport(importText,"one.json")');
 const external=JSON.parse(a.storage.get('ina-baseball-v2'));external.games[0].home='外部更新';a.storage.set('ina-baseball-v2',JSON.stringify(external));
 assert.throws(()=>a.run('commitImport(preview)'),/再読み込み/);
 assert.throws(()=>a.run('prepareImport(importText,"one.json")'),/再読み込み/);
 assert.equal(JSON.parse(a.storage.get('ina-baseball-v2')).games[0].home,'外部更新');
});
