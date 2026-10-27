(function() {
  'use strict';
  const $ = id => document.getElementById(id);
  const catalog = window.MANABITANE_CATALOG;
  const core = window.SupportCore;
  if (!catalog || !core) { $('data-status').textContent='実践データを読み込めませんでした。ページを再読み込みしてください。'; return; }
  const categories = {CALM:'短い切り替え活動',TIP:'指導のコツ',SST:'SST',SGE:'SGE',PA:'PA'};
  const outcomes = {ready:'次の活動に入れた',adjust:'一部調整が必要',retry:'別の方法を試す'};
  const storageKey='manabitane.practice.v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const duration = value => { const seconds=Math.round(Number(value)*60);return seconds<60?`${seconds}秒`:seconds%60?`${Math.floor(seconds/60)}分${seconds%60}秒`:`${seconds/60}分`; };
  let activities=[...catalog.activities];
  const remoteCacheKey='manabitane.practice.remote.v1';
  try { activities=core.mergeRemote(activities,JSON.parse(localStorage.getItem(remoteCacheKey)||'null')); } catch {}
  let saved={favorites:[],today:[],logs:[]};
  let done=[];
  let storageAvailable=true;
  try {
    saved=core.readStore(localStorage.getItem(storageKey),activities.map(x=>x.id));
    const old=JSON.parse(localStorage.getItem('actDone_v1')||'[]');
    if (Array.isArray(old)) done=old.filter(x=>typeof x==='string');
  } catch { storageAvailable=false; }
  const state={q:'',issue:'',stage:'',grade:'',scene:'',category:'',duration:'',aim:'',group:'',place:'',season:'',saved:false,limit:12,detail:''};
  const advanced={aim:[...new Set(activities.flatMap(x=>x.aims||[]))],group:['ペア','4人班','班複数','学級全体'],place:['教室','体育館','校庭','どこでも'],season:['4月出会い','学期途中','行事前','学年末']};
  for(const aim of advanced.aim){const option=document.createElement('option');option.value=aim;option.textContent=aim;$('aim').append(option);}
  let projectedId='',projectStep=0,timerSeconds=30,timerInitial=30,timerInterval=null,timerDeadline=0;
  let toastTimeout;
  function itemById(id) { return activities.find(x=>x.id===id); }
  function readURL() {
    const params=new URLSearchParams(location.search);
    state.q=params.get('q')||'';
    state.issue=catalog.issues.some(x=>x.id===params.get('issue'))?params.get('issue'):'';
    state.stage=catalog.stages.some(x=>x.id===params.get('stage'))?params.get('stage'):'';
    state.grade=['低学年','中学年','高学年'].includes(params.get('grade'))?params.get('grade'):'';
    state.scene=['朝の会','授業','休み時間明け','給食','帰りの会'].includes(params.get('scene'))?params.get('scene'):'';
    state.category=categories[params.get('category')]?params.get('category'):'';
    state.duration=['1','3','10','20','30'].includes(params.get('duration'))?params.get('duration'):'';
    for(const key of Object.keys(advanced))state[key]=advanced[key].includes(params.get(key))?params.get(key):'';
    state.saved=params.get('view')==='saved';
    state.detail=params.get('id')||'';
  }
  function syncURL() {
    const url=new URL(location.href);
    for (const key of ['q','issue','stage','grade','scene','category','duration','aim','group','place','season']) { if(state[key]) url.searchParams.set(key,state[key]); else url.searchParams.delete(key); }
    if(state.saved)url.searchParams.set('view','saved');else url.searchParams.delete('view');
    if(state.detail)url.searchParams.set('id',state.detail);else url.searchParams.delete('id');
    history.replaceState(null,'',url);
  }
  function toast(message) { const node=$('toast');const parent=$('project-dialog').open?$('project-dialog'):$('practice-dialog').open?$('practice-dialog'):document.body;parent.append(node);node.textContent=message;node.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>node.classList.remove('visible'),3300); }
  function persist() {
    try { localStorage.setItem(storageKey,JSON.stringify(saved));localStorage.setItem('actDone_v1',JSON.stringify(done));storageAvailable=true; }
    catch { storageAvailable=false;toast('このブラウザーでは保存できません。内容は今開いている間だけ保持します。'); }
    $('data-status').textContent=storageAvailable?'':'このブラウザーでは端末への保存が利用できません。';
    return storageAvailable;
  }
  function filterState() { return {...state,favorites:saved.favorites}; }
  function focusToken() { const el=document.activeElement;return el && el.dataset.action?{action:el.dataset.action,id:el.dataset.id||'',scope:el.dataset.scope||'',outcome:el.dataset.outcome||''}:null; }
  function restoreFocus(token,root=document) { if(!token)return;const el=[...root.querySelectorAll('[data-action]')].find(x=>x.dataset.action===token.action && (x.dataset.id||'')===token.id && (x.dataset.scope||'')===token.scope && (x.dataset.outcome||'')===token.outcome);if(el)el.focus({preventScroll:true}); }
  function card(item,featured=false,scope='list') {
    const stage=catalog.stages.find(x=>x.id===item.stage);
    const isSaved=saved.favorites.includes(item.id),isToday=saved.today.includes(item.id),isDone=done.includes(item.id);
    const id=esc(item.id);
    return `<article class="practice-card${featured?' featured':''}" data-stage="${esc(item.stage)}">${featured?`<p class="stage-label">${esc(stage?.label||'実践')}</p>`:''}<div class="card-topline"><span class="category" data-category="${esc(item.category)}">${esc(categories[item.category]||'活動')}</span><button class="bookmark" data-action="save" data-id="${id}" data-scope="${scope}" aria-pressed="${isSaved}" aria-label="${esc(item.title)}を${isSaved?'引き出しから外す':'引き出しに保存'}">${isSaved?'♥':'♡'}</button></div><h3><button class="card-open" data-action="open" data-id="${id}" data-scope="${scope}">${esc(item.title)}</button></h3><p class="card-description">${esc(item.catchphrase)}</p><div class="card-meta"><span>◷ ${esc(duration(item.duration))}</span><span>${esc((item.grades||[]).join('・')||'学年を確認')}</span>${isDone?'<span class="done-badge">✓ 実施済み</span>':''}</div><div class="card-bottom"><button class="card-detail" data-action="open" data-id="${id}" data-scope="${scope}-detail">声かけと手順を見る →</button><button class="today-add" data-action="today" data-id="${id}" data-scope="${scope}" aria-pressed="${isToday}" aria-label="${esc(item.title)}を${isToday?'今日使うから外す':'今日使うに追加'}">${isToday?'✓ 今日使う':'＋ 今日使う'}</button></div></article>`;
  }
  function render() {
    const token=focusToken();
    for(const key of ['q','grade','scene','duration','category','aim','group','place','season']) { const el=$(key==='q'?'search':key);if(el.value!==state[key])el.value=state[key]; }
    $('saved-count').textContent=saved.favorites.length;$('today-count').textContent=saved.today.length;
    $('saved-button').setAttribute('aria-pressed',String(state.saved));
    $('issues').innerHTML=catalog.issues.map(issue=>`<button class="issue-button" data-action="issue" data-id="${esc(issue.id)}" aria-pressed="${state.issue===issue.id}"><span class="emoji" aria-hidden="true">${esc(issue.emoji)}</span><strong>${esc(issue.label)}</strong><small>${esc(issue.description)}</small></button>`).join('');
    $('stages').innerHTML=[{id:'',label:'すべて'},...catalog.stages].map(stage=>`<button data-action="stage" data-id="${stage.id}" aria-pressed="${state.stage===stage.id}">${esc(stage.label)}</button>`).join('');
    const filtered=core.filter(activities,filterState(),catalog).sort((a,b)=>['now','routine','grow'].indexOf(a.stage)-['now','routine','grow'].indexOf(b.stage));
    const recommendations=core.recommend(activities,filterState(),catalog);
    $('recommend-section').hidden=state.saved||!recommendations.length;
    $('recommendations').innerHTML=recommendations.map(x=>card(x,true,'recommend')).join('');
    $('results-eyebrow').textContent=state.saved?'MY DRAWER':'PRACTICE LIBRARY';
    $('result-count').textContent=`${filtered.length}件`;
    const labels=[catalog.issues.find(x=>x.id===state.issue)?.label,catalog.stages.find(x=>x.id===state.stage)?.label,state.grade,state.scene,state.duration?duration(state.duration)+'以内':'',categories[state.category],state.aim,state.group,state.place,state.season,state.q?'「'+state.q+'」':''].filter(Boolean);
    $('filter-summary').textContent=(state.saved?'マイ引き出し / ':'')+(labels.length?labels.join(' / '):'困りごと・学年・場面・時間で選べます。');
    $('cards').innerHTML=filtered.length?filtered.slice(0,state.limit).map(x=>card(x)).join(''):`<div class="empty-state"><strong>${state.saved?'条件に合う保存済みの実践がありません':'条件に合う実践がありません'}</strong><p>${state.saved?'カードの♡で自分の引き出しに保存できます。':'検索語を短くするか、条件を減らしてみてください。'}</p><button class="text-button" data-action="clear">${state.saved?'すべての実践を見る':'条件をクリア'}</button></div>`;
    $('load-more').hidden=filtered.length<=state.limit;
    $('today-list').innerHTML=saved.today.length?saved.today.map((id,index)=>{const item=itemById(id);return `<div class="today-row"><span class="today-number">${index+1}</span><button class="today-title" data-action="open" data-id="${esc(id)}" data-scope="today">${esc(item.title)}</button><button class="quiet" data-action="project" data-id="${esc(id)}">教室に提示</button><button class="remove-today" data-action="today" data-id="${esc(id)}" data-scope="tray" aria-label="${esc(item.title)}を今日使うから外す">外す</button></div>`;}).join(''):'<p class="empty-today">カードの「＋ 今日使う」から３件まで選べます。朝の会・給食・帰りの会の準備に。</p>';
    const logs=[...saved.logs].reverse().slice(0,5);
    $('history-list').innerHTML=logs.length?logs.map(log=>`<div class="history-row"><span class="history-date">${esc(new Date(log.date).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'}))}</span><button data-action="open" data-id="${esc(log.id)}" data-scope="history">${esc(itemById(log.id)?.title||log.id)}</button><span class="outcome">${esc(outcomes[log.outcome])}</span></div>`).join(''):'<p class="muted">実践カードの「10秒の記録」から、次のひと工夫を残せます。</p>';
    $('done-summary').textContent=`実施済み ${done.filter(id=>itemById(id)).length}件`;
    if(!storageAvailable)$('data-status').textContent='このブラウザーでは端末への保存が利用できません。';
    restoreFocus(token);
  }
  function renderPractice(item) {
    const token=focusToken(),top=$('practice-dialog').scrollTop;
    const stage=catalog.stages.find(x=>x.id===item.stage);
    const isSaved=saved.favorites.includes(item.id),isToday=saved.today.includes(item.id);
    const latest=[...saved.logs].reverse().find(x=>x.id===item.id);
    const videos=(item.videos||[]).filter(v=>v&&/^https?:\/\//i.test(v.url));
    $('practice-content').innerHTML=`<header class="dialog-header"><span class="category" data-category="${esc(item.category)}">${esc(categories[item.category])} / ${esc(stage?.label||'')}</span><button class="close-button" data-action="close" aria-label="実践カードを閉じる" autofocus>×</button><h2 id="practice-title">${esc(item.title)}</h2><p class="muted">${esc(item.catchphrase)}</p><div class="dialog-meta">${[duration(item.duration),(item.grades||[]).join('・'),(item.groupSize||[]).join('・'),(item.place||[]).join('・'),'準備：'+(item.materials||[]).join('・')].map(t=>`<span>${esc(t)}</span>`).join('')}</div></header><div class="dialog-body">${item.noviceReady===false?'<p class="review-notice">指導経験や事前の準備・配慮が必要な活動です。まず「うまくいかない時・参加の調整」を確認し、経験のある先生と相談して選びましょう。</p>':''}<section><h3>最初の一言</h3><p class="opening-quote">${esc(item.opening)}</p></section><section><h3>進め方</h3><ol class="steps-list">${(item.steps||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section><section class="closing-box"><p><strong>終わりの一言</strong>${esc(item.closing)}</p><p><strong>次の活動へ</strong>${esc(item.nextAction)}</p></section><section><h3>うまくいかない時・参加の調整</h3><div class="guidance"><p><strong>うまくいかない時は</strong>${esc(item.adjustment)}</p><p><strong>参加しやすい方法で</strong>${esc(item.participation)}</p></div></section><section><h3>振り返りの問い</h3><ul class="reflection-list">${(item.reflection||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>${item.tips?`<section><h3>指導のひと工夫</h3><p class="teacher-tips">${esc(item.tips)}</p></section>`:''}${videos.length?`<section class="video-links"><h3>参考動画</h3>${videos.map(v=>`<a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">▶ ${esc(v.title||'参考動画を見る')} ↗</a>`).join('')}</section>`:''}<div class="dialog-actions"><button class="primary" data-action="project" data-id="${esc(item.id)}">教室に提示する</button><button class="outline" data-action="save" data-id="${esc(item.id)}" data-scope="dialog" aria-pressed="${isSaved}">${isSaved?'♥ 引き出しに保存済み':'♡ 引き出しに保存'}</button><button class="outline" data-action="today" data-id="${esc(item.id)}" data-scope="dialog" aria-pressed="${isToday}">${isToday?'✓ 今日使うから外す':'＋ 今日使う'}</button><button class="quiet" data-action="print" data-id="${esc(item.id)}">印刷・PDF保存</button></div><section class="record-box"><h3>やってみたら、10秒の記録</h3><p>次の活動を始められたか、今の様子を残します。</p><div class="record-buttons">${Object.entries(outcomes).map(([key,label])=>`<button data-action="record" data-id="${esc(item.id)}" data-outcome="${key}" aria-label="${esc(label)}と記録する">${esc(label)}</button>`).join('')}</div>${latest?`<p class="recorded-note">直近の記録：${esc(new Date(latest.date).toLocaleDateString('ja-JP'))} / ${esc(outcomes[latest.outcome])}</p>`:done.includes(item.id)?'<p class="recorded-note">以前の実施済み記録を引き継いでいます。</p>':''}</section></div>`;
    $('practice-dialog').scrollTop=top;restoreFocus(token,$('practice-dialog'));
  }
  function openPractice(id) {
    const item=itemById(id);if(!item){toast('実践カードが見つかりませんでした。');return;}
    state.detail=id;syncURL();renderPractice(item);if(!$('practice-dialog').open){$('practice-dialog').showModal();$('practice-dialog').scrollTop=0;}
  }
  function changeFilters() { state.limit=12;syncURL();render(); }
  function resetFilters() { Object.assign(state,{q:'',issue:'',stage:'',grade:'',scene:'',category:'',duration:'',aim:'',group:'',place:'',season:'',saved:false,limit:12});changeFilters(); }
  function toggleSave(id) { saved.favorites=saved.favorites.includes(id)?saved.favorites.filter(x=>x!==id):[...saved.favorites,id];const stored=persist();render();if($('practice-dialog').open)renderPractice(itemById(state.detail));if(stored)toast(saved.favorites.includes(id)?'自分の引き出しに保存しました。':'引き出しから外しました。'); }
  function toggleToday(id) {
    if(saved.today.includes(id))saved.today=saved.today.filter(x=>x!==id);
    else {if(saved.today.length>=3){toast('今日使う実践は３件まで。使わないものを外してから追加してください。');return;}saved.today.push(id);}
    const stored=persist();render();if($('practice-dialog').open)renderPractice(itemById(state.detail));
    if(stored)toast(saved.today.includes(id)?'今日使う実践に追加しました。':'今日使う実践から外しました。');
  }
  function record(id,outcome) { if(!outcomes[outcome])return;saved.logs.push({id,outcome,date:new Date().toISOString()});saved.logs=saved.logs.slice(-50);if(!done.includes(id))done.push(id);const stored=persist();render();renderPractice(itemById(id));if(stored)toast('実践を記録しました。次のひと工夫につなげましょう。'); }
  function printCard(item) {
    $('print-sheet').innerHTML=`<h1>${esc(item.title)}</h1><p class="print-meta">まなびたね / ${esc(categories[item.category])} / ${esc(duration(item.duration))} / ${esc((item.grades||[]).join('・'))}</p><p>${esc(item.catchphrase)}</p><section><h2>最初の一言</h2><p>${esc(item.opening)}</p></section><section><h2>進め方</h2><ol>${item.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section><section><h2>終わりの一言・次の活動</h2><p>${esc(item.closing)}</p><p>${esc(item.nextAction)}</p></section><section><h2>うまくいかない時・参加の調整</h2><p>${esc(item.adjustment)}</p><p>${esc(item.participation)}</p></section><section><h2>振り返り</h2>${item.reflection.map(x=>`<p>・${esc(x)}</p>`).join('')}</section><p class="print-meta">${esc(location.origin+location.pathname+'?id='+encodeURIComponent(item.id))}</p>`;
    window.print();
  }
  function paintProject() {
    const item=itemById(projectedId);if(!item)return;
    $('project-title').textContent=item.title;
    $('project-steps').innerHTML=item.projection.map((x,i)=>`<li class="${i===projectStep?'current':''}"${i===projectStep?' aria-current="step"':''}>${esc(x)}</li>`).join('');
    $('project-progress').textContent=`${projectStep+1} / ${item.projection.length}`;
    $('project-prev').disabled=projectStep===0;$('project-next').disabled=projectStep===item.projection.length-1;
  }
  function showProject(id) {
    const item=itemById(id);if(!item)return;projectedId=id;projectStep=0;stopTimer();timerInitial=Math.round(item.duration*60);timerSeconds=timerInitial;paintTimer();paintProject();
    $('project-dialog').showModal();if($('practice-dialog').open)$('practice-dialog').close();
  }
  function paintTimer() { $('timer-output').textContent=`${Math.floor(timerSeconds/60)}:${String(timerSeconds%60).padStart(2,'0')}`;$('timer-toggle').textContent=timerInterval?'一時停止':timerSeconds===0?'もう一度':'スタート'; }
  function stopTimer() { if(timerInterval)clearInterval(timerInterval);timerInterval=null; }
  function toggleTimer() {
    if(timerInterval){timerSeconds=Math.max(0,Math.ceil((timerDeadline-Date.now())/1000));stopTimer();paintTimer();return;}
    if(timerSeconds===0)timerSeconds=timerInitial;timerDeadline=Date.now()+timerSeconds*1000;
    timerInterval=setInterval(()=>{timerSeconds=Math.max(0,Math.ceil((timerDeadline-Date.now())/1000));if(!timerSeconds)stopTimer();paintTimer();},200);paintTimer();
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    const {action,id,outcome}=button.dataset;
    if(action==='issue'){state.issue=state.issue===id?'':id;state.saved=false;changeFilters();}
    else if(action==='stage'){state.stage=id;changeFilters();}
    else if(action==='open')openPractice(id);
    else if(action==='save')toggleSave(id);
    else if(action==='today')toggleToday(id);
    else if(action==='close')$('practice-dialog').close();
    else if(action==='record')record(id,outcome);
    else if(action==='project')showProject(id);
    else if(action==='print')printCard(itemById(id));
    else if(action==='clear')resetFilters();
  });
  $('search').addEventListener('input',event=>{state.q=event.target.value;changeFilters();});
  for(const key of ['grade','scene','duration','category','aim','group','place','season'])$(key).addEventListener('change',event=>{state[key]=event.target.value;changeFilters();});
  $('clear-filters').addEventListener('click',resetFilters);$('reset-top').addEventListener('click',resetFilters);
  $('saved-button').addEventListener('click',()=>{const next=!state.saved;resetFilters();state.saved=next;changeFilters();$('results').scrollIntoView({block:'start'});});
  $('load-more').addEventListener('click',()=>{state.limit+=12;render();});
  $('reset-records').addEventListener('click',()=>{if(!confirm('実施済み記録と振り返りをリセットしますか？引き出しと今日の予定は残ります。'))return;done=[];saved.logs=[];const stored=persist();render();if(stored)toast('実施記録をリセットしました。');});
  $('practice-dialog').addEventListener('click',event=>{if(event.target===$('practice-dialog'))$('practice-dialog').close();});
  $('practice-dialog').addEventListener('close',()=>{document.body.append($('toast'));if(!$('project-dialog').open){state.detail='';syncURL();}});
  $('project-close').addEventListener('click',()=>$('project-dialog').close());
  $('project-dialog').addEventListener('close',()=>{stopTimer();if(projectedId)openPractice(projectedId);});
  $('project-prev').addEventListener('click',()=>{projectStep=Math.max(0,projectStep-1);paintProject();});
  $('project-next').addEventListener('click',()=>{projectStep=Math.min(itemById(projectedId).projection.length-1,projectStep+1);paintProject();});
  $('timer-toggle').addEventListener('click',toggleTimer);
  $('timer-reset').addEventListener('click',()=>{stopTimer();timerSeconds=timerInitial;paintTimer();});
  $('help-button').addEventListener('click',()=>$('help-dialog').showModal());
  for(const id of ['help-close','help-start'])$(id).addEventListener('click',()=>$('help-dialog').close());
  window.addEventListener('popstate',()=>{readURL();render();if(state.detail)openPractice(state.detail);else if($('practice-dialog').open)$('practice-dialog').close();});
  readURL();render();if(state.detail){if(itemById(state.detail))openPractice(state.detail);else $('data-status').textContent='指定されたカードが見つかりません。条件を選んで探してください。';}

  // Keep the existing public Sheets/GAS content source, while the complete bundled catalog is always available.
  const gasURL='https://script.google.com/macros/s/AKfycbyVqWgpxzqWI_NxQW6RAKK_hT4kqbLry5nR4WsxkrXK9yy0USWd-7eKcpFQHQDcgNp2MA/exec';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
  fetch(gasURL,{signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('load');return response.json();}).then(remote=>{if(!Array.isArray(remote))throw new Error('data');activities=core.mergeRemote(catalog.activities,remote);saved=core.readStore(JSON.stringify(saved),activities.map(x=>x.id));try{localStorage.setItem(remoteCacheKey,JSON.stringify(remote));localStorage.setItem(storageKey,JSON.stringify(saved));}catch{}render();const item=itemById(state.detail);if($('practice-dialog').open&&item)renderPractice(item);else if($('practice-dialog').open)$('practice-dialog').close();}).catch(()=>{$('data-status').textContent='この端末の実践データを表示しています。実践の検索・閲覧・保存はそのまま使えます。';}).finally(()=>clearTimeout(timeout));
})();
