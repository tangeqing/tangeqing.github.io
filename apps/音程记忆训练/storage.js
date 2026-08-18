(function (global) {
  "use strict";

  const STORAGE_KEY = "twelveToneTrainer.v1";
  const DEFAULT_SETTINGS = {
    roots: ["D", "E", "F", "G", "A", "B"],
    intervals: ["b3", "3", "4", "5", "b7", "7"],
    chords: ["major", "minor", "maj7", "m7", "7"],
    intervalMode: "symbol",
    chordMode: "notes",
    chordVoicing: "full",
    sessionLength: 20,
    targetTime: 3,
    cWeight: 0.2,
    theme: "light"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function freshData() {
    return { version: 1, settings: clone(DEFAULT_SETTINGS), history: [], knowledge: {}, review: {}, sessionCount: 0 };
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== "object") return freshData();
      return {
        ...freshData(),
        ...saved,
        settings: { ...clone(DEFAULT_SETTINGS), ...(saved.settings || {}) },
        history: Array.isArray(saved.history) ? saved.history : [],
        knowledge: saved.knowledge || {},
        review: saved.review || {}
      };
    } catch (error) {
      return freshData();
    }
  }

  let data = load();

  function save() {
    if (data.history.length > 5000) data.history = data.history.slice(-5000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function record(result) {
    const entry = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), at: new Date().toISOString(), ...result };
    data.history.push(entry);
    const key = result.knowledgeKey;
    const point = data.knowledge[key] || { attempts: 0, correct: 0, totalMs: 0, errors: 0, slow: 0, streak: 0, starred: 0 };
    point.attempts += 1;
    point.correct += result.correct ? 1 : 0;
    point.totalMs += result.elapsedMs || 0;
    point.errors += result.correct ? 0 : 1;
    point.slow += result.slow ? 1 : 0;
    point.streak = result.correct && !result.slow ? point.streak + 1 : 0;
    point.lastSeen = entry.at;
    if (!result.correct) point.lastWrong = entry.at;
    data.knowledge[key] = point;

    const signature = result.signature;
    if (!result.correct || result.slow || result.starred) {
      const review = data.review[signature] || { ...result.reviewData, signature, errors: 0, slow: 0, correctStreak: 0 };
      if (!result.correct) review.errors += 1;
      if (result.slow) review.slow += 1;
      review.correctStreak = 0;
      review.lastAt = entry.at;
      review.lastAnswer = result.userAnswer;
      review.reason = result.starred ? "重点" : (!result.correct ? "错题" : "反应较慢");
      data.review[signature] = review;
    } else if (data.review[signature]) {
      data.review[signature].correctStreak = (data.review[signature].correctStreak || 0) + 1;
      if (data.review[signature].correctStreak >= 3) delete data.review[signature];
    }
    save();
    return entry;
  }

  function star(key, reviewData) {
    const point = data.knowledge[key] || { attempts: 0, correct: 0, totalMs: 0, errors: 0, slow: 0, streak: 0, starred: 0 };
    point.starred += 1;
    data.knowledge[key] = point;
    data.review[reviewData.signature] = { ...reviewData, reason: "重点", errors: 0, slow: 0, correctStreak: 0, lastAt: new Date().toISOString() };
    save();
  }

  function mastery(point) {
    if (!point || !point.attempts) return { score: null, level: "unseen", label: "未训练" };
    const accuracy = point.correct / point.attempts;
    const avg = point.totalMs / point.attempts / 1000;
    const speedScore = Math.max(0, Math.min(1, (8 - avg) / 6));
    const volume = Math.min(1, point.attempts / 6);
    const score = Math.round((accuracy * 0.62 + speedScore * 0.28 + volume * 0.1) * 100);
    let level = "weak", label = "薄弱";
    if (score >= 85 && point.streak >= 2) { level = "fluent"; label = "熟练"; }
    else if (score >= 70) { level = "learning"; label = "正在学习"; }
    else if (accuracy >= 0.7) { level = "slow"; label = "反应较慢"; }
    return { score, level, label, accuracy, avg };
  }

  function weightFor(key, root) {
    const point = data.knowledge[key];
    let weight = 1;
    if (point) {
      const status = mastery(point);
      if (point.errors > 0 && point.streak < 3) weight = 5;
      else if (point.slow > 0 && status.level !== "fluent") weight = 3;
      else if (status.level === "fluent") weight = 0.3;
    }
    if (root === "C") weight *= Number(data.settings.cWeight ?? 0.2);
    return Math.max(0.01, weight);
  }

  function exportData() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), app: "twelve-tone-trainer", ...data }, null, 2);
  }

  function importData(value) {
    if (!value || value.app !== "twelve-tone-trainer" || !Array.isArray(value.history) || typeof value.knowledge !== "object") {
      throw new Error("这不是有效的训练器数据文件");
    }
    data = {
      ...freshData(), ...value,
      settings: { ...clone(DEFAULT_SETTINGS), ...(value.settings || {}) },
      review: value.review || {}
    };
    save();
  }

  function reset() {
    data = freshData();
    save();
  }

  global.TrainerStore = {
    get data() { return data; },
    DEFAULT_SETTINGS, save, record, star, mastery, weightFor, exportData, importData, reset
  };
})(window);
