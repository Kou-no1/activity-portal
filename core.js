(function(root) {
  'use strict';
  const list = value => Array.isArray(value) ? value.filter(x => typeof x === 'string') : [];
  const normalizeText = value => String(value || '').normalize('NFKC').toLowerCase();
  const synonyms = {
    listen:'話 聞く 聞き方 静か しずか ざわざわ ざわつく うるさい 私語 おしゃべり 集中 注意 声 指示',
    switch:'切り替え 切替 切りかえ きりかえ 休み時間 授業開始 準備 時間 移動 片付け タイマー',
    routine:'朝の会 朝会 給食 配膳 食事 帰りの会 帰り支度 下校 ルーティン 手順 生活 待つ 待ち時間 静か 落ち着く',
    conflict:'けんか 喧嘩 悪口 トラブル 争い 怒り イライラ もめる 断る 謝る 気持ち 関係',
    cooperate:'協力 班 グループ 仲間 関係づくり 友達 友だち つながり 学級づくり 話し合い チーム'
  };
  const flatten = value => Array.isArray(value) ? value.map(flatten).join(' ') : value && typeof value === 'object' ? Object.values(value).map(flatten).join(' ') : String(value || '');
  function searchText(item, catalog) {
    const issueLabels = (catalog.issues || []).filter(x => list(item.issues).includes(x.id)).map(x => x.label+' '+x.description);
    return normalizeText([flatten(item),...issueLabels,...list(item.issues).map(id=>synonyms[id]||''),item.category==='TIP'?'教師力向上':'学級経営'].join(' '));
  }
  function matches(item, state, catalog) {
    if (state.issue && !list(item.issues).includes(state.issue)) return false;
    if (state.stage && item.stage !== state.stage) return false;
    if (state.grade && !list(item.grades).includes(state.grade)) return false;
    if (state.scene && !list(item.scenes).includes(state.scene)) return false;
    if (state.category && item.category !== state.category) return false;
    for (const [key,field] of [['aim','aims'],['group','groupSize'],['place','place'],['season','season']]) if (state[key] && !list(item[field]).includes(state[key])) return false;
    if (state.duration && Number(item.duration) > Number(state.duration)) return false;
    if (state.saved && !list(state.favorites).includes(item.id)) return false;
    if (state.q && !normalizeText(state.q).trim().split(/\s+/).every(term => searchText(item,catalog).includes(term))) return false;
    return true;
  }
  function filter(activities, state, catalog) { return activities.filter(item => matches(item,state,catalog)); }
  function recommend(activities, state, catalog) {
    const candidates = filter(activities,{...state,saved:false},catalog).filter(item => item.noviceReady !== false);
    return (state.stage ? [state.stage] : ['now','routine','grow']).map(stage => candidates.filter(item => item.stage === stage).sort((a,b) => Number(a.difficulty || 1)-Number(b.difficulty || 1) || Number(a.duration)-Number(b.duration))[0]).filter(Boolean);
  }
  function readStore(raw, ids) {
    let value; try { value=JSON.parse(raw || '{}'); } catch { value={}; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) value={};
    const valid = values => [...new Set(list(values).filter(x => ids.includes(x)))];
    return {favorites:valid(value.favorites),today:valid(value.today).slice(0,3),logs:(Array.isArray(value.logs)?value.logs:[]).filter(x => x && ids.includes(x.id) && ['ready','adjust','retry'].includes(x.outcome) && typeof x.date === 'string' && Number.isFinite(Date.parse(x.date))).slice(-50)};
  }
  function mergeRemote(local, remote) {
    if (!Array.isArray(remote)) return local;
    const fields=['title','catchphrase','tips'];
    const arrays=['groupSize','aims','place','season','materials','steps','reflection'];
    const byId = new Map(remote.filter(x => x && typeof x.id === 'string').map(x => [x.id,x]));
    // The sheet continues to supply the existing activities; locally edited teaching guidance takes priority.
    const protectedIds=['sst02','sst03','sst06','pa05','pa07','sge06'];
    const merged=local.map(item => {
      if (item.category === 'CALM' || item.category === 'TIP') return item;
      const input=byId.get(item.id); if (!input) return item;
      const next={...item};
      if (!protectedIds.includes(item.id)) {
        for (const key of fields) if (typeof input[key] === 'string' && input[key].trim()) next[key]=input[key];
        for (const key of arrays) if (Array.isArray(input[key]) && list(input[key]).length) next[key]=list(input[key]);
        if (Number.isFinite(Number(input.duration)) && Number(input.duration)>0) next.duration=Number(input.duration);
      }
      if (Array.isArray(input.videos)) next.videos=input.videos.filter(v => v && typeof v.url==='string' && /^https?:\/\//i.test(v.url)).map(v=>({url:v.url,title:typeof v.title==='string'?v.title:''}));
      return next;
    });
    for (const input of byId.values()) {
      if (local.some(x=>x.id===input.id) || !['PA','SGE','SST'].includes(input.category) || typeof input.title!=='string' || !list(input.steps).length) continue;
      const extra={id:input.id,category:input.category,title:input.title,catchphrase:typeof input.catchphrase==='string'?input.catchphrase:'追加された活動',duration:Number.isFinite(Number(input.duration))&&Number(input.duration)>0?Number(input.duration):20,difficulty:3,stage:'grow',issues:[],grades:[],scenes:[],noviceReady:false,opening:'活動の手順と、参加の仕方を一緒に確かめましょう。',closing:'取り組んで気づいたことを振り返りましょう。',nextAction:'活動で気づいたことを、どの生活場面で使えるか考える。',adjustment:'追加された活動です。内容・対象学年・準備を確認し、経験のある先生と相談して実施してください。',participation:'参加しない選択や見学を含め、子どもに合う方法を事前に相談する。',projection:['活動の手順を確かめる','自分に合う方法で参加する','気づいたことを振り返る'],videos:[]};
      for (const key of fields) if(typeof input[key]==='string')extra[key]=input[key];
      for (const key of arrays)extra[key]=list(input[key]);
      extra.videos=Array.isArray(input.videos)?input.videos.filter(v=>v&&typeof v.url==='string'&&/^https?:\/\//i.test(v.url)).map(v=>({url:v.url,title:typeof v.title==='string'?v.title:''})):[];
      merged.push(extra);
    }
    return merged;
  }
  root.SupportCore={filter,recommend,readStore,mergeRemote,normalizeText};
})(typeof window !== 'undefined' ? window : globalThis);
