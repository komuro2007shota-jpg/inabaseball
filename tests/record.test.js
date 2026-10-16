import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const nodes=new Map();const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',append(){},remove(){},showModal(){},checked:false});return nodes.get(s)};
const storage=new Map();
const context=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],createElement:()=>({remove(){}}),body:{append(){}}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},structuredClone,setTimeout:()=>{},console});
vm.runInContext(readFileSync(new URL('../src.js',import.meta.url),'utf8'),context);
const run=s=>vm.runInContext(s,context);
run("function recordPitch(){document.querySelector('#add').onclick();if(pending)document.querySelector('#confirm-play').onsubmit({preventDefault(){}})}");
run("result='ボール'; for(let i=0;i<4;i++) recordPitch()");
assert.equal(run('state().b'),0);assert.equal(run('state().batter'),2);
run("result='空振り'; for(let i=0;i<3;i++) recordPitch()");
assert.equal(run('state().o'),1);assert.equal(run('state().batter'),3);
run("result='アウト'; for(let i=0;i<2;i++) recordPitch()");
assert.equal(run('state().half'),1);assert.equal(run('state().o'),0);
run("document.querySelector('#undo').onclick()");assert.equal(run('state().half'),0);assert.equal(run('state().o'),2);
run("result='本塁打';recordPitch()");assert.equal(run('state().runs[0]'),2);
assert.equal(JSON.parse(storage.get('ina-baseball-v2')).games.find(g=>g.id===JSON.parse(storage.get('ina-baseball-v2')).activeId).events.length,9);
assert.ok(run('analytics()').includes('9<small> 球'));
assert.ok(run('sheet()').includes('本塁打'));
console.log('PASS: 四球・三振・攻守交代・取り消し・本塁打・保存・分析・記録票');

// 四死球の強制進塁と満塁押し出し
run("data.events=[];result='死球';for(let i=0;i<4;i++)recordPitch()");
assert.equal(run('state().runs[0]'),1);
assert.equal(run('state().bases.filter(x=>x!==null).length'),3);
assert.equal(run('state().innings[0][0]'),1);
run("result='本塁打';recordPitch()");
assert.equal(run('state().runs[0]'),5);
assert.equal(run('state().bases.filter(x=>x!==null).length'),0);
run("document.querySelector('#undo').onclick()");
assert.equal(run('state().runs[0]'),1);
assert.equal(run('state().bases.filter(x=>x!==null).length'),3);
// 二塁打と追加進塁・生還・走塁死
run("data.events=[];result='安打';recordPitch();result='二塁打';recordPitch()");
assert.equal(run('state().bases[2]'),1);
assert.equal(run('state().bases[1]'),2);
run("data.events.push({runner:{from:2,to:'home'}})");
assert.equal(run('state().runs[0]'),1);
run("data.events.push({runner:{from:1,to:'out'}})");
assert.equal(run('state().o'),1);
assert.equal(run('state().bases.filter(x=>x!==null).length'),0);
// チームごとの打順を攻守交代後も維持
run("data.events=[];result='アウト';for(let i=0;i<6;i++)recordPitch()");
assert.equal(run('state().inning'),2);
assert.equal(run('state().half'),0);
assert.equal(run('state().batter'),4);
assert.ok(run('score()').includes('<td>0</td>'));
console.log('PASS: 押し出し・満塁本塁打・得点取り消し・進塁・生還・走塁死・打順継続');

// 新しいプレーは確認するまで未保存、キャンセルしてもカウントは維持
run("data.events=[];result='安打';document.querySelector('#add').onclick()");
assert.equal(run('data.events.length'),0);
assert.equal(run('pending.moves[0].to'),'0');
run("document.querySelector('#cancel-play').onclick()");
assert.equal(run('pending'),null);
assert.equal(run('data.events.length'),0);
// 一塁走者が単打で三塁へ、打者は一塁。まとめて保存・取消
run("result='安打';recordPitch();document.querySelector('#add').onclick();pending.moves[1].to='2';document.querySelector('#confirm-play').onsubmit({preventDefault(){}})");
assert.equal(run('state().bases[0]'),2);
assert.equal(run('state().bases[2]'),1);
run("document.querySelector('#undo').onclick()");
assert.equal(run('state().bases[0]'),1);
assert.equal(run('state().bases[2]'),null);
// 同塁・追い越し・4アウトを拒否
assert.ok(run("validatePlay(state(),[{from:-1,to:'0'},{from:0,to:'0'}])"));
assert.ok(run("validatePlay(state(),[{from:-1,to:'2'},{from:0,to:'1'}])"));
assert.ok(run("validatePlay({...state(),o:2},[{from:-1,to:'out'},{from:0,to:'out'}])"));
// 併殺で一括攻守交代し、次回の打順を維持
run("data.events=[];result='アウト';recordPitch();result='安打';recordPitch();result='アウト';document.querySelector('#add').onclick();pending.moves[1].to='out';document.querySelector('#confirm-play').onsubmit({preventDefault(){}})");
assert.equal(run('state().half'),1);
assert.equal(run('state().bases.filter(x=>x!==null).length'),0);
assert.equal(run('state().lineup[0]'),4);
// 2アウトから第3アウトなら生還を自動で得点にしない
run("data.events=[];result='三塁打';recordPitch();result='アウト';recordPitch();recordPitch();document.querySelector('#add').onclick();pending.moves[1].to='home';document.querySelector('#confirm-play').onsubmit({preventDefault(){}})");
assert.equal(run('state().runs[0]'),0);
// 第3アウトより早い生還を明示したときだけ加点
run("document.querySelector('#undo').onclick();document.querySelector('#add').onclick();pending.moves[1].to='home';document.querySelector('#count-runs').checked=true;document.querySelector('#confirm-play').onsubmit({preventDefault(){}})");
assert.equal(run('state().runs[0]'),1);
assert.ok(run('sheet()').includes('3塁走者：生還'));
console.log('PASS: 未確定・キャンセル・到達塁修正・同塁防止・併殺・第3アウトの得点判定');

run("data.lineups=emptyLineups()");
assert.ok(run('validateLineups(data.lineups)').includes('全員'));
run("data.lineups.forEach((team,h)=>team.forEach((p,i)=>{p.name='選手'+h+i;p.number=String(i+1)}))");
assert.equal(run('validateLineups(data.lineups)'),'');
run("data.lineups[0][1].number='1'");
assert.ok(run('validateLineups(data.lineups)').includes('背番号'));
run("data.lineups[0][1].number='2';data.lineups[0][0].name='<山田>'");
assert.ok(run('lineupSheet()').includes('&lt;山田&gt;'));
assert.equal(run('playerLabel(0,1)'),'1番 <山田>');
assert.equal(run('playerLabel(1,9)'),'9番 選手18');
console.log('PASS: スタメン入力検証・背番号重複・両チーム選手名・安全な表示');
run("data.dh=[true,false];data.lineups[0][0].position='DH';data.pitchers=[{name:'',number:''},{name:'',number:''}]");
assert.ok(run('validateLineups(data.lineups)').includes('先発投手'));
run("data.pitchers[0]={name:'先発投手',number:'1'}");
assert.ok(run('validateLineups(data.lineups)').includes('背番号'));
run("data.pitchers[0].number='10'");
assert.equal(run('validateLineups(data.lineups)'),'');
assert.equal(run('pitcherFor(0).name'),'先発投手');
assert.equal(run('pitcherFor(1).name'),'選手10');
assert.ok(run('lineupSheet()').includes('<td>投手</td>'));
assert.ok(run('lineupSheet()').includes('先発投手'));
assert.equal(run('data.lineups[0].length'),9);
console.log('PASS: DHと打順外投手・投手未入力・10人の背番号重複・印刷');

// 交代は打順・カウント・走者を変えず、その時点までの選手を復元する
run("data.events=[];data.dh=[false,false];data.lineups=emptyLineups();data.lineups.forEach((t,h)=>t.forEach((p,i)=>{p.name='先発'+h+i;p.number=String(i+1)}));result='安打';recordPitch();var beforeSub=rosterAt(0);var afterSub=structuredClone(beforeSub);afterSub.players[0]={...afterSub.players[0],name:'代走選手',number:'12'}");
assert.equal(run('validateSubstitution(beforeSub,afterSub,0)'),'');
run("data.events.push({substitution:{team:0,before:beforeSub,after:afterSub},result:'代走',half:0,inning:1,batter:2})");
assert.equal(run('state().batter'),2);
assert.equal(run('state().bases[0]'),1);
assert.equal(run('playerLabel(0,1)'),'1番 代走選手');
assert.equal(run('playerLabel(0,1,0)'),'1番 先発00');
assert.ok(run('sheet()').includes('1番 先発00'));
run("var reentry=structuredClone(afterSub);reentry.players[0]=beforeSub.players[0]");
assert.ok(run('validateSubstitution(afterSub,reentry,0)').includes('再出場'));
run("data.events.pop()");
assert.equal(run('playerLabel(0,1)'),'1番 先発00');
// DHの投手交代と解除
run("data.events=[];data.dh=[false,true];data.lineups[1][0].position='DH';data.pitchers=[{name:'',number:''},{name:'先発P',number:'10'}];var dhBefore=rosterAt(1);var dhAfter=structuredClone(dhBefore);dhAfter.pitcher={name:'救援P',number:'11'}");
assert.equal(run('validateSubstitution(dhBefore,dhAfter,1)'),'');
run("data.events.push({substitution:{team:1,before:dhBefore,after:dhAfter}})");
assert.equal(run('pitcherFor(1).name'),'救援P');
assert.equal(run('pitcherFor(1,0).name'),'先発P');
run("var removed=structuredClone(dhAfter);removed.dh=false;removed.players[0]={...dhAfter.pitcher,position:'投手'}");
assert.equal(run('validateSubstitution(dhAfter,removed,1)'),'');
run("data.events.push({substitution:{team:1,before:dhAfter,after:removed}})");
assert.equal(run('rosterAt(1).dh'),false);
assert.equal(run('rosterAt(1).players.length'),9);
assert.equal(run('playerLabel(1,1)'),'1番 救援P');
assert.ok(run('validateSubstitution(removed,dhAfter,1)').includes('復活'));
console.log('PASS: 代走の走者引継ぎ・過去名の保持・交代取消・再出場防止・投手履歴・DH解除');

// 投球前カウントと、その時点の投手・打者を使って分析する
run("data.events=[];data.dh=[false,false];data.lineups=emptyLineups();data.lineups.forEach((t,h)=>t.forEach((p,i)=>{p.name='選手'+h+i;p.number=String(i+1)}));analysisFilter={view:'pitching',team:'all',pitcher:'all',batter:'all',count:'all'};result='ボール';pitch='ストレート';course=12;recordPitch();result='ストライク';recordPitch();var analysisBefore=rosterAt(1);var analysisAfter=structuredClone(analysisBefore);analysisAfter.players[0]={name:'救援分析P',number:'11',position:'投手'};data.events.push({substitution:{team:1,before:analysisBefore,after:analysisAfter}});result='安打';pitch='スライダー';coursePoint={x:.43,y:.67};point={x:80,y:90};recordPitch()");
assert.equal(run('analysisRows().length'),3);
assert.equal(run('analysisRows()[0].count'),'0-0');
assert.equal(run('analysisRows()[1].count'),'1-0');
assert.equal(run('analysisRows()[2].count'),'1-1');
assert.equal(run('analysisRows()[0].pitcherName'),'選手10');
assert.equal(run('analysisRows()[2].pitcherName'),'救援分析P');
assert.equal(run('analysisRows()[2].batterName'),'選手00');
assert.equal(run('analysisRows()[0].location.x'),.5);
assert.equal(run('analysisRows()[2].location.x'),.43);
run("analysisFilter.pitcher='1:選手10'");
assert.equal(run('filteredAnalysis(analysisRows()).length'),2);
run("analysisFilter.pitcher='1:救援分析P';analysisFilter.count='1-1'");
assert.equal(run('filteredAnalysis(analysisRows()).length'),1);
assert.equal(run('filteredAnalysis(analysisRows())[0].outcome'),'安打');
run("analysisFilter.team='0'");
assert.equal(run('filteredAnalysis(analysisRows()).length'),0);
run("analysisFilter.view='batting'");
assert.equal(run('filteredAnalysis(analysisRows()).length'),1);
run("analysisFilter={view:'pitching',team:'all',pitcher:'all',batter:'all',count:'all'};result='ボール';pitch='不明';for(let i=0;i<4;i++)recordPitch()");
assert.equal(run('analysisRows().at(-1).count'),'3-0');
assert.equal(run('analysisRows().at(-1).outcome'),'四球');
assert.equal(run('analysisRows().filter(r=>r.ending).length'),2);
assert.ok(run('analytics()').includes('コース分布'));
run("data.events=[]");
assert.ok(run('analytics()').includes('この条件に一致する投球はありません'));
assert.ok(!run('analytics()').includes('NaN'));
console.log('PASS: 選手別・チーム視点・カウント絞込・旧新コース・交代前後・四球・空データ分析');

run("data.events=[];data.lineups[0][0].throws='右';data.lineups[0][0].bats='両'");
assert.equal(run('handText(data.lineups[0][0])'),'右投・両打');
assert.equal(run("handText({name:'旧データ'})"),'投不明・打不明');
assert.ok(run('lineupSheet()').includes('右投・両打'));
run("var legacyHands=rosterAt(0);var normalizedHands=structuredClone(legacyHands);normalizedHands.players.forEach(p=>{p.throws=p.throws||'';p.bats=p.bats||''})");
assert.equal(run('rosterFingerprint(legacyHands)'),run('rosterFingerprint(normalizedHands)'));
run("var updatedHands=structuredClone(legacyHands);updatedHands.players[0].bats='左';data.events.push({substitution:{team:0,before:legacyHands,after:updatedHands}})");
assert.equal(run('rosterAt(0).players[0].bats'),'左');
assert.equal(run('rosterAt(0,0).players[0].bats'),'両');
console.log('PASS: 投打表示・旧データ不明・印刷・未変更判定・交代前後の利き打ち保持');

// 犠打・犠飛・野選・併殺と打席に紐付く進塁
run("data.events=[];result='安打';recordPitch();result='犠打';recordPitch()");
assert.equal(run('state().o'),1);
assert.equal(run('state().bases[1]'),1);
assert.equal(run('scorebookEntries()[0][0].reached'),2);
assert.equal(run('scorebookEntries()[0][1].result'),'犠打');
run("data.events=[];result='三塁打';recordPitch();result='犠飛';recordPitch()");
assert.equal(run('state().runs[0]'),1);
assert.equal(run('scorebookEntries()[0][0].scored'),true);
assert.equal(run('scorebookEntries()[0][1].out'),true);
run("data.events=[];result='安打';recordPitch();result='野選';recordPitch()");
assert.equal(run('state().o'),1);
assert.equal(run('state().bases[0]'),2);
assert.equal(run('scorebookEntries()[0][0].out'),true);
run("data.events=[];result='安打';recordPitch();result='併殺';recordPitch()");
assert.equal(run('state().o'),2);
assert.equal(run('state().bases.filter(x=>x!==null).length'),0);
assert.equal(run('scorebookEntries()[0].filter(e=>e.out).length'),2);
assert.ok(run("validateResult({...state(),o:0},[{from:-1,batter:3,to:'out'}],'併殺')"));
assert.ok(run("validateResult({...state(),o:2},[{from:-1,batter:3,to:'out'},{from:2,batter:1,to:'home'}],'犠飛')"));
// 打者一巡、残塁、投球履歴、守備表記、第三アウト時の無得点
run("data.events=[];result='安打';for(let i=0;i<10;i++)recordPitch()");
assert.equal(run('scorebookEntries()[0].filter(e=>e.order===1&&e.inning===1).length'),2);
run("data.events=[];result='ボール';for(let i=0;i<4;i++)recordPitch();result='アウト';for(let i=0;i<3;i++)recordPitch()");
assert.equal(run('scorebookEntries()[0][0].result'),'四球');
assert.equal(run('scorebookEntries()[0][0].pitches.length'),4);
assert.equal(run('scorebookEntries()[0][0].stranded'),true);
run("data.events=[];result='三塁打';recordPitch();result='アウト';recordPitch();recordPitch();document.querySelector('#add').onclick();pending.moves[1].to='home';document.querySelector('#count-runs').checked=false;document.querySelector('#defense-record').value='6-4-3';document.querySelector('#confirm-play').onsubmit({preventDefault(){}})");
assert.equal(run('scorebookEntries()[0][0].scored'),false);
assert.equal(run('scorebookEntries()[0][0].noRun'),true);
assert.ok(run('sheet()').includes('6-4-3'));
assert.ok(run('sheet()').includes('score-diamond'));
assert.ok(run('sheet()').includes('生還・無得点'));
console.log('PASS: 犠打・犠飛・野選・併殺・打者一巡・進塁紐付け・残塁・守備表記・スコアブック');

// 簡易分析：球順・打席の区切り・途中交代の選手を分離
run("data.events=[];data.dh=[false,false];data.lineups=emptyLineups();data.lineups.forEach((t,h)=>t.forEach((p,i)=>{p.name='簡易'+h+i;p.number=String(i+1)}));simpleTeam=0;result='ボール';pitch='ストレート';course=12;coursePoint=null;recordPitch();var simpleBefore=rosterAt(0);var simpleAfter=structuredClone(simpleBefore);simpleAfter.players[0]={...simpleAfter.players[0],name:'簡易代打',number:'12'};data.events.push({substitution:{team:0,before:simpleBefore,after:simpleAfter}});result='安打';pitch='スライダー';coursePoint={x:.41,y:.73};point={x:70,y:90};recordPitch()");
assert.equal(run("simpleAnalysisRows(0).find(r=>r.name==='簡易00').appearances[0].pitches[0].sequence"),1);
assert.equal(run("simpleAnalysisRows(0).find(r=>r.name==='簡易00').appearances[0].result"),'途中交代');
assert.equal(run("simpleAnalysisRows(0).find(r=>r.name==='簡易代打').appearances[0].pitches[0].sequence"),2);
assert.equal(run("simpleAnalysisRows(0).find(r=>r.name==='簡易代打').appearances[0].result"),'安打');
assert.equal(run("simpleAnalysisRows(0).find(r=>r.name==='簡易代打').appearances[0].pitches[0].point.x"),70);
assert.equal(run("simpleAnalysisRows(0).find(r=>r.name==='簡易00').appearances[0].pitches[0].location.x"),.5);
assert.equal(run('simpleAnalysisRows(1).every(r=>r.appearances.length===0)'),true);
assert.ok(run('simpleAnalysis()').includes('sequence-zone'));
assert.ok(run('simpleAnalysis()').includes('batted-ball-line'));
run("data.events=[];result='安打';for(let i=0;i<10;i++)recordPitch()");
assert.equal(run('simpleAnalysisRows(0)[0].appearances.length'),2);
assert.equal(run('simpleAnalysisRows(0)[0].appearances[1].pitches[0].sequence'),1);
console.log('PASS: 簡易分析の打席別球順・途中交代分離・打球・旧コース・打者一巡');
run("data.events=[];result='安打';for(let i=0;i<37;i++)recordPitch()");
assert.equal(run('simpleAnalysisRows(0)[0].appearances.length'),5);
assert.equal(run("(simpleAnalysis().match(/class=\"simple-page\"/g)||[]).length"),2);
console.log('PASS: 第5打席以降も4打席単位で欠落なく表示');
assert.ok(run('simpleAnalysis()').includes('第5打席'));
assert.ok(!run('simpleAnalysis()').includes('<th>第6打席</th>'));
run("data.events=[];result='ボール';recordPitch()");
assert.ok(run('simpleAnalysis()').includes('<th>第1打席</th>'));
assert.ok(!run('simpleAnalysis()').includes('<th>第2打席</th>'));
assert.equal(run("(simpleAnalysis().match(/<tr><th><b>/g)||[]).length"),1);
run('data.events=[]');
assert.ok(run('simpleAnalysis()').includes('打席記録はまだありません'));
assert.ok(!run('simpleAnalysis()').includes('class="simple-table"'));
console.log('PASS: 記録済み打席・打者のみ表示、未記録チームの空表示');

// 過去投球の修正：結果・走者を保ち、分析とスコアブックへ反映
run("data.events=[];result='安打';pitch='ストレート';point={x:80,y:90};recordPitch();result='ボール';recordPitch();var stateBeforeEdit=JSON.stringify(state());var playBeforeEdit=JSON.stringify(data.events[0].play);var laterPitchBeforeEdit=JSON.stringify(data.events[1]);startPitchEdit(0);editingPitch.draft.pitch='カーブ';editingPitch.draft.course=18;editingPitch.draft.coursePoint={x:.71,y:.68};editingPitch.draft.point={x:210,y:70};editingPitch.draft.kind='フライ';editingPitch.draft.defense='右前安打';document.querySelector('#edit-pitch-form').onsubmit({preventDefault(){}})");
assert.equal(run('editingPitch'),null);
assert.equal(run('JSON.stringify(state())'),run('stateBeforeEdit'));
assert.equal(run('JSON.stringify(data.events[0].play)'),run('playBeforeEdit'));
assert.equal(run('JSON.stringify(data.events[1])'),run('laterPitchBeforeEdit'));
assert.equal(run('data.events[0].result'),'安打');
assert.equal(run('analysisRows()[0].pitch'),'カーブ');
assert.equal(run('simpleAnalysisRows(0)[0].appearances[0].pitches[0].point.x'),210);
assert.equal(run('scorebookEntries()[0][0].defense'),'右前安打');
run("var eventBeforeCancel=JSON.stringify(data.events[0]);startPitchEdit(0);editingPitch.draft.pitch='フォーク';document.querySelector('#cancel-pitch-edit').onclick()");
assert.equal(run('JSON.stringify(data.events[0])'),run('eventBeforeCancel'));
run("startPitchEdit(0);editingPitch.draft.result='本塁打';editingPitch.draft.play={};document.querySelector('#edit-pitch-form').onsubmit({preventDefault(){}})");
assert.equal(run('data.events[0].result'),'安打');
assert.equal(run('JSON.stringify(data.events[0].play)'),run('playBeforeEdit'));
run("startPitchEdit(0);data.events[0].pitch='その他';document.querySelector('#edit-pitch-form').onsubmit({preventDefault(){}})");
assert.ok(run("document.querySelector('#edit-error').textContent").includes('元の記録が変わりました'));
run('editingPitch=null');
console.log('PASS: 過去投球修正・状態維持・後続記録保持・分析反映・キャンセル・競合防止');
