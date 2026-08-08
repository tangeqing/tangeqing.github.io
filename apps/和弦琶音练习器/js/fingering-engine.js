(function(){
  'use strict'; const M=window.GAT;
  M.Fingering={
    assign(sequence,minFret){
      let base=Math.max(1,minFret);
      return sequence.map((n,i)=>{
        if(n.fret===0) return {...n,finger:0};
        if(i && Math.abs(n.fret-sequence[i-1].fret)>4) base=Math.max(1,n.fret-1);
        const offset=n.fret-base;
        return {...n,finger:Math.max(1,Math.min(4,offset+1))};
      });
    }
  };
})();
