(function () {
  'use strict';
  const M = window.GAT;
  const aliases = {'CB':11,'B#':0,'DB':1,'C#':1,'EB':3,'D#':3,'FB':4,'E#':5,'GB':6,'F#':6,'AB':8,'G#':8,'BB':10,'A#':10};
  M.mod = (n,m=12) => ((n % m) + m) % m;
  M.parseNote = value => {
    const s=String(value).trim().replace('♭','b').replace('♯','#');
    const key=s.toUpperCase();
    if (aliases[key] !== undefined) return aliases[key];
    return M.NOTES_SHARP.map(x=>x.toUpperCase()).indexOf(key);
  };
  M.noteName = (pc, preference='sharp') => (preference==='flat' ? M.NOTES_FLAT : M.NOTES_SHARP)[M.mod(pc)];
  M.noteWithOctave = (midi, preference='sharp') => M.noteName(midi,preference)+(Math.floor(midi/12)-1);
  M.chordTones = (rootPc, chordKey) => {
    const chord=M.CHORDS[chordKey];
    if (!chord) throw new Error('不支持的和弦类型：'+chordKey);
    return chord.intervals.map((interval,i)=>({pitchClass:M.mod(rootPc+interval),interval,degree:chord.degrees[i]}));
  };
  M.formatChord = (rootPc,chordKey,preference='sharp') => M.noteName(rootPc,preference)+(M.CHORDS[chordKey]?.symbol ?? chordKey);
  M.resolveAccidental = (rootValue,setting) => setting==='auto' ? (String(rootValue).includes('b')?'flat':'sharp') : setting;
  M.parseChordSymbol = text => {
    const m=String(text).trim().replace(/♭/g,'b').replace(/♯/g,'#').match(/^([A-Ga-g])([#b]?)(.*)$/);
    if(!m) return null;
    const rootText=m[1].toUpperCase()+m[2];
    const suffix=m[3] || '';
    const normalized=suffix.replace('ø7','m7b5').replace('m7b5','m7b5').replace('°7','dim7').replace(/^m$/,'min').replace(/^$/,'maj').replace('7#9','7s9').replace('7b9','7b9');
    const key=Object.keys(M.CHORDS).find(k=>k===normalized || M.CHORDS[k].symbol.replace('♭','b').replace('♯','#')===suffix);
    const root=M.parseNote(rootText);
    return root>=0 && key ? {root,chordKey:key,rootText} : null;
  };
})();
