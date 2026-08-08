(function(){
  'use strict'; const M=window.GAT;
  class Transport{
    constructor(callbacks){this.cb=callbacks;this.ctx=null;this.master=null;this.running=false;this.paused=false;this.index=0;this.timer=0;this.raf=0;this.nextTime=0;this.scheduled=[];this.nodes=new Set();this.lastVisual=-1;}
    async ensureAudio(){
      if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('当前浏览器不支持 Web Audio API。');this.ctx=new AC();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);}
      if(this.ctx.state==='suspended')await this.ctx.resume();
    }
    async play(sequence,settings){
      if(this.running&&!this.paused)return;
      await this.ensureAudio(); this.sequence=sequence;this.settings=settings;this.running=true;this.paused=false;this.lastVisual=-1;
      this.nextTime=this.ctx.currentTime+.07;this.scheduled=[];
      if(this.index===0&&this.settings.countIn()){
        const beat=60/Number(this.settings.bpm());for(let i=0;i<this.settings.beatsPerBar();i++)this.scheduleTick(this.nextTime+i*beat,i===0);this.nextTime+=this.settings.beatsPerBar()*beat;
      }
      this.scheduler();this.animate();this.cb.state('playing');
    }
    pause(){if(!this.running)return;this.paused=true;this.running=false;clearTimeout(this.timer);cancelAnimationFrame(this.raf);this.cancelNodes();this.scheduled=[];if(this.lastVisual>=0)this.index=this.lastVisual;this.cb.state('paused');}
    async resume(sequence,settings){if(!this.paused)return this.play(sequence,settings);return this.play(sequence,settings);}
    stop(reset=true){this.running=false;this.paused=false;clearTimeout(this.timer);cancelAnimationFrame(this.raf);this.cancelNodes();this.scheduled=[];if(reset)this.index=0;this.lastVisual=-1;this.cb.visual(this.index);this.cb.state('stopped');}
    cancelNodes(){this.nodes.forEach(n=>{try{n.stop()}catch(_){}});this.nodes.clear();}
    load(sequence){this.sequence=sequence;this.index=0;this.lastVisual=-1;}
    setIndex(i){this.index=Math.max(0,Math.min((this.sequence?.length||1)-1,i));this.lastVisual=-1;this.cb.visual(this.index);}
    secondsPerNote(){const bpm=Number(this.settings.bpm());const npb=Number(this.settings.notesPerBeat());return 60/bpm/npb;}
    scheduler(){
      if(!this.running)return;
      const horizon=this.ctx.currentTime+.13;
      while(this.nextTime<horizon&&this.running){
        if(this.index>=this.sequence.length){if(this.settings.loop())this.index=0;else{this.running=false;setTimeout(()=>this.stop(true),Math.max(0,(this.nextTime-this.ctx.currentTime)*1000));break;}}
        const note=this.sequence[this.index], when=this.nextTime;
        this.scheduleNote(note,when);this.scheduleMetronome(note,when);
        this.scheduled.push({index:this.index,time:when});
        let dur=this.secondsPerNote(); const swing=Number(this.settings.swing()); if(Number(this.settings.notesPerBeat())===2&&swing!==.5)dur*=this.index%2?2*(1-swing):2*swing;
        this.nextTime+=dur;this.index++;
      }
      this.timer=setTimeout(()=>this.scheduler(),25);
    }
    scheduleNote(note,when){
      const osc=this.ctx.createOscillator(),gain=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();
      osc.type='triangle';osc.frequency.value=440*Math.pow(2,(note.midi-69)/12);filter.type='lowpass';filter.frequency.value=1800;
      const volume=Number(this.settings.master())*Number(this.settings.arp());gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*.28),when+.008);gain.gain.exponentialRampToValueAtTime(.0001,when+Number(this.settings.sustain()));
      osc.connect(filter).connect(gain).connect(this.master);osc.start(when);osc.stop(when+Number(this.settings.sustain())+.03);this.nodes.add(osc);osc.onended=()=>this.nodes.delete(osc);
    }
    scheduleMetronome(note,when){
      if(!this.settings.metronome())return;const npb=Number(this.settings.notesPerBeat()),within=note.beatInChord*npb;
      if(Math.abs(within%npb)>.001)return;const beat=Math.floor(note.beatInChord)%this.settings.beatsPerBar();
      this.scheduleTick(when,beat===0);
    }
    scheduleTick(when,accent){
      if(!this.settings.metronome())return;const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type='square';osc.frequency.value=accent?1320:880;
      const vol=Number(this.settings.master())*Number(this.settings.metro());gain.gain.setValueAtTime(Math.max(.0001,vol*.25),when);gain.gain.exponentialRampToValueAtTime(.0001,when+.045);osc.connect(gain).connect(this.master);osc.start(when);osc.stop(when+.05);this.nodes.add(osc);osc.onended=()=>this.nodes.delete(osc);
    }
    animate(){
      if(!this.running)return;const now=this.ctx.currentTime;
      while(this.scheduled.length&&this.scheduled[0].time<=now+.012){const ev=this.scheduled.shift();if(ev.index!==this.lastVisual){this.lastVisual=ev.index;this.cb.visual(ev.index,ev.time);}}
      this.raf=requestAnimationFrame(()=>this.animate());
    }
  }
  M.Transport=Transport;
})();
