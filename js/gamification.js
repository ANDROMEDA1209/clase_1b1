(function () {
  "use strict";

  const STORAGE_KEY = "dataAcademy.progress.v1";
  const TOTAL_CHALLENGES = 5;
  const BADGES = {
    first: { label: "Primera decisión", icon: "✦" },
    etl: { label: "Flujo ETL", icon: "⤧" },
    three: { label: "Analista en marcha", icon: "◈" },
    streak: { label: "Racha x3", icon: "⚡" },
    expert: { label: "BI experto", icon: "♛" }
  };
  const DEFAULT_STATE = {
    xp: 0,
    completed: [],
    badges: [],
    streak: 0,
    bestStreak: 0,
    lastCompleted: null
  };

  function normalizeState(value) {
    if (!value || typeof value !== "object") return { ...DEFAULT_STATE };
    return {
      xp: Number.isFinite(value.xp) && value.xp >= 0 ? value.xp : 0,
      completed: Array.isArray(value.completed) ? [...new Set(value.completed)] : [],
      badges: Array.isArray(value.badges) ? [...new Set(value.badges)] : [],
      streak: Number.isFinite(value.streak) && value.streak >= 0 ? value.streak : 0,
      bestStreak: Number.isFinite(value.bestStreak) && value.bestStreak >= 0 ? value.bestStreak : 0,
      lastCompleted: typeof value.lastCompleted === "string" ? value.lastCompleted : null
    };
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : { ...DEFAULT_STATE };
    } catch (error) {
      console.error("No se pudo leer el progreso guardado de la Academia BI.", error);
      return { ...DEFAULT_STATE };
    }
  }

  let state = loadState();

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const status = document.querySelector(".save-status");
      if (status) status.innerHTML = "PROGRESO GUARDADO <i></i>";
    } catch (error) {
      console.error("No se pudo guardar el progreso de la Academia BI.", error);
      const status = document.querySelector(".save-status");
      if (status) status.textContent = "NO SE PUDO GUARDAR EL PROGRESO";
    }
  }

  function unlockBadge(id) {
    if (state.badges.includes(id) || !BADGES[id]) return false;
    state.badges.push(id);
    return true;
  }

  function complete(challengeId, baseXP) {
    if (state.completed.includes(challengeId)) {
      return { alreadyCompleted: true, xpEarned: 0, newBadges: [] };
    }

    state.completed.push(challengeId);
    state.lastCompleted = challengeId;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    let xpEarned = baseXP;
    const newBadges = [];

    if (state.completed.length === 1 && unlockBadge("first")) newBadges.push(BADGES.first.label);
    if (challengeId === "etl" && unlockBadge("etl")) newBadges.push(BADGES.etl.label);
    if (state.completed.length >= 3 && unlockBadge("three")) newBadges.push(BADGES.three.label);
    if (state.streak >= 3 && unlockBadge("streak")) {
      newBadges.push(BADGES.streak.label);
      xpEarned += 20;
    }
    if (state.completed.length === TOTAL_CHALLENGES && unlockBadge("expert")) {
      newBadges.push(BADGES.expert.label);
    }

    state.xp += xpEarned;
    persist();
    return { alreadyCompleted: false, xpEarned, newBadges };
  }

  function recordIncorrect() {
    if (state.streak !== 0) {
      state.streak = 0;
      persist();
    }
  }

  function getLevel(xp) {
    if (xp >= 500) return { name: "Experto en BI", shortName: "Experto", number: 3, start: 500, next: 500 };
    if (xp >= 250) return { name: "Analista de Datos", shortName: "Analista", number: 2, start: 250, next: 500 };
    return { name: "Aprendiz de BI", shortName: "Aprendiz", number: 1, start: 0, next: 250 };
  }

  function getSnapshot() {
    const level = getLevel(state.xp);
    const progress = level.next === level.start
      ? 100
      : Math.min(100, Math.round(((state.xp - level.start) / (level.next - level.start)) * 100));
    return {
      ...state,
      level,
      progress,
      completedCount: Math.min(TOTAL_CHALLENGES, state.completed.length),
      totalChallenges: TOTAL_CHALLENGES,
      totalProgress: Math.round((Math.min(TOTAL_CHALLENGES, state.completed.length) / TOTAL_CHALLENGES) * 100),
      badges: state.badges.filter((id) => BADGES[id]).map((id) => ({ id, ...BADGES[id] })),
      badgeCatalog: BADGES
    };
  }

  window.BIGamification = Object.freeze({
    complete,
    recordIncorrect,
    isCompleted: (challengeId) => state.completed.includes(challengeId),
    getSnapshot
  });
})();
