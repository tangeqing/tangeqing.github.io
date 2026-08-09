(function () {
  'use strict';
  const T=window.MelodyTheory;
  const KEY='tingjian_v1';
  const defaults={
    version:1, createdAt:new Date().toISOString(), theme:'dark', settings:{volume:.72,countIn:true,autoNext:false},
    stats:{total:0,correct:0,totalMs:0,replays:0,streak:0,lastPractice:null},
    abilities:Object.fromEntries(T.ABILITY_KEYS.map(([k])=>[k,{score:0,attempts:0,correct:0,totalMs:0,replays:0}])),
    history:[], today:{date:'',completed:[],minutes:0}, custom:{}, labSessions:[]
  };
  function deepMerge(a,b){
    const out=Array.isArray(a)?a.slice():Object.assign({},a); if(!b)return out;
    Object.keys(b).forEach(k=>{out[k]=(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object')?deepMerge(a[k],b[k]):b[k]}); return out;
  }
  function load(){ try{return deepMerge(defaults,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(_){return deepMerge(defaults,{})} }
  let data=load();
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch(_){return false} }
  function todayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function ensureToday(){if(data.today.date!==todayKey())data.today={date:todayKey(),completed:[],minutes:0}}
  function record(result){
    const now=new Date(), ability=result.ability||'singleSing', a=data.abilities[ability]||(data.abilities[ability]={score:0,attempts:0,correct:0,totalMs:0,replays:0});
    a.attempts++; if(result.correct)a.correct++; a.totalMs+=result.ms||0; a.replays+=Math.max(0,(result.plays||1)-1);
    const accuracy=a.correct/a.attempts*100, speed=Math.max(0,100-Math.max(0,(a.totalMs/a.attempts-2500)/80)); a.score=Math.round(accuracy*.78+speed*.22);
    data.stats.total++; if(result.correct)data.stats.correct++; data.stats.totalMs+=result.ms||0; data.stats.replays+=Math.max(0,(result.plays||1)-1);
    data.history.unshift({id:Date.now()+Math.random(),at:now.toISOString(),ability,correct:!!result.correct,ms:result.ms||0,plays:result.plays||1,detail:result.detail||''});
    data.history=data.history.slice(0,500); updateStreak(); save();
  }
  function updateStreak(){
    const today=todayKey(), last=data.stats.lastPractice;
    if(last!==today){
      if(last){const a=new Date(last+'T00:00:00'),b=new Date(today+'T00:00:00');data.stats.streak=Math.round((b-a)/86400000)===1?(data.stats.streak||0)+1:1}else data.stats.streak=1;
      data.stats.lastPractice=today;
    }
  }
  function completeToday(id,minutes){ensureToday();if(!data.today.completed.includes(id))data.today.completed.push(id);data.today.minutes=Math.max(data.today.minutes||0,minutes||0);updateStreak();save()}
  function exportData(){
    const blob=new Blob([JSON.stringify({app:'听见 Melody Ear Training',exportedAt:new Date().toISOString(),data},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='听见-训练数据-'+todayKey()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function importData(file){return file.text().then(text=>{const parsed=JSON.parse(text);const incoming=parsed.data||parsed;if(!incoming.version||!incoming.stats)throw new Error('这不是有效的“听见”训练数据');data=deepMerge(defaults,incoming);save();return data})}
  function reset(){data=deepMerge(defaults,{createdAt:new Date().toISOString()});save()}
  function set(path,value){let obj=data;const parts=path.split('.');parts.slice(0,-1).forEach(k=>{obj=obj[k]||(obj[k]={})});obj[parts[parts.length-1]]=value;save()}
  function addLabSession(session){data.labSessions.unshift(Object.assign({at:new Date().toISOString()},session));data.labSessions=data.labSessions.slice(0,100);save()}
  ensureToday(); save();
  window.MelodyStore={get data(){return data},save,record,completeToday,exportData,importData,reset,set,addLabSession,todayKey,ensureToday};
})();
