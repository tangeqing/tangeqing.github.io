(function () {
  'use strict';
  const M = window.GAT = window.GAT || {};
  M.NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  M.NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  M.TUNINGS = {
    standard:{name:'标准调弦', midi:[64,59,55,50,45,40]},
    dropD:{name:'Drop D', midi:[64,59,55,50,45,38]},
    wholeDown:{name:'全音降调', midi:[62,57,53,48,43,38]},
    halfDown:{name:'半音降调', midi:[63,58,54,49,44,39]}
  };
  M.CHORDS = {
    maj:{name:'大三和弦',category:'三和弦',symbol:'',intervals:[0,4,7],degrees:['1','3','5']},
    min:{name:'小三和弦',category:'三和弦',symbol:'m',intervals:[0,3,7],degrees:['1','♭3','5']},
    dim:{name:'减三和弦',category:'三和弦',symbol:'dim',intervals:[0,3,6],degrees:['1','♭3','♭5']},
    aug:{name:'增三和弦',category:'三和弦',symbol:'aug',intervals:[0,4,8],degrees:['1','3','♯5']},
    sus2:{name:'挂二和弦',category:'挂留和弦',symbol:'sus2',intervals:[0,2,7],degrees:['1','2','5']},
    sus4:{name:'挂四和弦',category:'挂留和弦',symbol:'sus4',intervals:[0,5,7],degrees:['1','4','5']},
    '6':{name:'大六和弦',category:'六和弦',symbol:'6',intervals:[0,4,7,9],degrees:['1','3','5','6']},
    m6:{name:'小六和弦',category:'六和弦',symbol:'m6',intervals:[0,3,7,9],degrees:['1','♭3','5','6']},
    add9:{name:'加九和弦',category:'六和弦',symbol:'add9',intervals:[0,4,7,14],degrees:['1','3','5','9']},
    madd9:{name:'小加九和弦',category:'六和弦',symbol:'madd9',intervals:[0,3,7,14],degrees:['1','♭3','5','9']},
    maj7:{name:'大七和弦',category:'七和弦',symbol:'maj7',intervals:[0,4,7,11],degrees:['1','3','5','7']},
    '7':{name:'属七和弦',category:'七和弦',symbol:'7',intervals:[0,4,7,10],degrees:['1','3','5','♭7']},
    m7:{name:'小七和弦',category:'七和弦',symbol:'m7',intervals:[0,3,7,10],degrees:['1','♭3','5','♭7']},
    mMaj7:{name:'小大七和弦',category:'七和弦',symbol:'mMaj7',intervals:[0,3,7,11],degrees:['1','♭3','5','7']},
    m7b5:{name:'半减七和弦',category:'七和弦',symbol:'m7♭5',intervals:[0,3,6,10],degrees:['1','♭3','♭5','♭7']},
    dim7:{name:'减七和弦',category:'七和弦',symbol:'dim7',intervals:[0,3,6,9],degrees:['1','♭3','♭5','♭♭7']},
    augMaj7:{name:'增大七和弦',category:'七和弦',symbol:'augMaj7',intervals:[0,4,8,11],degrees:['1','3','♯5','7']},
    aug7:{name:'增七和弦',category:'变化属和弦',symbol:'aug7',intervals:[0,4,8,10],degrees:['1','3','♯5','♭7']},
    '7sus4':{name:'七挂四',category:'挂留和弦',symbol:'7sus4',intervals:[0,5,7,10],degrees:['1','4','5','♭7']},
    maj9:{name:'大九和弦',category:'九和弦',symbol:'maj9',intervals:[0,4,7,11,14],degrees:['1','3','5','7','9']},
    '9':{name:'属九和弦',category:'九和弦',symbol:'9',intervals:[0,4,7,10,14],degrees:['1','3','5','♭7','9']},
    m9:{name:'小九和弦',category:'九和弦',symbol:'m9',intervals:[0,3,7,10,14],degrees:['1','♭3','5','♭7','9']},
    '7b9':{name:'属七降九',category:'变化属和弦',symbol:'7♭9',intervals:[0,4,7,10,13],degrees:['1','3','5','♭7','♭9']},
    '7s9':{name:'属七升九',category:'变化属和弦',symbol:'7♯9',intervals:[0,4,7,10,15],degrees:['1','3','5','♭7','♯9']},
    '6/9':{name:'六九和弦',category:'九和弦',symbol:'6/9',intervals:[0,4,7,9,14],degrees:['1','3','5','6','9']},
    'm6/9':{name:'小六九和弦',category:'九和弦',symbol:'m6/9',intervals:[0,3,7,9,14],degrees:['1','♭3','5','6','9']},
    '11':{name:'十一和弦',category:'十一和弦',symbol:'11',intervals:[0,4,7,10,14,17],degrees:['1','3','5','♭7','9','11']},
    m11:{name:'小十一和弦',category:'十一和弦',symbol:'m11',intervals:[0,3,7,10,14,17],degrees:['1','♭3','5','♭7','9','11']},
    '13':{name:'十三和弦',category:'十三和弦',symbol:'13',intervals:[0,4,7,10,14,17,21],degrees:['1','3','5','♭7','9','11','13']},
    m13:{name:'小十三和弦',category:'十三和弦',symbol:'m13',intervals:[0,3,7,10,14,17,21],degrees:['1','♭3','5','♭7','9','11','13']}
  };
  M.CATEGORIES = ['三和弦','挂留和弦','六和弦','七和弦','九和弦','十一和弦','十三和弦','变化属和弦','自定义和弦'];
  M.DEGREE_INTERVALS={'1':0,'♭2':1,'2':2,'♯2':3,'♭3':3,'3':4,'4':5,'♯4':6,'♭5':6,'5':7,'♯5':8,'6':9,'♭7':10,'7':11,'♭9':13,'9':14,'♯9':15,'11':17,'♯11':18,'♭13':20,'13':21};
})();
