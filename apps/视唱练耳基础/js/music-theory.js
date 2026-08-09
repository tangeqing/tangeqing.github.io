(function () {
  'use strict';

  const NOTE_NAMES = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const NOTE_NAMES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const MAJOR_STEPS = [0,2,4,5,7,9,11];
  const INTERVALS = [
    { id:'P1', semitones:0, name:'纯一度' }, { id:'m2', semitones:1, name:'小二度' },
    { id:'M2', semitones:2, name:'大二度' }, { id:'m3', semitones:3, name:'小三度' },
    { id:'M3', semitones:4, name:'大三度' }, { id:'P4', semitones:5, name:'纯四度' },
    { id:'TT', semitones:6, name:'三全音' }, { id:'P5', semitones:7, name:'纯五度' },
    { id:'m6', semitones:8, name:'小六度' }, { id:'M6', semitones:9, name:'大六度' },
    { id:'m7', semitones:10, name:'小七度' }, { id:'M7', semitones:11, name:'大七度' },
    { id:'P8', semitones:12, name:'纯八度' }
  ];
  const KEYS = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const KEY_PCS = { C:0, Db:1, D:2, Eb:3, E:4, F:5, 'F#':6, G:7, Ab:8, A:9, Bb:10, B:11 };
  const STRINGS = [64,59,55,50,45,40]; // high E to low E
  const ABILITY_KEYS = [
    ['singleSing','单音模唱'],['pitchMemory','音高记忆'],['intervalHear','音程听辨'],
    ['intervalSing','音程构唱'],['degreeHear','级数听辨'],['degreeSing','级数构唱'],
    ['melodyMemory','短旋律记忆'],['melodyWrite','短旋律听写'],['fretMap','吉他听觉映射'],
    ['realMelody','真实扒旋律']
  ];

  function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
  function randomInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function midiToFreq(midi){ return 440*Math.pow(2,(midi-69)/12); }
  function noteName(midi,withOctave){
    const name=NOTE_NAMES_SHARP[((midi%12)+12)%12];
    return withOctave===false?name:name+(Math.floor(midi/12)-1);
  }
  function pcName(pc){ return NOTE_NAMES[((pc%12)+12)%12]; }
  function degreeMidi(rootMidi,degree,octaveShift){
    return rootMidi+MAJOR_STEPS[degree-1]+12*(octaveShift||0);
  }
  function keyRootMidi(key,around){
    const target=around||60, pc=KEY_PCS[key];
    let midi=Math.floor(target/12)*12+pc;
    if(midi<target-6)midi+=12;
    if(midi>target+6)midi-=12;
    return midi;
  }
  function intervalById(id){ return INTERVALS.find(x=>x.id===id)||INTERVALS[0]; }
  function intervalIdFromSemitones(n){
    const abs=Math.abs(n); return (INTERVALS.find(x=>x.semitones===abs)||{id:abs+'st'}).id;
  }
  function guitarNote(stringIndex,fret){ return STRINGS[stringIndex]+fret; }
  function guitarPositions(midiOrPc,maxFret){
    const pc=((midiOrPc%12)+12)%12, out=[];
    STRINGS.forEach((open,s)=>{ for(let f=0;f<=(maxFret||12);f++) if((open+f)%12===pc) out.push({string:s,fret:f,midi:open+f}); });
    return out;
  }
  function generateMelody(options){
    const o=Object.assign({difficulty:1,length:3,degrees:[1,2,3,5],maxLeap:4,stepProbability:.8,key:'C'},options||{});
    const allowed=o.degrees.slice().sort((a,b)=>a-b);
    let current=pick(allowed), degrees=[current], guard=0;
    while(degrees.length<o.length&&guard++<200){
      let candidates=allowed.filter(d=>Math.abs(MAJOR_STEPS[d-1]-MAJOR_STEPS[current-1])<=o.maxLeap);
      if(Math.random()<o.stepProbability){
        const step=candidates.filter(d=>Math.abs(d-current)<=1&&d!==current);
        if(step.length)candidates=step;
      }
      if(degrees.length>1)candidates=candidates.filter(d=>!(d===current&&d===degrees[degrees.length-2]));
      if(!candidates.length)candidates=allowed;
      current=pick(candidates); degrees.push(current);
    }
    const root=keyRootMidi(o.key,60);
    return { key:o.key,degrees,midi:degrees.map(d=>degreeMidi(root,d)),root };
  }
  function contour(notes){
    const out=[]; for(let i=1;i<notes.length;i++) out.push(notes[i]>notes[i-1]?'↑':notes[i]<notes[i-1]?'↓':'→'); return out;
  }
  function formatTime(seconds){
    if(!isFinite(seconds))return '0:00.0'; const m=Math.floor(seconds/60); const s=(seconds%60).toFixed(1).padStart(4,'0'); return m+':'+s;
  }

  window.MelodyTheory={NOTE_NAMES,NOTE_NAMES_SHARP,MAJOR_STEPS,INTERVALS,KEYS,KEY_PCS,STRINGS,ABILITY_KEYS,clamp,randomInt,pick,midiToFreq,noteName,pcName,degreeMidi,keyRootMidi,intervalById,intervalIdFromSemitones,guitarNote,guitarPositions,generateMelody,contour,formatTime};
})();
