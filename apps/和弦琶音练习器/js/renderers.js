(function(){
  'use strict';const M=window.GAT;
  const css=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function setup(canvas,minWidth=700){const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(minWidth,canvas.parentElement.clientWidth-30),h=Number(canvas.getAttribute('height'));if(canvas.width!==w*dpr||canvas.height!==h*dpr){canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return {c,w,h};}
  M.TabRenderer={
    render(canvas,sequence,current=0,beatsPerBar=4,notesPerBeat=2){
      const {c,w,h}=setup(canvas);c.clearRect(0,0,w,h);if(!sequence.length)return;
      const lineTop=94,gap=25,playX=Math.min(260,w*.34),spacing=43,offset=playX-current*spacing;
      c.lineWidth=1;c.strokeStyle=css('--line');c.font='12px system-ui';c.textAlign='right';c.fillStyle=css('--muted');
      ['e','B','G','D','A','E'].forEach((label,i)=>{const y=lineTop+i*gap;c.beginPath();c.moveTo(31,y);c.lineTo(w-18,y);c.stroke();c.fillText(label,23,y+4)});
      c.save();c.beginPath();c.rect(30,42,w-48,h-55);c.clip();
      sequence.forEach((n,i)=>{const x=offset+i*spacing;if(x<-70||x>w+70)return;const y=lineTop+(n.string-1)*gap;
        const newBar=i===0||n.bar!==sequence[i-1].bar;if(newBar){c.strokeStyle=css('--line');c.beginPath();c.moveTo(x-20,70);c.lineTo(x-20,lineTop+5*gap+12);c.stroke();c.textAlign='left';c.fillStyle=i===current?css('--accent'):css('--text');c.font='700 14px system-ui';c.fillText(n.chordName,x-13,55);}
        if(i===current){c.fillStyle=css('--accent');c.beginPath();c.arc(x,y,15,0,Math.PI*2);c.fill();c.fillStyle='#05271d';}
        else if(i===current+1){c.strokeStyle=css('--accent2');c.lineWidth=2;c.beginPath();c.arc(x,y,13,0,Math.PI*2);c.stroke();c.fillStyle=css('--text');}
        else{c.fillStyle=css('--text');}
        c.font='700 13px ui-monospace,monospace';c.textAlign='center';c.fillText(n.fret,x,y+5);
        c.strokeStyle=i===current?css('--accent'):css('--muted');c.lineWidth=i===current?2:1;c.beginPath();c.moveTo(x,y+10);c.lineTo(x,y+29);c.stroke();
        if(notesPerBeat>=2){c.beginPath();c.moveTo(x,y+29);c.lineTo(x+Math.min(18,spacing*.45),y+29);if(notesPerBeat>=4)c.lineTo(x+Math.min(18,spacing*.45),y+34);c.stroke();}
        if(notesPerBeat===3||notesPerBeat===6){c.font='9px system-ui';c.fillStyle=css('--muted');c.fillText('3',x,y+43);}
      });c.restore();
      c.strokeStyle=css('--accent');c.lineWidth=2;c.beginPath();c.moveTo(playX,40);c.lineTo(playX,h-12);c.stroke();c.fillStyle=css('--accent');c.beginPath();c.moveTo(playX-6,39);c.lineTo(playX+6,39);c.lineTo(playX,48);c.closePath();c.fill();
    },
    hitTest(canvas,event,sequence,current){const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*(canvas.width/devicePixelRatio)/r.width,playX=Math.min(260,(canvas.width/devicePixelRatio)*.34),i=Math.round((x-playX)/43+current);return i>=0&&i<sequence.length?i:-1;}
  };
  M.FretboardRenderer={
    render(canvas,{tuning,tones,minFret,maxFret,current,next,previous,displayMode,preference}){
      const frets=Math.max(1,maxFret-minFret+1),{c,w,h}=setup(canvas,Math.max(720,frets*82+80)),left=62,right=20,top=35,gap=(h-70)/5,fw=(w-left-right)/frets;
      c.clearRect(0,0,w,h);const toneMap=new Map(tones.map(t=>[t.pitchClass,t]));
      c.fillStyle=css('--panel');c.fillRect(left,top,w-left-right,gap*5);
      for(let s=0;s<6;s++){const y=top+s*gap;c.strokeStyle=s===0||s===5?css('--muted'):css('--line');c.lineWidth=1+s*.18;c.beginPath();c.moveTo(left,y);c.lineTo(w-right,y);c.stroke();c.fillStyle=css('--muted');c.font='11px system-ui';c.textAlign='right';c.fillText((s+1)+'弦',left-9,y+4);}
      for(let f=minFret;f<=maxFret+1;f++){const x=left+(f-minFret)*fw;c.strokeStyle=css('--line');c.lineWidth=f===0?5:1;c.beginPath();c.moveTo(x,top-10);c.lineTo(x,top+gap*5+10);c.stroke();if(f<=maxFret){c.fillStyle=css('--muted');c.font='10px system-ui';c.textAlign='center';c.fillText(f+'',x+fw/2,h-10);}}
      const markers=[3,5,7,9,12,15,17,19,21,24];markers.filter(f=>f>=minFret&&f<=maxFret).forEach(f=>{const x=left+(f-minFret+.5)*fw,ys=f%12===0?[top+gap*1.6,top+gap*3.4]:[top+gap*2.5];ys.forEach(y=>{c.fillStyle=css('--line');c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill()})});
      for(let string=1;string<=6;string++)for(let fret=minFret;fret<=maxFret;fret++){const midi=tuning[string-1]+fret,tone=toneMap.get(M.mod(midi));if(!tone)continue;const x=left+(fret-minFret+.5)*fw,y=top+(string-1)*gap,isCur=current&&current.string===string&&current.fret===fret,isNext=next&&next.string===string&&next.fret===fret,isPrev=previous&&previous.string===string&&previous.fret===fret;
        if(displayMode==='current'&&!isCur&&!isNext)continue;c.globalAlpha=current&&!isCur&&!isNext ? .28 : 1;c.fillStyle=isCur?css('--accent'):tone.degree==='1'?css('--accent2'):css('--card');c.strokeStyle=isNext?css('--accent2'):isPrev?css('--muted'):tone.degree==='1'?css('--accent2'):css('--line');c.lineWidth=isCur?4:isNext?3:1.5;c.beginPath();c.arc(x,y,isCur?18:14,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=isCur?'#05271d':css('--text');c.font='700 10px system-ui';c.textAlign='center';const label=displayMode==='degree'?tone.degree:displayMode==='note'?M.noteName(midi,preference):M.noteName(midi,preference)+' '+tone.degree;c.fillText(label,x,y+3);c.globalAlpha=1;}
    }
  };
})();
