(function () {
  'use strict';
  const T=window.MelodyTheory;

  class AudioEngine {
    constructor(){ this.ctx=null; this.master=null; this.active=[]; this.volume=.72; }
    ensure(){
      if(!this.ctx){
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC)throw new Error('当前浏览器不支持 Web Audio API');
        this.ctx=new AC(); this.master=this.ctx.createGain(); this.master.gain.value=this.volume; this.master.connect(this.ctx.destination);
      }
      if(this.ctx.state==='suspended')this.ctx.resume(); return this.ctx;
    }
    setVolume(v){ this.volume=T.clamp(Number(v),0,1); if(this.master)this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.02); }
    stopAll(){ this.active.forEach(n=>{try{n.stop()}catch(_){}}); this.active=[]; }
    tone(midi,start,duration,opts){
      const ctx=this.ensure(), o=Object.assign({type:'triangle',gain:.23,attack:.018,release:.12},opts||{});
      const osc=ctx.createOscillator(), gain=ctx.createGain(), filter=ctx.createBiquadFilter();
      const t=ctx.currentTime+(start||0), end=t+(duration||.72);
      osc.type=o.type; osc.frequency.setValueAtTime(T.midiToFreq(midi),t);
      filter.type='lowpass'; filter.frequency.value=2600; filter.Q.value=.45;
      gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(Math.max(.001,o.gain),t+o.attack);
      gain.gain.setValueAtTime(o.gain,end); gain.gain.exponentialRampToValueAtTime(.0001,end+o.release);
      osc.connect(filter); filter.connect(gain); gain.connect(this.master); osc.start(t); osc.stop(end+o.release+.03); this.active.push(osc);
      osc.onended=()=>{this.active=this.active.filter(x=>x!==osc)}; return end;
    }
    playNote(midi,duration){ this.stopAll(); this.tone(midi,0,duration||.85); return this.wait((duration||.85)*1000); }
    playSequence(notes,opts){
      this.stopAll(); const o=Object.assign({noteDuration:.5,gap:.12,harmony:false},opts||{}); let end=0;
      if(o.harmony){notes.forEach(m=>{end=Math.max(end,this.tone(m,0,o.noteDuration,{gain:.17}))});}
      else notes.forEach((m,i)=>{const s=i*(o.noteDuration+o.gap);end=this.tone(m,s,o.noteDuration)});
      return this.wait((end-this.ctx.currentTime+.18)*1000);
    }
    playCadence(key){
      this.stopAll(); const root=T.keyRootMidi(key,48), chords=[[0,4,7],[5,9,12],[7,11,14],[0,4,7]]; let end=0;
      chords.forEach((ints,i)=>ints.forEach(st=>{end=Math.max(end,this.tone(root+st,i*.7,.54,{type:'sine',gain:.105}))}));
      return this.wait((end-this.ctx.currentTime+.15)*1000);
    }
    playInterval(root,semitones,direction,form){
      let notes=direction==='down'?[root+semitones,root]:[root,root+semitones];
      if(form==='harmonic')return this.playSequence(notes,{noteDuration:1,harmony:true});
      return this.playSequence(notes,{noteDuration:.68,gap:.2});
    }
    wait(ms){ return new Promise(r=>setTimeout(r,Math.max(0,ms))); }
  }
  window.MelodyAudio=new AudioEngine();
})();
