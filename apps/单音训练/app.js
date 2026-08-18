"use strict";

// 随机单音练耳：无依赖、仅使用 Web Audio API 与 localStorage。
const STORAGE_KEY = "single-note-ear-trainer.v1";
const NATURAL_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const PITCH_NAMES = ["C", "C♯ / D♭", "D", "D♯ / E♭", "E", "F", "F♯ / G♭", "G", "G♯ / A♭", "A", "A♯ / B♭", "B"];
const SHORT_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const TIMBRE_NAMES = { piano: "钢琴", electric: "电钢琴", sine: "正弦波", guitar: "吉他", marimba: "木琴 / 马林巴", pad: "柔和合成器" };
const RANGE_MAP = { "C2-B2": [36, 47], "C3-B3": [48, 59], "C4-B4": [60, 71], "C5-B5": [72, 83], "C3-B4": [48, 71], "C3-B5": [48, 83] };

const DEFAULT_DATA = {
  settings: {
    mode: "random", rangePreset: "C3-B4", customMin: 48, customMax: 67,
    noteMode: "natural", timbre: "piano", volume: 0.7, duration: 1.5, autoTwice: false
  },
  statistics: { total: 0, correct: 0, wrong: 0 },
  wrongNotes: {},
  noteStatistics: {}
};

let data = loadData();
let session = { total: 0, correct: 0, wrong: 0 };
let currentNote = null;
let recentNotes = [];
let evaluated = false;
let answerRevealed = false;
let wrongFilter = "pending";
let toastTimer = 0;
let audioEngine = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  modeSelect: $("#modeSelect"), rangePreset: $("#rangePreset"), noteModeSelect: $("#noteModeSelect"),
  timbreSelect: $("#timbreSelect"), previewTimbre: $("#previewTimbre"), customRange: $("#customRange"),
  customMin: $("#customMin"), customMax: $("#customMax"), rangeHint: $("#rangeHint"),
  modeLabel: $("#modeLabel"), modeDot: $("#modeDot"), noteOrb: $("#noteOrb"), orbIcon: $("#orbIcon"),
  stageTitle: $("#stageTitle"), stageSubtitle: $("#stageSubtitle"), answerBox: $("#answerBox"),
  answerNote: $("#answerNote"), answerFrequency: $("#answerFrequency"),
  newNoteBtn: $("#newNoteBtn"), repeatBtn: $("#repeatBtn"), answerBtn: $("#answerBtn"), nextBtn: $("#nextBtn"),
  correctBtn: $("#correctBtn"), wrongBtn: $("#wrongBtn"), resetSessionBtn: $("#resetSessionBtn"),
  sessionTotal: $("#sessionTotal"), sessionCorrect: $("#sessionCorrect"), sessionWrong: $("#sessionWrong"),
  sessionRate: $("#sessionRate"), sessionProgress: $("#sessionProgress"), wrongBadge: $("#wrongBadge"),
  pendingCount: $("#pendingCount"), masteredCount: $("#masteredCount"), wrongList: $("#wrongList"),
  startWrongPractice: $("#startWrongPractice"), totalRate: $("#totalRate"), accuracyDonut: $("#accuracyDonut"),
  totalAttempts: $("#totalAttempts"), totalCorrect: $("#totalCorrect"), totalWrong: $("#totalWrong"),
  difficultNotes: $("#difficultNotes"), noteStatsBody: $("#noteStatsBody"), volumeRange: $("#volumeRange"),
  volumeOutput: $("#volumeOutput"), durationSelect: $("#durationSelect"), twiceToggle: $("#twiceToggle"),
  exportBtn: $("#exportBtn"), importBtn: $("#importBtn"), importFile: $("#importFile"),
  clearDataBtn: $("#clearDataBtn"), toast: $("#toast"), feedback: $("#feedback")
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function loadData() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw || typeof raw !== "object") return cloneDefaults();
    return normalizeData(raw);
  } catch (error) {
    console.warn("无法读取本地数据，已使用默认值。", error);
    return cloneDefaults();
  }
}

function normalizeData(raw) {
  const base = cloneDefaults();
  const merged = {
    settings: { ...base.settings, ...(raw.settings || {}) },
    statistics: { ...base.statistics, ...(raw.statistics || {}) },
    wrongNotes: raw.wrongNotes && typeof raw.wrongNotes === "object" ? raw.wrongNotes : {},
    noteStatistics: raw.noteStatistics && typeof raw.noteStatistics === "object" ? raw.noteStatistics : {}
  };
  merged.settings.customMin = clamp(Number(merged.settings.customMin), 36, 83);
  merged.settings.customMax = clamp(Number(merged.settings.customMax), 36, 83);
  merged.settings.volume = clamp(Number(merged.settings.volume), 0, 1);
  merged.settings.duration = [0.5, 1, 1.5, 2, 3].includes(Number(merged.settings.duration)) ? Number(merged.settings.duration) : 1.5;
  ["total", "correct", "wrong"].forEach((key) => merged.statistics[key] = Math.max(0, Number(merged.statistics[key]) || 0));
  return merged;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function frequencyForMidi(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
function octaveForMidi(midi) { return Math.floor(midi / 12) - 1; }
function noteLabel(midi) { return `${PITCH_NAMES[midi % 12]}${octaveForMidi(midi)}`; }
function shortNoteLabel(midi) { return `${SHORT_NAMES[midi % 12]}${octaveForMidi(midi)}`; }
function dateLabel(iso) {
  if (!iso) return "暂无记录";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.activeSources = [];
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("当前浏览器不支持 Web Audio API");
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
    this.master.gain.setTargetAtTime(data.settings.volume * 0.72, this.context.currentTime, 0.01);
  }

  stop() {
    this.activeSources.forEach((source) => { try { source.stop(); } catch (_) { /* 已停止 */ } });
    this.activeSources = [];
  }

  async play(midi, options = {}) {
    await this.ensureContext();
    if (!options.overlay) this.stop();
    const duration = Number(options.duration || data.settings.duration);
    const now = this.context.currentTime + 0.025;
    this.createVoice(midi, data.settings.timbre, now, duration);
    if (options.twice) this.createVoice(midi, data.settings.timbre, now + duration + 0.5, duration);
  }

  createVoice(midi, timbre, start, duration) {
    const frequency = frequencyForMidi(midi);
    const ctx = this.context;
    const output = ctx.createGain();
    output.connect(this.master);

    const osc = (type, ratio, gainValue, detune = 0) => {
      const source = ctx.createOscillator();
      const gain = ctx.createGain();
      source.type = type;
      source.frequency.setValueAtTime(frequency * ratio, start);
      source.detune.setValueAtTime(detune, start);
      gain.gain.setValueAtTime(gainValue, start);
      source.connect(gain).connect(output);
      source.start(start);
      source.stop(start + duration + 1.1);
      this.activeSources.push(source);
      return { source, gain };
    };

    const safeEnd = start + Math.max(0.08, duration);
    output.gain.setValueAtTime(0.0001, start);

    if (timbre === "piano") {
      output.gain.exponentialRampToValueAtTime(0.85, start + 0.012);
      output.gain.exponentialRampToValueAtTime(0.28, start + Math.min(.55, duration * .48));
      output.gain.exponentialRampToValueAtTime(0.0001, safeEnd + .32);
      osc("triangle", 1, .72); osc("sine", 2, .18); osc("sine", 3, .08);
    } else if (timbre === "electric") {
      output.gain.exponentialRampToValueAtTime(.65, start + .02);
      output.gain.exponentialRampToValueAtTime(.18, safeEnd);
      output.gain.exponentialRampToValueAtTime(.0001, safeEnd + .55);
      const fundamental = osc("sine", 1, .72);
      osc("sine", 2, .23, 5); osc("triangle", .5, .12);
      const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
      lfo.frequency.value = 5.2; lfoGain.gain.value = .09;
      lfo.connect(lfoGain).connect(fundamental.gain.gain); lfo.start(start); lfo.stop(safeEnd + .6); this.activeSources.push(lfo);
    } else if (timbre === "sine") {
      output.gain.linearRampToValueAtTime(.72, start + .035);
      output.gain.setValueAtTime(.72, Math.max(start + .04, safeEnd - .08));
      output.gain.exponentialRampToValueAtTime(.0001, safeEnd + .12);
      osc("sine", 1, 1);
    } else if (timbre === "guitar") {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.setValueAtTime(Math.min(5200, frequency * 9), start); filter.Q.value = 1.3;
      output.disconnect(); output.connect(filter).connect(this.master);
      output.gain.exponentialRampToValueAtTime(.9, start + .008);
      output.gain.exponentialRampToValueAtTime(.24, start + Math.min(.38, duration * .45));
      output.gain.exponentialRampToValueAtTime(.0001, safeEnd + .3);
      osc("sawtooth", 1, .34, -4); osc("triangle", 1, .5, 3); osc("sine", 2, .12);
    } else if (timbre === "marimba") {
      output.gain.exponentialRampToValueAtTime(.9, start + .006);
      output.gain.exponentialRampToValueAtTime(.0001, start + Math.min(duration + .1, 1.45));
      osc("sine", 1, .8); osc("sine", 4, .2); osc("sine", 10, .06);
    } else {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 1500; filter.Q.value = .7;
      output.disconnect(); output.connect(filter).connect(this.master);
      output.gain.linearRampToValueAtTime(.4, start + Math.min(.3, duration * .3));
      output.gain.setValueAtTime(.4, Math.max(start + .31, safeEnd - .28));
      output.gain.exponentialRampToValueAtTime(.0001, safeEnd + .55);
      osc("sawtooth", 1, .23, -8); osc("sawtooth", 1, .23, 8); osc("sine", .5, .25);
    }
  }
}

function initNoteSelects() {
  const options = [];
  for (let midi = 36; midi <= 83; midi++) options.push(`<option value="${midi}">${noteLabel(midi)}</option>`);
  els.customMin.innerHTML = options.join("");
  els.customMax.innerHTML = options.join("");
}

function syncControls() {
  const s = data.settings;
  els.modeSelect.value = s.mode;
  els.rangePreset.value = s.rangePreset;
  els.noteModeSelect.value = s.noteMode;
  els.timbreSelect.value = s.timbre;
  els.customMin.value = String(s.customMin);
  els.customMax.value = String(s.customMax);
  els.volumeRange.value = String(Math.round(s.volume * 100));
  els.volumeOutput.value = `${Math.round(s.volume * 100)}%`;
  els.durationSelect.value = String(s.duration);
  els.twiceToggle.checked = Boolean(s.autoTwice);
  els.customRange.classList.toggle("is-hidden", s.rangePreset !== "custom");
  els.noteModeSelect.disabled = s.mode === "natural" || s.mode === "wrong";
  updateModeLabel();
}

function updateModeLabel() {
  const labels = { random: "随机单音", natural: "自然音专项", wrong: "错题专项" };
  els.modeLabel.textContent = labels[data.settings.mode];
}

function getRange() {
  if (data.settings.rangePreset === "custom") return [data.settings.customMin, data.settings.customMax];
  return RANGE_MAP[data.settings.rangePreset] || RANGE_MAP["C3-B4"];
}

function getAvailableNotes() {
  if (data.settings.mode === "wrong") {
    return Object.values(data.wrongNotes).filter((item) => item.status !== "mastered").map((item) => Number(item.midi));
  }
  const [min, max] = getRange();
  if (min > max) return [];
  const naturalOnly = data.settings.mode === "natural" || data.settings.noteMode === "natural";
  const notes = [];
  for (let midi = min; midi <= max; midi++) {
    if (!naturalOnly || NATURAL_PCS.has(midi % 12)) notes.push(midi);
  }
  return notes;
}

function chooseRandomNote() {
  const pool = getAvailableNotes();
  if (!pool.length) return null;

  if (data.settings.mode === "wrong") {
    const candidates = pool.length > 1 ? pool.filter((midi) => midi !== recentNotes.at(-1)) : pool;
    const weighted = [];
    candidates.forEach((midi) => {
      const errors = Number(data.wrongNotes[midi]?.errors) || 1;
      const weight = Math.max(1, Math.min(errors, 12));
      for (let i = 0; i < weight; i++) weighted.push(midi);
    });
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  let candidates = pool.filter((midi) => !recentNotes.slice(-3).includes(midi));
  if (!candidates.length) candidates = pool.filter((midi) => midi !== recentNotes.at(-1));
  if (!candidates.length) candidates = pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

async function playCurrent() {
  if (currentNote === null) return false;
  try {
    audioEngine ||= new AudioEngine();
    pulseOrb();
    await audioEngine.play(currentNote, { twice: data.settings.autoTwice });
    return true;
  } catch (error) {
    showToast(error.message || "音频播放失败，请检查浏览器设置");
    return false;
  }
}

async function createQuestion() {
  const next = chooseRandomNote();
  if (next === null) {
    if (data.settings.mode === "wrong") {
      showToast("待复习错题为空，请先进行随机训练");
      switchTab("wrong");
    } else {
      showToast("自定义音域无效，请检查最低音和最高音");
    }
    return;
  }
  currentNote = next;
  recentNotes.push(next);
  recentNotes = recentNotes.slice(-5);
  evaluated = false;
  answerRevealed = false;
  setStageState("question");
  const played = await playCurrent();
  if (played && currentNote === next && !evaluated) els.answerBtn.disabled = false;
}

function setStageState(state) {
  els.noteOrb.classList.remove("is-correct", "is-wrong");
  els.answerBox.classList.add("is-hidden");
  els.answerBtn.textContent = "◉ 查看答案";

  if (state === "idle") {
    els.orbIcon.textContent = "♪";
    els.stageTitle.textContent = "准备好了吗？";
    els.stageSubtitle.textContent = "播放一个音，把它记在脑中，然后用声音模唱出来。";
    [els.repeatBtn, els.answerBtn, els.nextBtn, els.correctBtn, els.wrongBtn].forEach((button) => button.disabled = true);
  } else if (state === "question") {
    els.orbIcon.textContent = "♪";
    els.stageTitle.textContent = "请模唱这个音";
    els.stageSubtitle.textContent = "先在脑中保持音高，再开口哼唱。音名仍然隐藏。";
    [els.repeatBtn, els.nextBtn].forEach((button) => button.disabled = false);
    [els.correctBtn, els.wrongBtn].forEach((button) => button.disabled = true);
    // 播放成功后才启用答案；查看答案后再由用户自行记录对错。
    els.answerBtn.disabled = true;
  } else if (state === "correct") {
    els.orbIcon.textContent = "✓";
    els.noteOrb.classList.add("is-correct");
    els.stageTitle.textContent = "已记录为正确";
    els.stageSubtitle.textContent = "很好，保持住刚才从听觉到发声的感觉。";
    els.correctBtn.disabled = true; els.wrongBtn.disabled = true; els.answerBtn.disabled = false;
    els.answerBox.classList.toggle("is-hidden", !answerRevealed);
    els.answerBtn.textContent = answerRevealed ? "◉ 隐藏答案" : "◉ 查看答案";
  } else if (state === "wrong") {
    els.orbIcon.textContent = "×";
    els.noteOrb.classList.add("is-wrong");
    els.stageTitle.textContent = "已加入错题本";
    els.stageSubtitle.textContent = "没关系，记住差异，之后可在错题专项中强化。";
    els.correctBtn.disabled = true; els.wrongBtn.disabled = true; els.answerBtn.disabled = false;
    els.answerBox.classList.toggle("is-hidden", !answerRevealed);
    els.answerBtn.textContent = answerRevealed ? "◉ 隐藏答案" : "◉ 查看答案";
  }
}

function pulseOrb() {
  els.noteOrb.classList.remove("is-playing");
  requestAnimationFrame(() => els.noteOrb.classList.add("is-playing"));
  window.setTimeout(() => els.noteOrb.classList.remove("is-playing"), 420);
}

function revealAnswer() {
  if (currentNote === null) return;
  answerRevealed = !answerRevealed;
  els.answerNote.textContent = noteLabel(currentNote);
  els.answerFrequency.textContent = `频率 ${frequencyForMidi(currentNote).toFixed(2)} Hz`;
  els.answerBox.classList.toggle("is-hidden", !answerRevealed);
  els.answerBtn.textContent = answerRevealed ? "◉ 隐藏答案" : "◉ 查看答案";
  if (answerRevealed && !evaluated) {
    els.correctBtn.disabled = false;
    els.wrongBtn.disabled = false;
  }
}

function judge(isCorrect) {
  if (currentNote === null || evaluated || !answerRevealed) return;
  evaluated = true;
  const key = String(currentNote);
  const now = new Date().toISOString();
  session.total += 1;
  data.statistics.total += 1;
  const noteStat = data.noteStatistics[key] || { midi: currentNote, attempts: 0, correct: 0, wrong: 0, lastAt: now };
  noteStat.attempts += 1;
  noteStat.lastAt = now;

  if (isCorrect) {
    session.correct += 1;
    data.statistics.correct += 1;
    noteStat.correct += 1;
    if (data.wrongNotes[key] && data.wrongNotes[key].status !== "mastered") {
      data.wrongNotes[key].correctStreak = (Number(data.wrongNotes[key].correctStreak) || 0) + 1;
      data.wrongNotes[key].lastPracticed = now;
      if (data.wrongNotes[key].correctStreak >= 3) {
        data.wrongNotes[key].status = "mastered";
        data.wrongNotes[key].masteredAt = now;
        showToast(`${shortNoteLabel(currentNote)} 连续答对 3 次，已标记为掌握`);
      }
    }
    setStageState("correct");
    showFeedback(true);
  } else {
    session.wrong += 1;
    data.statistics.wrong += 1;
    noteStat.wrong += 1;
    const existing = data.wrongNotes[key] || { midi: currentNote, errors: 0, correctStreak: 0, status: "pending", firstWrong: now };
    existing.errors = (Number(existing.errors) || 0) + 1;
    existing.correctStreak = 0;
    existing.status = "pending";
    existing.lastWrong = now;
    existing.lastTimbre = data.settings.timbre;
    existing.frequency = frequencyForMidi(currentNote);
    data.wrongNotes[key] = existing;
    setStageState("wrong");
    showFeedback(false);
    showToast("已加入错题本");
  }
  data.noteStatistics[key] = noteStat;
  saveData();
  renderAllData();
}

function showFeedback(correct) {
  els.feedback.textContent = correct ? "✓" : "×";
  els.feedback.classList.toggle("wrong", !correct);
  els.feedback.classList.remove("show");
  requestAnimationFrame(() => els.feedback.classList.add("show"));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2300);
}

function renderSession() {
  els.sessionTotal.textContent = session.total;
  els.sessionCorrect.textContent = session.correct;
  els.sessionWrong.textContent = session.wrong;
  const rate = session.total ? Math.round(session.correct / session.total * 100) : null;
  els.sessionRate.textContent = rate === null ? "—" : `${rate}%`;
  els.sessionProgress.style.width = `${rate || 0}%`;
}

function renderWrongBook() {
  const items = Object.values(data.wrongNotes);
  const pending = items.filter((item) => item.status !== "mastered");
  const mastered = items.filter((item) => item.status === "mastered");
  els.pendingCount.textContent = pending.length;
  els.masteredCount.textContent = mastered.length;
  els.wrongBadge.textContent = pending.length;
  els.wrongBadge.style.display = pending.length ? "inline-grid" : "none";
  els.startWrongPractice.disabled = pending.length === 0;

  const visible = (wrongFilter === "pending" ? pending : mastered).sort((a, b) => {
    if (wrongFilter === "pending") return (b.errors || 0) - (a.errors || 0);
    return new Date(b.masteredAt || 0) - new Date(a.masteredAt || 0);
  });

  if (!visible.length) {
    els.wrongList.innerHTML = `<div class="empty-state"><span class="empty-icon">${wrongFilter === "pending" ? "◎" : "✓"}</span><strong>${wrongFilter === "pending" ? "目前没有待复习的音" : "还没有已掌握的音"}</strong><span>${wrongFilter === "pending" ? "练习中点“哼错了”的音会出现在这里。" : "错题连续答对 3 次后会移到这里。"}</span></div>`;
    return;
  }

  els.wrongList.innerHTML = visible.map((item) => {
    const streak = clamp(Number(item.correctStreak) || 0, 0, 3);
    const midi = Number(item.midi);
    return `<article class="wrong-item">
      <div class="wrong-note">${escapeHtml(shortNoteLabel(midi))}<small>${frequencyForMidi(midi).toFixed(2)} Hz</small></div>
      <div class="wrong-meta">
        <span><strong>错误 ${Number(item.errors) || 0} 次</strong></span>
        <span>最近：${escapeHtml(dateLabel(item.lastWrong || item.masteredAt))}</span>
        <span>音色：${escapeHtml(TIMBRE_NAMES[item.lastTimbre] || "—")}</span>
        <span>连对 <span class="streak" aria-label="连续答对 ${streak} 次">${[1,2,3].map((n) => `<i class="${n <= streak ? "on" : ""}"></i>`).join("")}</span></span>
      </div>
      <div class="item-actions">
        <button class="mini-button" data-action="preview" data-midi="${midi}" type="button">试听</button>
        <button class="mini-button" data-action="${wrongFilter === "pending" ? "reset" : "restore"}" data-midi="${midi}" type="button">${wrongFilter === "pending" ? "重置连对" : "恢复练习"}</button>
        <button class="mini-button delete" data-action="delete" data-midi="${midi}" type="button">删除</button>
      </div>
    </article>`;
  }).join("");
}

function renderStatistics() {
  const s = data.statistics;
  const rate = s.total ? Math.round(s.correct / s.total * 100) : 0;
  els.totalAttempts.textContent = s.total;
  els.totalCorrect.textContent = s.correct;
  els.totalWrong.textContent = s.wrong;
  els.totalRate.textContent = s.total ? `${rate}%` : "—";
  els.accuracyDonut.style.background = `conic-gradient(var(--primary) ${rate}%, #e9e5ef ${rate}%)`;

  const noteStats = Object.values(data.noteStatistics).sort((a, b) => (b.wrong || 0) - (a.wrong || 0));
  const difficult = noteStats.filter((item) => item.wrong > 0).slice(0, 5);
  if (!difficult.length) {
    els.difficultNotes.innerHTML = `<div class="empty-state" style="padding:30px 15px"><span>还没有错误记录</span></div>`;
  } else {
    const maxWrong = Math.max(...difficult.map((item) => item.wrong));
    els.difficultNotes.innerHTML = difficult.map((item, index) => `<div class="difficulty-row">
      <span class="rank">${index + 1}</span><span class="note">${escapeHtml(shortNoteLabel(Number(item.midi)))}</span>
      <span class="difficulty-bar"><i style="width:${Math.round(item.wrong / maxWrong * 100)}%"></i></span>
      <span class="count">错 ${item.wrong} 次</span>
    </div>`).join("");
  }

  const all = [...noteStats].sort((a, b) => Number(a.midi) - Number(b.midi));
  els.noteStatsBody.innerHTML = all.length ? all.map((item) => {
    const itemRate = item.attempts ? Math.round(item.correct / item.attempts * 100) : 0;
    return `<tr><td>${escapeHtml(noteLabel(Number(item.midi)))}</td><td>${item.attempts}</td><td>${item.correct}</td><td>${item.wrong}</td><td>${itemRate}%</td></tr>`;
  }).join("") : `<tr><td class="table-empty" colspan="5">完成至少一题后，这里会显示详细统计。</td></tr>`;
}

function renderAllData() {
  renderSession();
  renderWrongBook();
  renderStatistics();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function switchTab(name) {
  $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  $$(".panel").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === name));
  if (name === "wrong") renderWrongBook();
  if (name === "stats") renderStatistics();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function onSettingChange(key, value) {
  data.settings[key] = value;
  saveData();
  syncControls();
  if (["mode", "rangePreset", "customMin", "customMax", "noteMode"].includes(key)) {
    currentNote = null;
    recentNotes = [];
    evaluated = false;
    setStageState("idle");
  }
}

function validateCustomRange(changedKey) {
  let min = Number(els.customMin.value);
  let max = Number(els.customMax.value);
  if (min > max) {
    if (changedKey === "customMin") max = min;
    else min = max;
    els.rangeHint.textContent = "已自动调整另一端，确保最低音不高于最高音。";
    window.setTimeout(() => els.rangeHint.textContent = "", 2500);
  }
  data.settings.customMin = min;
  data.settings.customMax = max;
  saveData(); syncControls(); currentNote = null; recentNotes = []; setStageState("idle");
}

function startWrongPractice() {
  const pending = Object.values(data.wrongNotes).filter((item) => item.status !== "mastered");
  if (!pending.length) { showToast("目前没有待复习错题"); return; }
  data.settings.mode = "wrong";
  saveData(); syncControls(); switchTab("train");
  currentNote = null; recentNotes = []; setStageState("idle");
  createQuestion();
}

function handleWrongListClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const midi = Number(button.dataset.midi);
  const item = data.wrongNotes[String(midi)];
  if (!item) return;
  const action = button.dataset.action;
  if (action === "preview") {
    audioEngine ||= new AudioEngine();
    audioEngine.play(midi, { twice: false }).catch((error) => showToast(error.message));
  } else if (action === "reset") {
    item.correctStreak = 0;
    showToast("连续答对次数已重置");
  } else if (action === "restore") {
    item.status = "pending"; item.correctStreak = 0; delete item.masteredAt;
    showToast("已恢复到待复习");
  } else if (action === "delete") {
    if (!window.confirm(`确定从错题本删除 ${shortNoteLabel(midi)} 吗？累计统计不会受影响。`)) return;
    delete data.wrongNotes[String(midi)];
    showToast("已从错题本删除");
  }
  saveData(); renderAllData();
}

function exportData() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), ...data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `单音练耳数据-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("训练数据已导出");
}

async function importData(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed.settings || !parsed.statistics || !parsed.wrongNotes || !parsed.noteStatistics) throw new Error("文件缺少必要字段");
    if (!window.confirm("导入会覆盖当前浏览器中的训练数据，确定继续吗？")) return;
    data = normalizeData(parsed);
    session = { total: 0, correct: 0, wrong: 0 };
    currentNote = null; recentNotes = []; evaluated = false;
    saveData(); syncControls(); setStageState("idle"); renderAllData();
    showToast("训练数据导入成功");
  } catch (error) {
    showToast(`导入失败：${error.message}`);
  } finally {
    els.importFile.value = "";
  }
}

function clearAllData() {
  if (!window.confirm("确定清空全部训练数据吗？此操作会删除设置、统计和错题本，且无法撤销。")) return;
  if (!window.confirm("请再次确认：真的要永久清空全部本地数据吗？")) return;
  localStorage.removeItem(STORAGE_KEY);
  data = cloneDefaults();
  session = { total: 0, correct: 0, wrong: 0 };
  currentNote = null; recentNotes = []; evaluated = false;
  saveData(); syncControls(); setStageState("idle"); renderAllData();
  showToast("全部训练数据已清空");
}

function attachEvents() {
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  $$(".segment").forEach((segment) => segment.addEventListener("click", () => {
    wrongFilter = segment.dataset.wrongFilter;
    $$(".segment").forEach((item) => item.classList.toggle("is-active", item === segment));
    renderWrongBook();
  }));

  els.modeSelect.addEventListener("change", (event) => onSettingChange("mode", event.target.value));
  els.rangePreset.addEventListener("change", (event) => onSettingChange("rangePreset", event.target.value));
  els.noteModeSelect.addEventListener("change", (event) => onSettingChange("noteMode", event.target.value));
  els.timbreSelect.addEventListener("change", (event) => onSettingChange("timbre", event.target.value));
  els.customMin.addEventListener("change", () => validateCustomRange("customMin"));
  els.customMax.addEventListener("change", () => validateCustomRange("customMax"));

  els.previewTimbre.addEventListener("click", async () => {
    audioEngine ||= new AudioEngine();
    try { await audioEngine.play(60, { duration: 1.2, twice: false }); showToast(`正在试听：${TIMBRE_NAMES[data.settings.timbre]}`); }
    catch (error) { showToast(error.message); }
  });
  els.newNoteBtn.addEventListener("click", createQuestion);
  els.repeatBtn.addEventListener("click", playCurrent);
  els.answerBtn.addEventListener("click", revealAnswer);
  els.nextBtn.addEventListener("click", createQuestion);
  els.correctBtn.addEventListener("click", () => judge(true));
  els.wrongBtn.addEventListener("click", () => judge(false));
  els.resetSessionBtn.addEventListener("click", () => { session = { total: 0, correct: 0, wrong: 0 }; renderSession(); showToast("本轮统计已重新开始"); });
  els.startWrongPractice.addEventListener("click", startWrongPractice);
  els.wrongList.addEventListener("click", handleWrongListClick);

  els.volumeRange.addEventListener("input", (event) => {
    data.settings.volume = Number(event.target.value) / 100;
    els.volumeOutput.value = `${event.target.value}%`;
    if (audioEngine?.master && audioEngine.context) audioEngine.master.gain.setTargetAtTime(data.settings.volume * .72, audioEngine.context.currentTime, .01);
    saveData();
  });
  els.durationSelect.addEventListener("change", (event) => onSettingChange("duration", Number(event.target.value)));
  els.twiceToggle.addEventListener("change", (event) => onSettingChange("autoTwice", event.target.checked));
  els.exportBtn.addEventListener("click", exportData);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", (event) => importData(event.target.files[0]));
  els.clearDataBtn.addEventListener("click", clearAllData);

  document.addEventListener("keydown", (event) => {
    const tag = event.target.tagName;
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) return;
    if (event.code === "Space") { event.preventDefault(); if (!els.repeatBtn.disabled) playCurrent(); }
    else if (event.key === "ArrowRight") { event.preventDefault(); if (!els.nextBtn.disabled) createQuestion(); }
    else if (event.key === "1" && !els.correctBtn.disabled) judge(true);
    else if (event.key === "2" && !els.wrongBtn.disabled) judge(false);
  });
}

function init() {
  initNoteSelects();
  syncControls();
  setStageState("idle");
  renderAllData();
  attachEvents();
}

init();
