const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const context={window:{}};
for(const file of ['catalog.js','core.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
const catalog=context.window.MANABITANE_CATALOG,core=context.window.SupportCore,items=catalog.activities;
test('30 existing and 20 new practice cards include a usable script and projection',()=>{
  assert.equal(items.length,50);assert.equal(new Set(items.map(x=>x.id)).size,50);
  for(const category of ['PA','SGE','SST','CALM','TIP'])assert.equal(items.filter(x=>x.category===category).length,10);
  for(const item of items){for(const field of ['opening','closing','nextAction','adjustment','participation'])assert.ok(item[field],item.id+field);assert.ok(item.projection.length>=3);}
});
test('issue, stage, grade, scene, time and method combine as intersecting filters',()=>{
  const result=core.filter(items,{issue:'listen',stage:'now',grade:'低学年',scene:'授業',duration:1,category:'CALM'},catalog);
  assert.ok(result.length>0);for(const x of result){assert.ok(x.issues.includes('listen'));assert.equal(x.stage,'now');assert.ok(x.duration<=1);assert.ok(x.scenes.includes('授業'));}
  assert.equal(core.filter(items,{stage:'now',category:'PA'},catalog).length,0);
});
test('original aim, group, place and season filters still work',()=>{
  const result=core.filter(items,{aim:'関係づくり',group:'ペア',place:'教室',season:'4月出会い'},catalog);
  assert.ok(result.length>0);for(const x of result){assert.ok(x.aims.includes('関係づくり'));assert.ok(x.groupSize.includes('ペア'));assert.ok(x.place.includes('教室'));assert.ok(x.season.includes('4月出会い'));}
});
test('free text covers everyday synonyms and the full teaching guidance',()=>{
  for(const q of ['静か','ざわざわ','距離','選択','給食','ＳＳＴ'])assert.ok(core.filter(items,{q},catalog).length>0,q);
  assert.equal(core.filter(items,{q:'存在しない検索語_xyz'},catalog).length,0);
  for(const item of core.filter(items,{q:'給食 手順'},catalog))assert.ok(item);
});
test('recommendations separate immediate support from relationship work and avoid specialist activities',()=>{
  for(const issue of ['',...catalog.issues.map(x=>x.id)]){
    const rec=core.recommend(items,{issue},catalog);assert.ok(rec.length<=3);
    assert.equal(new Set(rec.map(x=>x.stage)).size,rec.length);
    for(const x of rec){assert.notEqual(x.noviceReady,false);if(x.stage==='now')assert.equal(x.category,'CALM');if(issue)assert.ok(x.issues.includes(issue));}
  }
});
test('saved view only returns favorites, and corrupted storage cannot break startup',()=>{
  assert.equal(core.filter(items,{saved:true,favorites:['calm01']},catalog).length,1);
  for(const raw of ['broken','null','42','[]'])assert.equal(core.readStore(raw,items.map(x=>x.id)).favorites.length,0);
  const store=core.readStore(JSON.stringify({favorites:['calm01','calm01','unknown'],today:['calm01','calm02','calm03','calm04'],logs:[{id:'calm01',outcome:'ready',date:'bad date'}]}),items.map(x=>x.id));
  assert.equal(store.favorites.length,1);assert.equal(store.today.length,3);assert.equal(store.logs.length,0);
});
test('GAS refresh preserves new local cards and corrected teaching guidance while accepting video updates',()=>{
  const result=core.mergeRemote(items,[{id:'pa01',title:'シートの最新タイトル'},{id:'sst06',steps:['怒りのピークは6秒'],videos:[{url:'https://youtu.be/abcdefghijk',title:'動画'},{url:'javascript:bad()'}]}]);
  assert.equal(result.length,50);assert.equal(result.find(x=>x.id==='pa01').title,'シートの最新タイトル');
  assert.notEqual(result.find(x=>x.id==='sst06').steps[0],'怒りのピークは6秒');assert.equal(result.find(x=>x.id==='sst06').videos.length,1);
  assert.equal(result.filter(x=>x.category==='CALM'||x.category==='TIP').length,20);
});
test('new valid GAS activities remain available and can restore their saved state from cached IDs',()=>{
  const result=core.mergeRemote(items,[{id:'pa99',category:'PA',title:'追加活動',steps:['確認する','試す'],duration:10},{id:'invalid',category:'BAD',title:'不正'}]);
  assert.equal(result.length,51);const extra=result.find(x=>x.id==='pa99');assert.equal(extra.noviceReady,false);assert.equal(extra.stage,'grow');assert.ok(extra.projection.length);
  const store=core.readStore(JSON.stringify({favorites:['pa99'],today:['pa99'],logs:[{id:'pa99',outcome:'adjust',date:'2026-10-27T00:00:00Z'}]}),result.map(x=>x.id));
  assert.equal(store.favorites[0],'pa99');assert.equal(store.today[0],'pa99');assert.equal(store.logs.length,1);
});
test('bad remote responses leave the bundled catalog usable',()=>{for(const value of [null,{},'bad',[],[null,1,{id:'pa01',steps:{bad:true},videos:[{},null]}]]){const result=core.mergeRemote(items,value);assert.equal(result.length,50);assert.ok(result.find(x=>x.id==='pa01').steps.length);}});
