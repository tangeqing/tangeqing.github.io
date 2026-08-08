(function(){
  'use strict'; const M=window.GAT;
  const baseDegree=d=>String(d).replace(/[♭♯]/g,'').replace('♭♭','');
  function noteCost(a,b,direction){
    if(!a){const firstDirection=Array.isArray(direction)?direction[0]:direction;return b.fret*.12+(firstDirection==='down'?-b.midi*.18:b.midi*.18)}
    const fret=Math.abs(a.fret-b.fret), strings=Math.abs(a.string-b.string), midi=b.midi-a.midi;
    let c=fret*2+strings*2.2+(b.degreePenalty||0);
    if(a.string===b.string)c-=1.2;
    if(midi>0&&b.string>a.string)c+=14;
    if(midi<0&&b.string<a.string)c+=14;
    if(strings===1&&fret<=3)c-=2;
    return c;
  }
  function choosePath(layers,direction,previous,maxFretJump=5){
    let states=layers[0].map(n=>({node:n,cost:noteCost(previous,n,direction),path:[n],sameStringRun:1})).sort((a,b)=>a.cost-b.cost).slice(0,48);
    for(let i=1;i<layers.length;i++){
      const nextByState=new Map();
      const edgeDirection=Array.isArray(direction)?direction[i-1]:direction;
      for(const n of layers[i]) for(const st of states){
        if(edgeDirection==='up'&&n.midi<st.node.midi)continue;
        if(edgeDirection==='down'&&n.midi>st.node.midi)continue;
        if(edgeDirection!=='boundary'&&Math.abs(n.string-st.node.string)>1)continue;
        if(edgeDirection!=='boundary'&&Math.abs(n.fret-st.node.fret)>maxFretJump)continue;
        if(n.midi===st.node.midi&&edgeDirection!=='boundary')continue;
        const run=edgeDirection==='boundary'?1:(n.string===st.node.string?st.sameStringRun+1:1);
        if(run>3)continue;
        const candidate={node:n,cost:st.cost+noteCost(st.node,n,edgeDirection),path:st.path.concat(n),sameStringRun:run},key=`${n.string}:${n.fret}:${run}`,known=nextByState.get(key);if(!known||candidate.cost<known.cost)nextByState.set(key,candidate);
      }
      states=[...nextByState.values()].sort((a,b)=>a.cost-b.cost);
      if(!states.length) break;
    }
    return states[0]?.path || [];
  }
  function degreeOrder(chord,pattern){
    const tokens=pattern.split(/[\s-]+/).filter(Boolean);
    const available=chord.degrees;
    const found=[];
    tokens.forEach(token=>{
      const exact=available.find(d=>d===token), loose=available.find(d=>baseDegree(d)===baseDegree(token));
      if(exact||loose)found.push(exact||loose);
    });
    return found.length?found:available.slice();
  }
  function directionalDegrees(degrees,direction){
    if(direction==='down') return degrees.slice().reverse();
    if(direction==='updown') return degrees.concat(degrees.slice(1,-1).reverse());
    if(direction==='downup'){const d=degrees.slice().reverse();return d.concat(d.slice(1,-1).reverse());}
    return degrees;
  }
  function stringPlan(direction,count,candidates){
    const up=[6,5,4,3,2,1],down=up.slice().reverse();
    if(direction==='up'||direction==='down'){
      if(count>18)throw new Error('纯上行或下行在六弦、每弦最多 3 音的约束下最多生成 18 音，请减少每和弦拍数或改用往返方向。');
      const order=direction==='up'?up:down,per=[1,1,1,1,1,1],capacity=order.map(string=>Math.min(3,candidates.filter(n=>n.string===string).length));for(let i=0;i<count-6;i++){const choices=capacity.map((cap,index)=>({index,room:cap-per[index],startPenalty:index===0?2:0})).filter(x=>x.room>0).sort((a,b)=>(b.room-b.startPenalty)-(a.room-a.startPenalty)||b.index-a.index);if(!choices.length)throw new Error('所选把位没有足够的六弦和弦音，请扩大把位或减少音序长度。');per[choices[0].index]++}
      return order.flatMap((string,i)=>Array(per[i]).fill(string));
    }
    const order=direction==='downup'?down:up,plan=[order[0]];let index=0,step=1;while(plan.length<count){index+=step;if(index===order.length-1)step=-1;else if(index===0)step=1;plan.push(order[index])}return plan;
  }
  M.SequenceEngine={
    generate({chords,tuning,minFret,maxFret,direction,pattern,notesPerBeat,chordBeats,inversion,startDegree}){
      const allLayers=[],allDirections=[],metadata=[];let bar=0;
      chords.forEach((spec,chordIndex)=>{
        const chord=M.CHORDS[spec.chordKey], tones=M.chordTones(spec.root,spec.chordKey);
        const candidates=M.Fretboard.candidates(tuning,tones,minFret,maxFret);
        if(!candidates.length) throw new Error(`${M.formatChord(spec.root,spec.chordKey)} 在 ${minFret}–${maxFret} 品没有可用位置。`);
        let degrees=degreeOrder(chord,pattern);
        const inv=Number(inversion); if(Number.isFinite(inv)&&inv>0) degrees=degrees.slice(inv).concat(degrees.slice(0,inv));
        if(startDegree==='3'||startDegree==='5'||startDegree==='7'||startDegree==='9'){
          const idx=degrees.findIndex(d=>baseDegree(d)===startDegree); if(idx>=0) degrees=degrees.slice(idx).concat(degrees.slice(0,idx));
        }
        let dir=direction; if(direction==='random')dir=Math.random()>.5?'up':'down';if(direction==='alternate')dir=chordIndex%2?'down':'up';
        let ordered=directionalDegrees(degrees,dir);
        const targetCount=Math.round(chordBeats*notesPerBeat),minimum=(dir==='updown'||dir==='downup')?7:6;if(targetCount<minimum)throw new Error(`完整六弦${minimum===7?'往返':''}琶音至少需要 ${minimum} 个节奏位置；请提高音符细分或增加每和弦拍数。`);
        const targets=Array.from({length:targetCount},(_,i)=>ordered[i%ordered.length]);
        const strings=stringPlan(dir,targetCount,candidates),layers=targets.map((degree,i)=>candidates.filter(n=>n.string===strings[i]).map(n=>({...n,degreePenalty:n.degree===degree?0:7})));
        const wantedStart=startDegree==='root'?'1':startDegree==='3'||startDegree==='5'||startDegree==='7'||startDegree==='9'?startDegree:null,exactStart=wantedStart?layers[0].filter(n=>baseDegree(n.degree)===wantedStart):[];if(exactStart.length)layers[0]=exactStart;
        if(startDegree==='lowest'||startDegree==='highest'||startDegree==='random'){const sorted=layers[0].slice().sort((a,b)=>a.midi-b.midi),chosen=startDegree==='lowest'?sorted[0]:startDegree==='highest'?sorted[sorted.length-1]:sorted[Math.floor(Math.random()*sorted.length)];layers[0]=chosen?[chosen]:[]}
        if(layers.some(layer=>!layer.length))throw new Error(`${M.formatChord(spec.root,spec.chordKey)} 在 ${minFret}–${maxFret} 品无法覆盖全部六根弦。`);
        const edgeDirections=strings.slice(1).map((string,i)=>string<strings[i]?'up':string>strings[i]?'down':dir==='down'?'down':'up');
        if(allLayers.length)allDirections.push('boundary');
        layers.forEach((layer,i)=>{allLayers.push(layer);metadata.push({chordIndex,chordName:M.formatChord(spec.root,spec.chordKey,spec.accidental),root:spec.root,chordKey:spec.chordKey,beatInChord:i/notesPerBeat,bar:bar+Math.floor((i/notesPerBeat)/spec.beatsPerBar)})});allDirections.push(...edgeDirections);bar+=Math.max(1,Math.ceil(chordBeats/spec.beatsPerBar));
      });
      let path=choosePath(allLayers,allDirections,null,5);if(path.length!==allLayers.length)path=choosePath(allLayers,allDirections,null,7);if(path.length!==allLayers.length)throw new Error('当前音序在所选把位无法形成完整六弦路径，请扩大把位或更换音序。');
      return M.Fingering.assign(path,minFret).map((n,i)=>({...n,...metadata[i],index:i}));
    }
  };
})();
