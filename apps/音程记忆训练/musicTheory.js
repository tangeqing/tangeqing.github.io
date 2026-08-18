(function (global) {
  "use strict";

  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const NATURAL_PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const ALL_ROOT_SPELLINGS = ["C", "D", "E", "F", "G", "A", "B", "C#", "D#", "F#", "G#", "A#", "Db", "Eb", "Gb", "Ab", "Bb"];

  const INTERVALS = {
    "1": { degree: 1, semitones: 0, name: "纯一度" },
    "b2": { degree: 2, semitones: 1, name: "小二度" },
    "2": { degree: 2, semitones: 2, name: "大二度" },
    "#2": { degree: 2, semitones: 3, name: "增二度" },
    "bb3": { degree: 3, semitones: 2, name: "减三度" },
    "b3": { degree: 3, semitones: 3, name: "小三度" },
    "3": { degree: 3, semitones: 4, name: "大三度" },
    "4": { degree: 4, semitones: 5, name: "纯四度" },
    "#4": { degree: 4, semitones: 6, name: "增四度" },
    "b5": { degree: 5, semitones: 6, name: "减五度" },
    "5": { degree: 5, semitones: 7, name: "纯五度" },
    "#5": { degree: 5, semitones: 8, name: "增五度" },
    "b6": { degree: 6, semitones: 8, name: "小六度" },
    "6": { degree: 6, semitones: 9, name: "大六度" },
    "bb7": { degree: 7, semitones: 9, name: "减七度" },
    "b7": { degree: 7, semitones: 10, name: "小七度" },
    "7": { degree: 7, semitones: 11, name: "大七度" },
    "8": { degree: 8, semitones: 12, name: "纯八度" },
    "b9": { degree: 9, semitones: 13, name: "小九度" },
    "9": { degree: 9, semitones: 14, name: "大九度" },
    "#9": { degree: 9, semitones: 15, name: "增九度" },
    "11": { degree: 11, semitones: 17, name: "纯十一度" },
    "#11": { degree: 11, semitones: 18, name: "增十一度" },
    "b13": { degree: 13, semitones: 20, name: "小十三度" },
    "13": { degree: 13, semitones: 21, name: "大十三度" }
  };

  const CHORDS = {
    major: { label: "Major", suffix: "", formula: ["1", "3", "5"], aliases: ["maj", "major"] },
    minor: { label: "Minor", suffix: "m", formula: ["1", "b3", "5"], aliases: ["m", "min", "minor"] },
    dim: { label: "Dim", suffix: "dim", formula: ["1", "b3", "b5"], aliases: ["dim", "°"] },
    aug: { label: "Aug", suffix: "aug", formula: ["1", "3", "#5"], aliases: ["aug", "+"] },
    sus2: { label: "sus2", suffix: "sus2", formula: ["1", "2", "5"] },
    sus4: { label: "sus4", suffix: "sus4", formula: ["1", "4", "5"] },
    maj7: { label: "maj7", suffix: "maj7", formula: ["1", "3", "5", "7"], aliases: ["maj7", "M7", "△7"] },
    "7": { label: "7", suffix: "7", formula: ["1", "3", "5", "b7"] },
    m7: { label: "m7", suffix: "m7", formula: ["1", "b3", "5", "b7"], aliases: ["m7", "min7"] },
    mMaj7: { label: "m(maj7)", suffix: "m(maj7)", formula: ["1", "b3", "5", "7"], aliases: ["mmaj7", "m(maj7)", "minmaj7"] },
    m7b5: { label: "m7♭5", suffix: "m7♭5", formula: ["1", "b3", "b5", "b7"], aliases: ["m7b5", "ø7"] },
    dim7: { label: "dim7", suffix: "dim7", formula: ["1", "b3", "b5", "bb7"], aliases: ["dim7", "°7"] },
    "6": { label: "6", suffix: "6", formula: ["1", "3", "5", "6"] },
    m6: { label: "m6", suffix: "m6", formula: ["1", "b3", "5", "6"] },
    "6/9": { label: "6/9", suffix: "6/9", formula: ["1", "3", "5", "6", "9"] },
    add9: { label: "add9", suffix: "add9", formula: ["1", "3", "5", "9"] },
    madd9: { label: "m(add9)", suffix: "m(add9)", formula: ["1", "b3", "5", "9"], aliases: ["madd9", "m(add9)"] },
    maj9: { label: "maj9", suffix: "maj9", formula: ["1", "3", "5", "7", "9"], core: ["1", "3", "7", "9"] },
    "9": { label: "9", suffix: "9", formula: ["1", "3", "5", "b7", "9"], core: ["1", "3", "b7", "9"] },
    m9: { label: "m9", suffix: "m9", formula: ["1", "b3", "5", "b7", "9"], core: ["1", "b3", "b7", "9"] },
    maj7s11: { label: "maj7♯11", suffix: "maj7♯11", formula: ["1", "3", "5", "7", "9", "#11"], core: ["1", "3", "7", "#11"], aliases: ["maj7#11"] },
    m11: { label: "m11", suffix: "m11", formula: ["1", "b3", "5", "b7", "9", "11"], core: ["1", "b3", "b7", "11"] },
    "11": { label: "11", suffix: "11", formula: ["1", "3", "5", "b7", "9", "11"], core: ["1", "3", "b7", "11"] },
    "7s11": { label: "7♯11", suffix: "7♯11", formula: ["1", "3", "5", "b7", "9", "#11"], core: ["1", "3", "b7", "#11"], aliases: ["7#11"] },
    maj13: { label: "maj13", suffix: "maj13", formula: ["1", "3", "5", "7", "9", "11", "13"], core: ["1", "3", "7", "13"] },
    m13: { label: "m13", suffix: "m13", formula: ["1", "b3", "5", "b7", "9", "11", "13"], core: ["1", "b3", "b7", "13"] },
    "13": { label: "13", suffix: "13", formula: ["1", "3", "5", "b7", "9", "11", "13"], core: ["1", "3", "b7", "13"] },
    "7b13": { label: "7♭13", suffix: "7♭13", formula: ["1", "3", "5", "b7", "9", "b13"], core: ["1", "3", "b7", "b13"], aliases: ["7b13"] },
    "7b9": { label: "7♭9", suffix: "7♭9", formula: ["1", "3", "5", "b7", "b9"], core: ["1", "3", "b7", "b9"], aliases: ["7b9"] },
    "7s9": { label: "7♯9", suffix: "7♯9", formula: ["1", "3", "5", "b7", "#9"], core: ["1", "3", "b7", "#9"], aliases: ["7#9"] },
    "7b5": { label: "7♭5", suffix: "7♭5", formula: ["1", "3", "b5", "b7"], aliases: ["7b5"] },
    "7s5": { label: "7♯5", suffix: "7♯5", formula: ["1", "3", "#5", "b7"], aliases: ["7#5"] },
    "7alt": { label: "7alt", suffix: "7alt", formula: ["1", "3", "b5", "#5", "b7", "b9", "#9"], core: ["1", "3", "b7", "b9", "#9"] }
  };

  function normalizeAccidentals(value) {
    return String(value || "").trim().replace(/♯/g, "#").replace(/♭/g, "b").replace(/𝄪/g, "##").replace(/𝄫/g, "bb");
  }

  function displayAccidentals(value) {
    return String(value || "").replace(/bb/g, "𝄫").replace(/##/g, "𝄪").replace(/b/g, "♭").replace(/#/g, "♯");
  }

  function parseNote(note) {
    const normalized = normalizeAccidentals(note);
    const match = normalized.match(/^([A-Ga-g])([#bx]*)$/);
    if (!match) return null;
    const letter = match[1].toUpperCase();
    let accidental = 0;
    for (const char of match[2]) accidental += char === "#" || char === "x" ? (char === "x" ? 2 : 1) : -1;
    return { letter, accidental, pitch: mod(NATURAL_PITCH[letter] + accidental, 12), normalized: letter + accidentalText(accidental) };
  }

  function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function accidentalText(offset) {
    if (offset === 0) return "";
    return offset > 0 ? "#".repeat(offset) : "b".repeat(-offset);
  }

  function normalizeInterval(interval) {
    return normalizeAccidentals(interval).replace(/^♮/, "");
  }

  function getIntervalNote(root, interval) {
    const parsedRoot = parseNote(root);
    const token = normalizeInterval(interval);
    const definition = INTERVALS[token];
    if (!parsedRoot || !definition) throw new Error("无法识别音名或音程：" + root + " / " + interval);
    const rootIndex = LETTERS.indexOf(parsedRoot.letter);
    const targetLetter = LETTERS[mod(rootIndex + definition.degree - 1, 7)];
    const targetPitch = mod(parsedRoot.pitch + definition.semitones, 12);
    let accidental = mod(targetPitch - NATURAL_PITCH[targetLetter], 12);
    if (accidental > 6) accidental -= 12;
    return targetLetter + accidentalText(accidental);
  }

  function getChordFormula(chordType, mode) {
    const chord = CHORDS[chordType];
    if (!chord) throw new Error("未知和弦类型：" + chordType);
    return mode === "core" && chord.core ? chord.core.slice() : chord.formula.slice();
  }

  function getChordNotes(root, chordType, mode) {
    return getChordFormula(chordType, mode).map((interval) => getIntervalNote(root, interval));
  }

  function chordName(root, chordType) {
    return displayAccidentals(parseNote(root).normalized + CHORDS[chordType].suffix);
  }

  function sameNote(a, b) {
    const first = parseNote(a);
    const second = parseNote(b);
    return Boolean(first && second && first.normalized === second.normalized);
  }

  function splitNotes(value) {
    return normalizeAccidentals(value).replace(/[，,\-–—/|]+/g, " ").split(/\s+/).filter(Boolean);
  }

  function sameNoteCollection(answer, expected) {
    const actual = splitNotes(answer).map((note) => parseNote(note)).filter(Boolean).map((note) => note.normalized);
    const wanted = expected.map((note) => parseNote(note).normalized);
    return actual.length === wanted.length && actual.slice().sort().join("|") === wanted.slice().sort().join("|");
  }

  function normalizeFormula(value) {
    return normalizeAccidentals(value).replace(/[，,\-–—/|]+/g, " ").split(/\s+/).filter(Boolean);
  }

  function sameFormula(answer, expected) {
    const actual = normalizeFormula(answer);
    return actual.length === expected.length && actual.every((token, index) => token === expected[index]);
  }

  function chordAnswerVariants(root, chordType) {
    const parsed = parseNote(root);
    const chord = CHORDS[chordType];
    if (!parsed || !chord) return [];
    const suffixes = [chord.suffix].concat(chord.aliases || []);
    if (chordType === "major") suffixes.push("");
    return suffixes.map((suffix) => (parsed.normalized + suffix).toLowerCase().replace(/[()]/g, ""));
  }

  function sameChordName(answer, root, chordType) {
    const normalized = normalizeAccidentals(answer).replace(/\s+/g, "").replace(/[()]/g, "").toLowerCase();
    return chordAnswerVariants(root, chordType).includes(normalized);
  }

  function midiFor(note, octave) {
    const parsed = parseNote(note);
    return 12 * ((octave == null ? 4 : octave) + 1) + parsed.pitch;
  }

  function describeInterval(root, interval) {
    const token = normalizeInterval(interval);
    const definition = INTERVALS[token];
    const note = getIntervalNote(root, token);
    const rootLetterIndex = LETTERS.indexOf(parseNote(root).letter);
    const targetLetter = LETTERS[mod(rootLetterIndex + definition.degree - 1, 7)];
    return { note, targetLetter, degree: definition.degree, semitones: definition.semitones, name: definition.name, symbol: token };
  }

  global.MusicTheory = {
    LETTERS, ROOTS, ALL_ROOT_SPELLINGS, INTERVALS, CHORDS,
    normalizeAccidentals, displayAccidentals, parseNote, normalizeInterval,
    getIntervalNote, getChordFormula, getChordNotes, chordName, sameNote,
    splitNotes, sameNoteCollection, normalizeFormula, sameFormula, sameChordName,
    midiFor, describeInterval
  };
})(window);
