(function(){
  'use strict';
  const M=window.GAT;
  M.Fretboard={
    position(tuning,stringNo,fret){
      const open=tuning[stringNo-1];
      const midi=open+fret;
      return {string:stringNo,fret,midi,pitchClass:M.mod(midi)};
    },
    candidates(tuning,tones,minFret,maxFret){
      const byPc=new Map(tones.map(t=>[t.pitchClass,t]));
      const out=[];
      for(let string=1;string<=6;string++) for(let fret=minFret;fret<=maxFret;fret++){
        const p=this.position(tuning,string,fret), tone=byPc.get(p.pitchClass);
        if(tone) out.push({...p,degree:tone.degree,interval:tone.interval});
      }
      return out;
    },
    all(tuning,minFret,maxFret){
      const out=[]; for(let s=1;s<=6;s++) for(let f=minFret;f<=maxFret;f++) out.push(this.position(tuning,s,f)); return out;
    }
  };
})();
