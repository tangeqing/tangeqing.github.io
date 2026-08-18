(function () {
  "use strict";

  const MT = window.MusicTheory;
  const Store = window.TrainerStore;
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const importFile = document.getElementById("importFile");

  const LEVEL_INTERVALS = {
    1: ["b3", "3", "4", "5"],
    2: ["b3", "3", "4", "5", "b7", "7", "2", "6"],
    3: ["b2", "2", "b3", "3", "4", "#4", "b5", "5", "b6", "6", "b7", "7", "8", "9", "11", "13"],
    4: ["b2", "2", "b3", "3", "4", "#4", "b5", "5", "#5", "b6", "6", "b7", "7", "b9", "9", "#9", "11", "#11", "b13", "13"]
  };
  const INTERVAL_OPTIONS = ["b2", "2", "b3", "3", "4", "#4", "b5", "5", "#5", "b6", "6", "b7", "7", "8", "b9", "9", "#9", "11", "#11", "b13", "13"];
  const ROOT_PRESETS = {
    natural: ["C", "D", "E", "F", "G", "A", "B"],
    sharp: ["C#", "D#", "F#", "G#", "A#"],
    flat: ["Db", "Eb", "Gb", "Ab", "Bb"],
    twelve: MT.ROOTS.slice(),
    default: ["D", "E", "F", "G", "A", "B"]
  };
  const CHORD_GROUPS = [
    { title: "三和弦", keys: ["major", "minor", "dim", "aug", "sus2", "sus4"] },
    { title: "七 / 六和弦", keys: ["maj7", "7", "m7", "mMaj7", "m7b5", "dim7", "6", "m6", "6/9"] },
    { title: "扩展和弦", keys: ["add9", "madd9", "maj9", "9", "m9", "maj7s11", "m11", "11", "7s11", "maj13", "m13", "13", "7b13"] },
    { title: "Altered", keys: ["7b9", "7s9", "7b5", "7s5", "7alt"] }
  ];

  const state = {
    tab: "interval",
    question: null,
    answered: false,
    feedback: null,
    startedAt: 0,
    timerId: null,
    reviewMode: false,
    session: freshSession(),
    delayed: []
  };

  function freshSession() {
    return { answered: 0, correct: 0, totalMs: 0, active: true };
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function display(value) {
    return MT.displayAccidentals(value);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    Store.data.settings.theme = theme;
    Store.save();
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function weightedChoice(items, weightFn) {
    if (!items.length) return null;
    const weights = items.map((item) => Math.max(0.01, Number(weightFn(item)) || 1));
    let cursor = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let index = 0; index < items.length; index += 1) {
      cursor -= weights[index];
      if (cursor <= 0) return items[index];
    }
    return items[items.length - 1];
  }

  function selectedRoots() {
    const configured = Store.data.settings.roots.length ? Store.data.settings.roots : ROOT_PRESETS.default;
    const active = Store.data.settings.cWeight === 0 ? configured.filter((root) => root !== "C") : configured;
    return active.length ? active : ROOT_PRESETS.default;
  }

  function selectedIntervals() {
    return Store.data.settings.intervals.length ? Store.data.settings.intervals : LEVEL_INTERVALS[1];
  }

  function selectedChords() {
    return Store.data.settings.chords.length ? Store.data.settings.chords : ["major", "minor", "maj7", "m7", "7"];
  }

  function pairChoice(family) {
    const roots = selectedRoots();
    const focuses = family === "interval" ? selectedIntervals() : selectedChords();
    const pairs = [];
    roots.forEach((root) => focuses.forEach((focus) => pairs.push({ root, focus })));
    return weightedChoice(pairs, (pair) => Store.weightFor(`${family}|${pair.root}|${pair.focus}`, pair.root));
  }

  function createIntervalQuestion(descriptor) {
    const pair = descriptor || pairChoice("interval");
    const root = pair.root;
    const interval = pair.focus;
    const mode = pair.mode || Store.data.settings.intervalMode;
    const info = MT.describeInterval(root, interval);
    const rootD = display(root);
    const intervalD = display(interval);
    const noteD = display(info.note);
    const common = {
      family: "interval", root, focus: interval, mode,
      knowledgeKey: `interval|${root}|${interval}`,
      signature: `interval|${mode}|${root}|${interval}`,
      expected: info.note,
      answerLabel: "输入目标音名",
      placeholder: "例如 F# 或 B♭",
      info
    };
    if (mode === "forward") return { ...common, kindLabel: "正向问答", context: `${rootD} 的${info.name}是什么？`, main: rootD, sub: `${info.name} = ?` };
    if (mode === "reverse") return { ...common, kindLabel: "反向识别", context: "判断两个音之间的音程", main: `${rootD} → ${noteD}`, sub: "这是什么音程？", answerLabel: "输入音程名称或符号", placeholder: `例如 ${intervalD} 或 ${info.name}`, expected: interval };
    if (mode === "rapid") return { ...common, kindLabel: "快速反应", context: "看到就答，不要慢慢计算", main: rootD, sub: `${intervalD} = ?` };
    return { ...common, kindLabel: "符号问答", context: `${rootD} + ${intervalD}`, main: rootD, sub: `${intervalD} = ?` };
  }

  function createChordQuestion(descriptor) {
    const pair = descriptor || pairChoice("chord");
    const root = pair.root;
    const chordType = pair.focus;
    const mode = pair.mode || Store.data.settings.chordMode;
    const voicing = pair.voicing || Store.data.settings.chordVoicing;
    const formula = MT.getChordFormula(chordType, voicing);
    const notes = MT.getChordNotes(root, chordType, voicing);
    const name = MT.chordName(root, chordType);
    const common = {
      family: "chord", root, focus: chordType, mode, voicing, formula, notes, name,
      knowledgeKey: `chord|${root}|${chordType}`,
      signature: `chord|${mode}|${voicing}|${root}|${chordType}`
    };
    if (mode === "identify") return { ...common, kindLabel: "和弦识别", context: "根据组成音识别和弦", main: notes.map(display).join("  "), sub: "这是什么和弦？", expected: name, answerLabel: "输入和弦名称", placeholder: "例如 Dm7" };
    if (mode === "complete") {
      const missingIndexes = notes.length <= 3 ? [1] : [1, notes.length - 1];
      const masked = notes.map((note, index) => missingIndexes.includes(index) ? "?" : display(note));
      return { ...common, kindLabel: "补全组成音", context: name, main: masked.join("  –  "), sub: "补全缺少的音", expected: missingIndexes.map((index) => notes[index]), missingIndexes, answerLabel: "按顺序输入缺少的音", placeholder: "例如 F C" };
    }
    if (mode === "formulaNotes") return { ...common, kindLabel: "公式 → 音名", context: `根音：${display(root)}`, main: formula.map(display).join("  "), sub: "转换为实际音名", expected: notes, answerLabel: "输入全部组成音", placeholder: "空格、逗号或连字符分隔" };
    if (mode === "chordFormula") return { ...common, kindLabel: "和弦 → 公式", context: "写出结构，而不是手型", main: name, sub: "它的公式是？", expected: formula, answerLabel: "输入音程公式", placeholder: "例如 1 b3 5 b7" };
    return { ...common, kindLabel: "和弦 → 组成音", context: voicing === "core" ? "核心结构音模式" : "理论完整组成音", main: name, sub: "由哪些音组成？", expected: notes, answerLabel: "输入全部组成音", placeholder: "例如 D F A C" };
  }

  function createQuestion(descriptor) {
    if (descriptor) return descriptor.family === "interval" ? createIntervalQuestion(descriptor) : createChordQuestion(descriptor);
    if (state.tab === "interval") return createIntervalQuestion();
    if (state.tab === "chord") return createChordQuestion();
    if (state.tab === "mixed") {
      if (Math.random() < 0.48) {
        const modes = ["symbol", "forward", "reverse"];
        const pair = pairChoice("interval");
        return createIntervalQuestion({ ...pair, mode: modes[randomInt(0, modes.length - 1)] });
      }
      const modes = ["notes", "identify", "formulaNotes", "chordFormula", "complete"];
      const pair = pairChoice("chord");
      return createChordQuestion({ ...pair, mode: modes[randomInt(0, modes.length - 1)] });
    }
    return createIntervalQuestion();
  }

  function questionDescriptor(question) {
    return { family: question.family, root: question.root, focus: question.focus, mode: question.mode, voicing: question.voicing };
  }

  function nextQuestion() {
    const limit = Number(Store.data.settings.sessionLength);
    if (limit > 0 && state.session.answered >= limit) {
      endSession(true);
      return;
    }
    const dueIndex = state.delayed.findIndex((item) => item.dueAt <= state.session.answered);
    let descriptor = null;
    if (dueIndex >= 0) descriptor = state.delayed.splice(dueIndex, 1)[0].descriptor;
    if (state.reviewMode && !descriptor) {
      const reviewItems = Object.values(Store.data.review);
      if (reviewItems.length) {
        const item = reviewItems[randomInt(0, reviewItems.length - 1)];
        descriptor = { family: item.family, root: item.root, focus: item.focus, mode: item.mode, voicing: item.voicing };
      }
    }
    state.question = createQuestion(descriptor);
    state.answered = false;
    state.feedback = null;
    state.startedAt = performance.now();
    renderTraining();
    startTimer();
  }

  function startTimer() {
    clearInterval(state.timerId);
    state.timerId = setInterval(updateTimer, 100);
    updateTimer();
  }

  function updateTimer() {
    const timer = document.getElementById("questionTimer");
    if (!timer || state.answered || !state.startedAt) return;
    const seconds = (performance.now() - state.startedAt) / 1000;
    timer.textContent = `${seconds.toFixed(1)} s`;
    timer.classList.toggle("slow", seconds > Number(Store.data.settings.targetTime));
  }

  function normalizeIntervalAnswer(value) {
    const normalized = MT.normalizeInterval(value).replace(/\s+/g, "");
    return normalized;
  }

  function validateAnswer(question, answer) {
    if (question.family === "interval") {
      if (question.mode === "reverse") {
        const token = normalizeIntervalAnswer(answer);
        const correct = token === question.focus || String(answer).trim() === question.info.name || String(answer).trim().replace(/\s+/g, "") === question.info.name;
        return { correct, normalized: answer.trim() };
      }
      return { correct: MT.sameNote(answer, question.expected), normalized: answer.trim() };
    }
    if (question.mode === "identify") return { correct: MT.sameChordName(answer, question.root, question.focus), normalized: answer.trim() };
    if (question.mode === "chordFormula") return { correct: MT.sameFormula(answer, question.expected), normalized: answer.trim() };
    return { correct: MT.sameNoteCollection(answer, question.expected), normalized: answer.trim() };
  }

  function submitAnswer(options) {
    if (!state.question || state.answered) { nextQuestion(); return; }
    const input = document.getElementById("answerInput");
    const answer = options && options.reveal ? "" : (input ? input.value : "");
    if (!answer.trim() && !(options && (options.reveal || options.skip))) {
      showToast("请先输入答案");
      if (input) input.focus();
      return;
    }
    clearInterval(state.timerId);
    const elapsedMs = Math.round(performance.now() - state.startedAt);
    const checked = options && (options.reveal || options.skip) ? { correct: false, normalized: options.skip ? "（跳过）" : "（查看答案）" } : validateAnswer(state.question, answer);
    const slow = checked.correct && elapsedMs > Number(Store.data.settings.targetTime) * 1000;
    const question = state.question;
    const reviewData = { ...questionDescriptor(question), signature: question.signature, title: questionTitle(question), correctAnswer: expectedText(question) };
    Store.record({
      family: question.family, kind: question.kindLabel, root: question.root, focus: question.focus,
      knowledgeKey: question.knowledgeKey, signature: question.signature, userAnswer: checked.normalized,
      correctAnswer: expectedText(question), correct: checked.correct, slow, elapsedMs, reviewData
    });
    state.session.answered += 1;
    state.session.correct += checked.correct ? 1 : 0;
    state.session.totalMs += elapsedMs;
    if (!checked.correct) {
      const priorFailures = Store.data.review[question.signature]?.errors || 1;
      state.delayed.push({ dueAt: state.session.answered + randomInt(priorFailures > 1 ? 2 : 3, priorFailures > 1 ? 3 : 5), descriptor: questionDescriptor(question) });
    }
    state.answered = true;
    state.feedback = { correct: checked.correct, slow, elapsedMs, userAnswer: checked.normalized };
    renderTraining();
  }

  function expectedText(question) {
    if (Array.isArray(question.expected)) return question.expected.map(display).join(" ");
    if (question.mode === "reverse") return `${display(question.focus)}（${question.info.name}）`;
    return display(question.expected);
  }

  function questionTitle(question) {
    if (question.family === "interval") return `${display(question.root)} + ${display(question.focus)}`;
    return question.name;
  }

  function unique(values) {
    return Array.from(new Set(values));
  }

  function noteChoiceValues(question) {
    const chromatic = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    const spellings = question.family === "chord"
      ? (question.notes || [])
      : (question.mode === "reverse" ? [] : [question.expected]);
    const replacements = new Map();
    spellings.forEach((note) => {
      const parsed = MT.parseNote(note);
      if (parsed) replacements.set(parsed.pitch, parsed.normalized);
    });
    return chromatic.map((note) => {
      const parsed = MT.parseNote(note);
      return replacements.get(parsed.pitch) || note;
    });
  }

  function intervalChoiceValues(question) {
    if (question.mode === "chordFormula") {
      const fromSelectedChords = selectedChords().flatMap((type) => MT.getChordFormula(type, question.voicing));
      return unique(["1", ...question.formula, ...fromSelectedChords]);
    }
    const common = ["b2", "2", "b3", "3", "4", "#4", "b5", "5", "b6", "6", "b7", "7", "8", "9", "11", "13"];
    return unique([question.focus, ...selectedIntervals(), ...common]);
  }

  function chordChoiceValues(question) {
    const available = unique([question.focus, ...selectedChords(), "major", "minor", "maj7", "7", "m7", "m7b5", "dim7", "maj9", "9", "m9"]);
    return available
      .sort((a, b) => Math.abs(MT.getChordFormula(a, question.voicing).length - question.formula.length) - Math.abs(MT.getChordFormula(b, question.voicing).length - question.formula.length))
      .slice(0, 12)
      .map((type) => ({ value: MT.chordName(question.root, type), label: MT.chordName(question.root, type) }));
  }

  function choicePanelHtml(question) {
    let choices;
    let single = false;
    let type = "note";
    if (question.family === "interval" && question.mode === "reverse") {
      choices = intervalChoiceValues(question).map((value) => ({ value, label: display(value) }));
      single = true;
      type = "interval";
    } else if (question.family === "chord" && question.mode === "identify") {
      choices = chordChoiceValues(question);
      single = true;
      type = "chord";
    } else if (question.family === "chord" && question.mode === "chordFormula") {
      choices = intervalChoiceValues(question).map((value) => ({ value, label: display(value) }));
      type = "formula";
    } else {
      choices = noteChoiceValues(question).map((value) => ({ value, label: display(value) }));
      single = question.family === "interval";
    }
    const helper = single ? "点击一个选项后自动提交" : "按答案顺序点选；再次点击可取消";
    return `<div class="choice-panel" data-choice-type="${type}">
      <div class="choice-head"><span>${single ? "直接选择答案" : "点选组成答案"}</span><small>${helper}</small></div>
      <div class="choice-grid choice-${type}">${choices.map((choice, index) => `<button class="answer-choice" type="button" data-choice="${esc(choice.value)}" data-single="${single}" data-choice-index="${index + 1}" ${state.answered ? "disabled" : ""}><span>${esc(choice.label)}</span>${index < 9 ? `<kbd>${index + 1}</kbd>` : ""}</button>`).join("")}</div>
      ${single ? "" : '<div class="selection-tools"><span id="selectionStatus">尚未选择</span><button class="ghost-button" type="button" data-action="undo-choice">撤销</button><button class="ghost-button" type="button" data-action="clear-choice">清空</button></div>'}
    </div>`;
  }

  function applyChoice(button) {
    if (state.answered) return;
    const input = document.getElementById("answerInput");
    if (!input) return;
    const value = button.dataset.choice;
    if (button.dataset.single === "true") {
      input.value = value;
      document.querySelectorAll(".answer-choice").forEach((item) => item.classList.toggle("selected", item === button));
      submitAnswer();
      return;
    }
    const tokens = state.question.mode === "chordFormula" ? MT.normalizeFormula(input.value) : MT.splitNotes(input.value);
    const existingIndex = tokens.indexOf(value);
    if (existingIndex >= 0) tokens.splice(existingIndex, 1); else tokens.push(value);
    setSelection(tokens);
  }

  function setSelection(tokens) {
    const input = document.getElementById("answerInput");
    if (!input) return;
    input.value = tokens.map(display).join(" ");
    document.querySelectorAll(".answer-choice").forEach((button) => button.classList.toggle("selected", tokens.includes(button.dataset.choice)));
    const status = document.getElementById("selectionStatus");
    if (status) status.innerHTML = tokens.length ? `已选 <b>${tokens.map(display).join("　")}</b>` : "尚未选择";
  }

  function editSelection(action) {
    const input = document.getElementById("answerInput");
    if (!input || state.answered) return;
    const tokens = state.question.mode === "chordFormula" ? MT.normalizeFormula(input.value) : MT.splitNotes(input.value);
    if (action === "undo-choice") tokens.pop();
    if (action === "clear-choice") tokens.length = 0;
    setSelection(tokens);
  }

  function starCurrent() {
    if (!state.question) return;
    const reviewData = { ...questionDescriptor(state.question), signature: state.question.signature, title: questionTitle(state.question), correctAnswer: expectedText(state.question) };
    Store.star(state.question.knowledgeKey, reviewData);
    showToast("已加入重点复习");
  }

  function endSession(completed) {
    clearInterval(state.timerId);
    state.session.active = false;
    renderTraining(completed);
  }

  function restartSession() {
    state.session = freshSession();
    state.delayed = [];
    state.reviewMode = false;
    nextQuestion();
  }

  function switchTab(tab) {
    clearInterval(state.timerId);
    state.tab = tab;
    state.question = null;
    state.answered = false;
    state.feedback = null;
    state.reviewMode = false;
    state.session = freshSession();
    state.delayed = [];
    document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    if (tab === "stats") renderStats(); else nextQuestion();
    app.focus({ preventScroll: true });
  }

  function renderTraining(completed) {
    const labels = { interval: ["INTERVAL REFLEX", "音程反应训练", "从字母级数到半音距离，建立真正的音名映射。"], chord: ["CHORD SPELLING", "和弦组成音训练", "把和弦公式即时转换为正确拼写的实际音名。"], mixed: ["INTERLEAVED PRACTICE", "综合交叉训练", "随机切换音程、公式、组成音和和弦识别。"] };
    const copy = labels[state.tab] || labels.interval;
    app.innerHTML = `
      <section class="page-head">
        <div><p class="eyebrow">${copy[0]}</p><h1>${copy[1]}</h1><p>${copy[2]}</p></div>
        <span class="stage-chip">目标反应 <b>${Store.data.settings.targetTime} 秒内</b></span>
      </section>
      ${dailyRecommendationHtml()}
      <div class="training-layout">
        <section class="trainer-card" aria-label="答题区">${completed || !state.session.active ? completeHtml() : questionHtml()}</section>
        ${settingsHtml()}
      </div>`;
    bindDynamicEvents();
    if (!state.answered && state.session.active) app.focus({ preventScroll: true });
  }

  function questionHtml() {
    const q = state.question;
    if (!q) return "";
    const mainClass = q.main.length > 12 ? " long" : "";
    const limit = Number(Store.data.settings.sessionLength);
    const accuracy = state.session.answered ? Math.round(state.session.correct / state.session.answered * 100) : 0;
    const avg = state.session.answered ? state.session.totalMs / state.session.answered / 1000 : 0;
    const progress = limit ? Math.min(100, state.session.answered / limit * 100) : 0;
    return `
      <div class="question-meta"><span class="question-kind">${esc(q.kindLabel)}</span><span class="timer" id="questionTimer">${state.feedback ? (state.feedback.elapsedMs / 1000).toFixed(1) : "0.0"} s</span></div>
      <div class="question-stage">
        <div>
          <div class="question-context">${esc(q.context)}</div>
          <div class="question-main${mainClass}">${esc(q.main)}</div>
          <div class="question-sub">${esc(q.sub)}</div>
          ${q.family === "chord" && q.voicing === "core" ? '<div class="question-hint">本题按核心结构音作答</div>' : ""}
        </div>
      </div>
      ${choicePanelHtml(q)}
      <label class="answer-label answer-label-secondary" for="answerInput">也可使用键盘输入或编辑答案</label>
      <div class="answer-row">
        <input class="answer-input" id="answerInput" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(q.placeholder)}" ${state.answered ? "disabled" : ""}>
        <button class="primary-button" id="submitButton" type="button">${state.answered ? "下一题 ↵" : "提交 ↵"}</button>
      </div>
      <div class="quick-actions">
        <button class="ghost-button" type="button" data-action="reveal"><kbd>Space</kbd> 显示答案</button>
        <button class="ghost-button" type="button" data-action="skip"><kbd>N</kbd> 跳过</button>
        <button class="ghost-button" type="button" data-action="star"><kbd>R</kbd> 重点复习</button>
        <span class="spacer"></span>
        ${audioButtonsHtml(q)}
      </div>
      ${state.feedback ? feedbackHtml(q, state.feedback) : ""}
      <div class="session-strip">
        <div class="session-stat"><small>进度</small><b>${state.session.answered}${limit ? ` / ${limit}` : " 题"}</b></div>
        <div class="session-stat"><small>正确率</small><b>${accuracy}%</b></div>
        <div class="session-stat"><small>平均反应</small><b>${avg.toFixed(1)} s</b></div>
        ${limit ? `<div class="progress-track"><span style="width:${progress}%"></span></div>` : ""}
      </div>`;
  }

  function audioButtonsHtml(question) {
    if (question.family === "interval") return '<button class="ghost-button" type="button" data-audio="root">♪ 根音</button><button class="ghost-button" type="button" data-audio="answer">♪ 答案</button><button class="ghost-button" type="button" data-audio="sequence">♪ 连续</button>';
    return '<button class="ghost-button" type="button" data-audio="chord">♪ 播放和弦</button>';
  }

  function feedbackHtml(question, feedback) {
    const speedLabel = feedback.elapsedMs <= 2000 ? "熟练" : feedback.elapsedMs <= 4000 ? "基本熟练" : feedback.elapsedMs <= 7000 ? "需要加强" : "薄弱反应";
    const verdict = feedback.correct ? (feedback.slow ? "✓ 正确，但反应偏慢" : "✓ 正确") : "答案不正确";
    return `<div class="feedback ${feedback.correct ? "correct" : "wrong"}">
      <div class="feedback-head"><span class="feedback-verdict">${verdict}</span><span class="feedback-time">${(feedback.elapsedMs / 1000).toFixed(1)} 秒 · ${speedLabel}</span></div>
      ${derivationHtml(question, feedback)}
    </div>`;
  }

  function derivationHtml(question, feedback) {
    if (question.family === "interval") {
      const info = question.info;
      const wrongNote = feedback.userAnswer && !feedback.userAnswer.startsWith("（") ? display(feedback.userAnswer) : "未作答";
      return `<div class="derivation">
        ${feedback.correct ? "" : `<div>你的答案：<b>${esc(wrongNote)}</b>　正确答案：<b>${esc(expectedText(question))}</b></div>`}
        <div>${display(question.root)} → 第 ${info.degree || MT.INTERVALS[question.focus].degree} 个字母是 <b>${info.targetLetter}</b></div>
        <div>${display(question.root)} 到 ${display(info.note)} = <b>${info.semitones} 个半音</b>，因此是 ${info.name}（${display(question.focus)}）</div>
      </div>`;
    }
    const maps = question.formula.map((interval, index) => `<span>${display(interval)} = ${display(question.notes[index])}</span>`).join("");
    const wrong = feedback.userAnswer && !feedback.userAnswer.startsWith("（") ? `<div>你的答案：<b>${esc(display(feedback.userAnswer))}</b></div>` : "";
    return `<div class="derivation">
      ${wrong}
      <div><b>${esc(question.name)}</b> 公式：${question.formula.map(display).join(" ")}</div>
      <div class="formula-map">${maps}</div>
      <div>正确答案：<b>${esc(expectedText(question))}</b></div>
    </div>`;
  }

  function completeHtml() {
    const answered = state.session.answered;
    const accuracy = answered ? Math.round(state.session.correct / answered * 100) : 0;
    const avg = answered ? state.session.totalMs / answered / 1000 : 0;
    return `<div class="session-complete"><div>
      <div class="complete-mark">✓</div><h2>本轮训练完成</h2><p>把犹豫的音再练一遍，反应才会真正变快。</p>
      <div class="complete-metrics"><span><b>${answered}</b><small>完成题数</small></span><span><b>${accuracy}%</b><small>正确率</small></span><span><b>${avg.toFixed(1)}s</b><small>平均反应</small></span></div>
      <button class="primary-button" style="height:48px" type="button" data-action="restart">再练一轮</button>
      <button class="secondary-button" type="button" data-tab="stats">查看统计</button>
    </div></div>`;
  }

  function settingsHtml() {
    const settings = Store.data.settings;
    const rootChecks = MT.ALL_ROOT_SPELLINGS.map((root) => checkHtml("roots", root, display(root), settings.roots.includes(root))).join("");
    const intervalChecks = INTERVAL_OPTIONS.map((interval) => checkHtml("intervals", interval, display(interval), settings.intervals.includes(interval))).join("");
    const chordChecks = CHORD_GROUPS.map((group) => `<div class="control-note" style="margin:10px 0 6px">${group.title}</div><div class="check-grid chords">${group.keys.map((key) => checkHtml("chords", key, MT.CHORDS[key].label, settings.chords.includes(key))).join("")}</div>`).join("");
    return `<aside class="settings-card" aria-label="训练设置">
      <div class="settings-head"><h2>本轮设置</h2><button class="ghost-button" type="button" data-action="restart">重新开始</button></div>
      <div class="settings-body">
        ${state.tab !== "chord" ? `<div class="control"><div class="control-head"><label class="control-label" for="intervalMode">音程题型</label></div><select class="select-input" id="intervalMode" data-setting="intervalMode"><option value="forward">正向问答</option><option value="symbol">符号问答</option><option value="reverse">反向识别</option><option value="rapid">连续快速反应</option></select></div>` : ""}
        ${state.tab !== "interval" ? `<div class="control"><div class="control-head"><label class="control-label" for="chordMode">和弦题型</label></div><select class="select-input" id="chordMode" data-setting="chordMode"><option value="notes">和弦 → 组成音</option><option value="identify">组成音 → 和弦</option><option value="complete">补全组成音</option><option value="formulaNotes">公式 → 音名</option><option value="chordFormula">和弦 → 公式</option></select></div><div class="control"><div class="control-head"><label class="control-label" for="chordVoicing">扩展和弦答案</label></div><select class="select-input" id="chordVoicing" data-setting="chordVoicing"><option value="full">理论完整组成音</option><option value="core">核心结构音</option></select></div>` : ""}
        <div class="control">
          <div class="control-head"><span class="control-label">根音范围</span><span class="control-note">已选 ${settings.roots.length}</span></div>
          <div class="preset-row"><button class="preset-button" data-root-preset="natural">自然音</button><button class="preset-button" data-root-preset="sharp">升号调</button><button class="preset-button" data-root-preset="flat">降号调</button><button class="preset-button" data-root-preset="twelve">全十二调</button><button class="preset-button" data-root-preset="default">默认</button></div>
          <div class="check-grid">${rootChecks}</div>
          <div class="c-toggle" style="margin-top:9px"><span>排除 C 根音</span><label class="switch"><input type="checkbox" id="excludeC" ${settings.cWeight === 0 ? "checked" : ""}><span></span></label></div>
        </div>
        ${state.tab !== "chord" ? `<div class="control"><div class="control-head"><span class="control-label">音程范围</span><span class="control-note">已选 ${settings.intervals.length}</span></div><div class="preset-row"><button class="preset-button" data-level="1">Level 1</button><button class="preset-button" data-level="2">Level 2</button><button class="preset-button" data-level="3">Level 3</button><button class="preset-button" data-level="4">Level 4</button></div><div class="check-grid">${intervalChecks}</div></div>` : ""}
        ${state.tab !== "interval" ? `<div class="control"><div class="control-head"><span class="control-label">和弦类型</span><span class="control-note">已选 ${settings.chords.length}</span></div>${chordChecks}</div>` : ""}
        <div class="control"><div class="control-head"><label class="control-label" for="sessionLength">训练长度</label></div><select class="select-input" id="sessionLength" data-setting="sessionLength"><option value="20">快速 · 20 题</option><option value="40">标准 · 40 题</option><option value="80">强化 · 80 题</option><option value="0">自由训练 · 无限</option></select></div>
        <div class="control"><div class="control-head"><label class="control-label" for="targetTime">反应目标</label><span class="control-note">超过即进待强化题库</span></div><div class="range-row"><input type="range" min="1" max="8" step=".5" value="${settings.targetTime}" id="targetTimeRange"><input class="number-input" type="number" min="1" max="15" step=".5" value="${settings.targetTime}" id="targetTime" data-setting="targetTime" aria-label="目标秒数"></div></div>
      </div>
    </aside>`;
  }

  function checkHtml(setting, value, label, checked) {
    return `<label class="pill-check" title="${esc(label)}"><input type="checkbox" data-check-setting="${setting}" value="${esc(value)}" ${checked ? "checked" : ""}><span>${esc(label)}</span></label>`;
  }

  function dailyRecommendationHtml() {
    const knowledge = Object.entries(Store.data.knowledge).map(([key, point]) => ({ key, point, status: Store.mastery(point) })).filter((item) => item.status.score != null).sort((a, b) => a.status.score - b.status.score);
    let text = "先练 D、E、F、G、A、B 的 ♭3、3、4、5，再加入 ♭7 与 7。";
    if (knowledge.length) {
      const weak = knowledge.slice(0, 3).map((item) => {
        const [family, root, focus] = item.key.split("|");
        return family === "interval" ? `${display(root)} + ${display(focus)}` : MT.chordName(root, focus);
      });
      text = `优先强化 ${weak.join("、")}，再复习 ${Object.keys(Store.data.review).length} 道错题 / 慢反应题。`;
    }
    return `<div class="recommendation"><span class="recommendation-mark">今</span><div><strong>今日建议</strong><p>${esc(text)}</p></div></div>`;
  }

  function bindDynamicEvents() {
    const submit = document.getElementById("submitButton");
    if (submit) submit.addEventListener("click", () => state.answered ? nextQuestion() : submitAnswer());
    const input = document.getElementById("answerInput");
    if (input) input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); submitAnswer(); } });
    if (input) input.addEventListener("input", () => {
      const tokens = state.question.mode === "chordFormula" ? MT.normalizeFormula(input.value) : MT.splitNotes(input.value);
      document.querySelectorAll(".answer-choice").forEach((button) => button.classList.toggle("selected", tokens.includes(button.dataset.choice)));
      const status = document.getElementById("selectionStatus");
      if (status) status.innerHTML = tokens.length ? `已选 <b>${tokens.map(display).join("　")}</b>` : "尚未选择";
    });
    document.querySelectorAll("[data-setting]").forEach((element) => {
      const key = element.dataset.setting;
      element.value = String(Store.data.settings[key]);
      element.addEventListener("change", () => {
        Store.data.settings[key] = ["sessionLength", "targetTime"].includes(key) ? Number(element.value) : element.value;
        Store.save();
        if (key === "targetTime") document.getElementById("targetTimeRange").value = element.value;
      });
    });
    const range = document.getElementById("targetTimeRange");
    if (range) range.addEventListener("input", () => { const number = document.getElementById("targetTime"); number.value = range.value; Store.data.settings.targetTime = Number(range.value); Store.save(); });
    document.querySelectorAll("[data-check-setting]").forEach((element) => element.addEventListener("change", () => updateCheckedSetting(element)));
    const excludeC = document.getElementById("excludeC");
    if (excludeC) excludeC.addEventListener("change", () => { Store.data.settings.cWeight = excludeC.checked ? 0 : .2; Store.save(); showToast(excludeC.checked ? "C 根音已完全排除" : "C 根音恢复为 20% 权重"); });
  }

  function updateCheckedSetting(element) {
    const key = element.dataset.checkSetting;
    const checked = Array.from(document.querySelectorAll(`[data-check-setting="${key}"]:checked`)).map((input) => input.value);
    if (!checked.length) {
      element.checked = true;
      showToast("至少保留一个训练项目");
      return;
    }
    Store.data.settings[key] = checked;
    Store.save();
  }

  function accuracyRows(groupKey, labelFn) {
    const grouped = {};
    Store.data.history.forEach((entry) => {
      const key = entry[groupKey];
      if (!key) return;
      grouped[key] ||= { attempts: 0, correct: 0 };
      grouped[key].attempts += 1;
      grouped[key].correct += entry.correct ? 1 : 0;
    });
    return Object.entries(grouped).map(([key, value]) => ({ key, label: labelFn(key), attempts: value.attempts, accuracy: Math.round(value.correct / value.attempts * 100) })).sort((a, b) => a.accuracy - b.accuracy);
  }

  function renderStats() {
    const history = Store.data.history;
    const attempts = history.length;
    const correct = history.filter((item) => item.correct).length;
    const slow = history.filter((item) => item.slow).length;
    const avg = attempts ? history.reduce((sum, item) => sum + item.elapsedMs, 0) / attempts / 1000 : 0;
    app.innerHTML = `
      <section class="page-head"><div><p class="eyebrow">MASTERY MAP</p><h1>学习统计</h1><p>找到具体卡住的“根音 × 结构”，而不是只看总正确率。</p></div><span class="stage-chip">本机已记录 <b>${attempts} 题</b></span></section>
      ${dailyRecommendationHtml()}
      <div class="stats-grid">
        ${metricHtml("总训练题数", attempts, "题")}${metricHtml("整体正确率", attempts ? Math.round(correct / attempts * 100) : 0, "%")}${metricHtml("平均反应", avg.toFixed(1), "s")}${metricHtml("待复习", Object.keys(Store.data.review).length, "题")}
      </div>
      <section class="panel"><div class="panel-head"><div><h2>音程熟练度矩阵</h2><p>颜色同时考虑正确率、反应速度和练习次数。</p></div></div>${matrixHtml()}</section>
      <section class="panel"><div class="panel-head"><div><h2>薄弱点分布</h2><p>从低正确率到高正确率排列。</p></div></div>${rankingsHtml()}</section>
      <section class="panel"><div class="panel-head"><div><h2>错题与待强化题</h2><p>连续答对 3 次后自动移出。</p></div><div class="panel-actions"><button class="secondary-button" type="button" data-action="start-review" ${Object.keys(Store.data.review).length ? "" : "disabled"}>开始复习</button></div></div>${reviewHtml()}</section>
      <section class="panel"><div class="panel-head"><div><h2>数据管理</h2><p>训练数据只保存在当前浏览器，建议定期备份。</p></div><div class="panel-actions"><button class="secondary-button" type="button" data-action="export">导出 JSON</button><button class="secondary-button" type="button" data-action="import">导入 JSON</button><button class="secondary-button danger-button" type="button" data-action="reset-data">清空数据</button></div></div></section>`;
  }

  function metricHtml(label, value, unit) {
    return `<div class="metric-card"><small>${label}</small><b>${value}${unit || ""}</b></div>`;
  }

  function matrixHtml() {
    const roots = MT.ROOTS;
    const intervals = ["b3", "3", "4", "5", "b7", "7", "9", "11", "13"];
    const head = roots.map((root) => `<th>${display(root)}</th>`).join("");
    const body = intervals.map((interval) => {
      const cells = roots.map((root) => {
        const status = Store.mastery(Store.data.knowledge[`interval|${root}|${interval}`]);
        return `<td class="mastery-${status.level}" title="${display(root)} + ${display(interval)}：${status.score == null ? "未训练" : `${status.score} 分 · ${status.label}`}">${status.score == null ? "—" : status.score}</td>`;
      }).join("");
      return `<tr><th>${display(interval)}</th>${cells}</tr>`;
    }).join("");
    return `<div class="matrix-wrap"><table class="matrix"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div><div class="legend"><span><i class="mastery-fluent"></i>熟练</span><span><i class="mastery-learning"></i>正在学习</span><span><i class="mastery-slow"></i>反应较慢</span><span><i class="mastery-weak"></i>薄弱</span><span><i class="mastery-unseen"></i>未训练</span></div>`;
  }

  function rankingsHtml() {
    const roots = accuracyRows("root", display);
    const intervals = accuracyRows("focus", (key) => MT.INTERVALS[key] ? display(key) : null).filter((item) => item.label);
    const chords = accuracyRows("focus", (key) => MT.CHORDS[key] ? MT.CHORDS[key].label : null).filter((item) => item.label);
    return `<div class="rank-grid">${rankBlock("根音正确率", roots)}${rankBlock("音程正确率", intervals)}${rankBlock("和弦正确率", chords)}</div>`;
  }

  function rankBlock(title, rows) {
    const content = rows.length ? rows.slice(0, 8).map((row) => `<div class="rank-item"><span>${esc(row.label)}</span><div class="rank-bar"><span style="width:${row.accuracy}%"></span></div><em>${row.accuracy}%</em></div>`).join("") : '<div class="empty-state" style="padding:18px 0">暂无数据</div>';
    return `<div><h3>${title}</h3><div class="rank-list">${content}</div></div>`;
  }

  function reviewHtml() {
    const items = Object.values(Store.data.review).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
    if (!items.length) return '<div class="empty-state"><strong>待复习题库是空的</strong>错题、慢反应题和手动标记题会自动出现在这里。</div>';
    return `<div class="review-list">${items.slice(0, 40).map((item) => `<div class="review-item"><strong>${esc(item.title || `${display(item.root)} + ${display(item.focus)}`)}</strong><span class="review-reason">${esc(item.reason || "待强化")}</span><time>${formatDate(item.lastAt)}</time></div>`).join("")}</div>`;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function startReview() {
    if (!Object.keys(Store.data.review).length) { showToast("当前没有待复习题"); return; }
    state.tab = "mixed";
    state.reviewMode = true;
    state.session = freshSession();
    state.delayed = [];
    document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === "mixed"));
    nextQuestion();
  }

  function exportData() {
    const blob = new Blob([Store.exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `十二调训练数据-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("训练数据已导出");
  }

  function handleImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importData(JSON.parse(reader.result));
        setTheme(Store.data.settings.theme);
        renderStats();
        showToast("训练数据已导入");
      } catch (error) { showToast(error.message || "导入失败"); }
      importFile.value = "";
    };
    reader.readAsText(file);
  }

  let audioContext = null;
  function playMidi(midi, start, duration) {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.18, start + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .03);
  }

  function playAudio(type) {
    if (!state.question) return;
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime + .02;
    const q = state.question;
    if (type === "root") playMidi(MT.midiFor(q.root, 4), now, .7);
    if (type === "answer") playMidi(MT.midiFor(q.info.note, 4) + (q.info.semitones >= 12 ? 12 : 0), now, .7);
    if (type === "sequence") {
      playMidi(MT.midiFor(q.root, 4), now, .55);
      playMidi(MT.midiFor(q.info.note, 4) + (q.info.semitones >= 12 ? 12 : 0), now + .62, .75);
    }
    if (type === "chord") q.notes.forEach((note, index) => playMidi(MT.midiFor(note, 4) + (index && MT.midiFor(note, 4) <= MT.midiFor(q.notes[index - 1], 4) ? 12 : 0), now + index * .035, 1.15));
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) { switchTab(tab.dataset.tab); return; }
    const choice = event.target.closest("[data-choice]");
    if (choice) { applyChoice(choice); return; }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "reveal") submitAnswer({ reveal: true });
    if (action === "skip") submitAnswer({ skip: true });
    if (action === "star") starCurrent();
    if (action === "restart") restartSession();
    if (action === "start-review") startReview();
    if (action === "export") exportData();
    if (action === "import") importFile.click();
    if (action === "undo-choice" || action === "clear-choice") editSelection(action);
    if (action === "reset-data" && confirm("确定清空全部训练历史、错题和设置吗？此操作无法撤销。")) { Store.reset(); setTheme(Store.data.settings.theme); renderStats(); showToast("训练数据已清空"); }
    const preset = event.target.closest("[data-root-preset]");
    if (preset) { Store.data.settings.roots = ROOT_PRESETS[preset.dataset.rootPreset].slice(); Store.save(); renderTraining(); }
    const level = event.target.closest("[data-level]");
    if (level) { Store.data.settings.intervals = LEVEL_INTERVALS[level.dataset.level].slice(); Store.save(); renderTraining(); }
    const audio = event.target.closest("[data-audio]");
    if (audio) playAudio(audio.dataset.audio);
  });

  document.addEventListener("keydown", (event) => {
    const input = document.getElementById("answerInput");
    const typing = document.activeElement === input;
    const formField = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);
    const buttonFocused = document.activeElement?.tagName === "BUTTON";
    if (event.key === "Escape" && state.tab !== "stats") { event.preventDefault(); endSession(false); }
    if (!typing && event.key.toLowerCase() === "n" && state.tab !== "stats") { event.preventDefault(); submitAnswer({ skip: true }); }
    if (!typing && event.key.toLowerCase() === "r" && state.tab !== "stats") { event.preventDefault(); starCurrent(); }
    if (!buttonFocused && event.code === "Space" && state.tab !== "stats" && (!typing || !input.value.trim())) { event.preventDefault(); submitAnswer({ reveal: true }); }
    if (!formField && !state.answered && /^[1-9]$/.test(event.key)) {
      const choice = document.querySelector(`[data-choice-index="${event.key}"]`);
      if (choice) { event.preventDefault(); applyChoice(choice); }
    }
  });

  document.getElementById("themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  importFile.addEventListener("change", () => handleImport(importFile.files[0]));

  setTheme(Store.data.settings.theme || "light");
  switchTab("interval");
})();
