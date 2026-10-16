import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const nodes=new Map();const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',append(){},remove(){}});return nodes.get(s)};
const storage=new Map();
const context=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],createElement:()=>({remove(){}}),body:{append(){}}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},structuredClone,setTimeout:()=>{},console});
vm.runInContext(readFileSync(new URL('../src.js',import.meta.url),'utf8'),context);
const run=s=>vm.runInContext(s,context);
run("result='ボール'; for(let i=0;i<4;i++) document.querySelector('#add').onclick()");
assert.equal(run('state().b'),0);assert.equal(run('state().batter'),2);
run("result='空振り'; for(let i=0;i<3;i++) document.querySelector('#add').onclick()");
assert.equal(run('state().o'),1);assert.equal(run('state().batter'),3);
run("result='アウト'; for(let i=0;i<2;i++) document.querySelector('#add').onclick()");
assert.equal(run('state().half'),1);assert.equal(run('state().o'),0);
run("document.querySelector('#undo').onclick()");assert.equal(run('state().half'),0);assert.equal(run('state().o'),2);
run("result='本塁打';document.querySelector('#add').onclick()");assert.equal(run('state().runs[0]'),2);
assert.equal(JSON.parse(storage.get('ina-baseball-v1')).events.length,9);
assert.ok(run('analytics()').includes('9<small> 球'));
assert.ok(run('sheet()').includes('本塁打'));
console.log('PASS: 四球・三振・攻守交代・取り消し・本塁打・保存・分析・記録票');

// 四死球の強制進塁と満塁押し出し
run("data.events=[];result='死球';for(let i=0;i<4;i++)document.querySelector('#add').onclick()");
assert.equal(run('state().runs[0]'),1);
assert.equal(run('state().bases.filter(x=>x!==null).length'),3);
assert.equal(run('state().innings[0][0]'),1);
run("result='本塁打';document.querySelector('#add').onclick()");
assert.equal(run('state().runs[0]'),5);
assert.equal(run('state().bases.filter(x=>x!==null).length'),0);
run("document.querySelector('#undo').onclick()");
assert.equal(run('state().runs[0]'),1);
assert.equal(run('state().bases.filter(x=>x!==null).length'),3);
// 二塁打と追加進塁・生還・走塁死
run("data.events=[];result='安打';document.querySelector('#add').onclick();result='二塁打';document.querySelector('#add').onclick()");
assert.equal(run('state().bases[2]'),1);
assert.equal(run('state().bases[1]'),2);
run("data.events.push({runner:{from:2,to:'home'}})");
assert.equal(run('state().runs[0]'),1);
run("data.events.push({runner:{from:1,to:'out'}})");
assert.equal(run('state().o'),1);
assert.equal(run('state().bases.filter(x=>x!==null).length'),0);
// チームごとの打順を攻守交代後も維持
run("data.events=[];result='アウト';for(let i=0;i<6;i++)document.querySelector('#add').onclick()");
assert.equal(run('state().inning'),2);
assert.equal(run('state().half'),0);
assert.equal(run('state().batter'),4);
assert.ok(run('score()').includes('<td>0</td>'));
console.log('PASS: 押し出し・満塁本塁打・得点取り消し・進塁・生還・走塁死・打順継続');
