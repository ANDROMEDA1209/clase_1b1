(function () {
  "use strict";

  const STORAGE_KEY = "biQuest.progress.v1";
  function defaultState() {
    return {
      xp: 0,
      completedMissions: [],
      missionChecks: {},
      passedQuizzes: [],
      readBooks: [],
      sideQuestChecks: [],
      badges: [],
      streak: 0,
      lastActive: null
    };
  }
  const saveStatus = document.getElementById("quest-save-status");
  let data;
  let state;
  let toastTimer;

  function missionList() {
    return data.worlds.flatMap((world) => world.missions);
  }

  function validIds(values, allowed) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.filter((value) => allowed.has(value)))];
  }

  function normalizeState(value) {
    const missions = new Map(missionList().map((mission) => [mission.id, mission]));
    const books = new Set(data.library.map((book) => book.id));
    const badges = new Set(data.badges.map((badge) => badge.id));
    if (!value || typeof value !== "object") return defaultState();
    const missionChecks = {};
    Object.entries(value.missionChecks || {}).forEach(([id, checks]) => {
      if (missions.has(id) && Array.isArray(checks)) {
        missionChecks[id] = data.checklist.map((_, index) => checks[index] === true);
      }
    });
    return {
      xp: Number.isFinite(value.xp) && value.xp >= 0 ? value.xp : 0,
      completedMissions: validIds(value.completedMissions, new Set(missions.keys())),
      missionChecks,
      passedQuizzes: validIds(value.passedQuizzes, new Set(missions.keys())),
      readBooks: validIds(value.readBooks, books),
      sideQuestChecks: data.sideQuest.checklist.map((_, index) =>
        Array.isArray(value.sideQuestChecks) && value.sideQuestChecks[index] === true
      ),
      badges: validIds(value.badges, badges),
      streak: Number.isInteger(value.streak) && value.streak >= 0 ? value.streak : 0,
      lastActive: isDateKey(value.lastActive) ? value.lastActive : null
    };
  }

  function setSaveStatus(message, error) {
    saveStatus.textContent = message;
    saveStatus.classList.toggle("save-error", Boolean(error));
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveStatus("Progreso guardado en este navegador", false);
    } catch (error) {
      console.error("No se pudo guardar el progreso de BI Quest.", error);
      setSaveStatus("No se pudo guardar el progreso. Revisa el almacenamiento del navegador.", true);
    }
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return normalizeState(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.error("No se pudo leer el progreso de BI Quest.", error);
      setSaveStatus("No se pudo leer el progreso guardado. Se usará una sesión nueva.", true);
      return defaultState();
    }
  }

  function dateInZone(date) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: data.course.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  function dayDifference(later, earlier) {
    return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000);
  }

  function isDateKey(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function streakNow() {
    if (!state.lastActive) return 0;
    const daysSinceActivity = dayDifference(dateInZone(new Date()), state.lastActive);
    return daysSinceActivity <= 1 ? state.streak : 0;
  }

  function recordActivity() {
    const today = dateInZone(new Date());
    if (state.lastActive !== today) {
      state.streak = state.lastActive && dayDifference(today, state.lastActive) === 1
        ? state.streak + 1
        : 1;
      state.lastActive = today;
    }
    const newBadges = [];
    if (state.streak >= 7) unlockBadge("seven-day-streak", newBadges);
    announceRewards([], newBadges);
  }

  function rankForXP(xp) {
    return [...data.ranks].reverse().find((rank) => xp >= rank.xp) || data.ranks[0];
  }

  function showToast(message, celebrate) {
    const toast = document.getElementById("quest-toast");
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4400);
    if (celebrate) celebrateNow();
  }

  function celebrateNow() {
    const layer = document.getElementById("confetti-layer");
    const colors = ["#b3a3ff", "#6bd6ba", "#f1c879", "#ff927e", "#d8ccff"];
    for (let index = 0; index < 36; index += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[index % colors.length];
      piece.style.setProperty("--confetti-delay", `${Math.random() * 0.45}s`);
      piece.style.setProperty("--confetti-duration", `${1.5 + Math.random() * 1.2}s`);
      layer.append(piece);
      window.setTimeout(() => piece.remove(), 3000);
    }
  }

  function awardXP(points) {
    const previousRank = rankForXP(state.xp).name;
    state.xp += points;
    recordActivity();
    const newRank = rankForXP(state.xp).name;
    return newRank !== previousRank ? `¡Nuevo rango: ${newRank}!` : "";
  }

  function unlockBadge(id, newlyUnlocked) {
    if (!state.badges.includes(id)) {
      state.badges.push(id);
      newlyUnlocked.push(data.badges.find((badge) => badge.id === id));
    }
  }

  function announceRewards(messages, badges) {
    const parts = [...messages, ...badges.map((badge) => `Insignia: ${badge.name}`)];
    if (parts.length) showToast(parts.join(" · "), badges.length > 0 || messages.some((message) => message.startsWith("¡Nuevo rango")));
  }

  function worldById(id) {
    return data.worlds.find((world) => world.id === id);
  }

  function worldProgress(world) {
    const totalSteps = world.missions.length * (data.checklist.length + 1);
    const completedSteps = world.missions.reduce((sum, mission) => {
      const checkedCount = (state.missionChecks[mission.id] || []).filter(Boolean).length;
      return sum + checkedCount + (state.passedQuizzes.includes(mission.id) ? 1 : 0);
    }, 0);
    return Math.round((completedSteps / totalSteps) * 100);
  }

  function worldIsComplete(world) {
    return world.missions.every((mission) => state.completedMissions.includes(mission.id));
  }

  function tryCompleteMission(mission, world) {
    const checks = state.missionChecks[mission.id] || [];
    if (
      state.completedMissions.includes(mission.id) ||
      !state.passedQuizzes.includes(mission.id) ||
      !data.checklist.every((_, index) => checks[index])
    ) return [];

    state.completedMissions.push(mission.id);
    const rewards = [];
    const rankMessage = awardXP(data.xp.mission);
    if (rankMessage) rewards.push(rankMessage);
    const newBadges = [];
    if (!state.completedMissions.some((id) => id !== mission.id)) unlockBadge("first-insight", newBadges);
    if (mission.id === "mission-10") unlockBadge("etl-master", newBadges);
    if (worldIsComplete(world)) {
      unlockBadge("world-boss", newBadges);
      if (world.id === "world-3") unlockBadge("star-architect", newBadges);
    }
    announceRewards(rewards, newBadges);
    return newBadges;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderBosses() {
    const container = document.getElementById("boss-grid");
    container.replaceChildren();
    data.bosses.forEach((boss) => {
      const world = worldById(boss.worldId);
      const card = element("article", "boss-card");
      card.dataset.bossId = boss.id;
      const top = element("div", "boss-card-top");
      top.append(element("span", "boss-label", `JEFE FINAL · ${boss.name}`));
      top.append(element("span", "boss-alert", "Menos de 7 días"));
      card.append(top);
      card.append(element("h3", "", boss.title));
      card.append(element("p", "boss-evaluation", world.evaluation));
      const countdown = element("strong", "boss-countdown", "Calculando…");
      countdown.dataset.countdown = boss.id;
      countdown.setAttribute("aria-label", `Cuenta regresiva para ${boss.name}`);
      card.append(countdown);
      card.append(element("p", "boss-deadline", ""));
      const progressRow = element("div", "boss-progress-row");
      progressRow.append(element("span", "", "Preparación"));
      progressRow.append(element("strong", "", ""));
      const meter = element("div", "boss-meter");
      const meterFill = element("span", "");
      meter.append(meterFill);
      card.append(progressRow, meter);
      container.append(card);
    });
    updateBosses();
  }

  function updateBosses() {
    const now = Date.now();
    const upcoming = data.bosses.find((boss) => Date.parse(boss.deadline) > now);

    data.bosses.forEach((boss) => {
      const card = document.querySelector(`[data-boss-id="${boss.id}"]`);
      const deadline = Date.parse(boss.deadline);
      const difference = deadline - now;
      const world = worldById(boss.worldId);
      const percent = worldProgress(world);
      const timeText = difference <= 0
        ? "Evaluación finalizada"
        : formatCountdown(difference);
      card.querySelector(`[data-countdown="${boss.id}"]`).textContent = timeText;
      card.querySelector(".boss-deadline").textContent = new Intl.DateTimeFormat("es-EC", {
        timeZone: data.course.timezone,
        dateStyle: "long",
        timeStyle: "short"
      }).format(new Date(deadline));
      card.querySelector(".boss-progress-row strong").textContent = `${percent}%`;
      card.querySelector(".boss-meter span").style.width = `${percent}%`;
      card.classList.toggle("boss-urgent", difference > 0 && difference < 7 * 86400000);
      card.querySelector(".boss-alert").hidden = difference <= 0 || difference >= 7 * 86400000;
    });
    document.getElementById("next-boss-name").textContent = upcoming
      ? `${upcoming.name} · ${upcoming.title}`
      : "Todos los jefes vencidos";
    document.getElementById("next-boss-countdown").textContent = upcoming
      ? formatCountdown(Date.parse(upcoming.deadline) - now)
      : "Revisa el calendario del curso";
  }

  function formatCountdown(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(remainingSeconds).padStart(2, "0")}s`;
  }

  function renderQuiz(mission, world) {
    const section = element("section", "mission-quiz");
    section.append(element("h4", "", `Mini-quiz · aprueba con ${data.passingPercent} %`));
    const form = element("form", "quiz-form");
    form.noValidate = true;
    mission.quiz.forEach((question, questionIndex) => {
      const fieldset = element("fieldset", "quiz-question");
      fieldset.append(element("legend", "", `${questionIndex + 1}. ${question.question}`));
      question.options.forEach((option, optionIndex) => {
        const label = element("label", "quiz-option");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `${mission.id}-question-${questionIndex}`;
        input.value = String(optionIndex);
        label.append(input, document.createTextNode(option));
        fieldset.append(label);
      });
      form.append(fieldset);
    });
    const result = element("div", "quiz-result");
    result.setAttribute("aria-live", "polite");
    const submit = element("button", "button button-primary quiz-submit", "Comprobar respuestas");
    submit.type = "submit";
    form.append(submit, result);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const answers = mission.quiz.map((_, index) => {
        const selected = form.querySelector(`input[name="${mission.id}-question-${index}"]:checked`);
        return selected ? Number(selected.value) : null;
      });
      if (answers.some((answer) => answer === null)) {
        result.textContent = "Responde las tres preguntas antes de comprobar el quiz.";
        result.className = "quiz-result quiz-result-error";
        return;
      }
      const correct = answers.reduce((count, answer, index) => count + (answer === mission.quiz[index].answer ? 1 : 0), 0);
      const percentage = Math.round((correct / mission.quiz.length) * 100);
      const passed = percentage >= data.passingPercent;
      const wasPassed = state.passedQuizzes.includes(mission.id);
      const rewards = [];
      const newBadges = [];
      if (passed && !wasPassed) {
        state.passedQuizzes.push(mission.id);
        const rankMessage = awardXP(data.xp.quiz);
        if (rankMessage) rewards.push(rankMessage);
        if (state.passedQuizzes.length === 1) unlockBadge("first-insight", newBadges);
        if (percentage === 100) unlockBadge("perfect-quiz", newBadges);
        announceRewards(rewards, newBadges);
      } else if (percentage === 100) {
        unlockBadge("perfect-quiz", newBadges);
        announceRewards([], newBadges);
      }
      if (!passed) recordActivity();
      persist();
      tryCompleteMission(mission, world);
      updateAll();
      result.replaceChildren();
      result.className = `quiz-result ${passed ? "quiz-result-success" : "quiz-result-error"}`;
      result.append(element("strong", "", `${passed ? "¡Aprobado!" : "Aún falta practicar"} ${percentage}% · ${correct}/${mission.quiz.length} correctas`));
      if (passed && wasPassed) result.append(element("span", "", "Este quiz ya otorgó su XP."));
      else if (passed) result.append(element("span", "", `Sumaste ${data.xp.quiz} XP.`));
      mission.quiz.forEach((question, index) => {
        const explanation = element("p", "quiz-explanation");
        explanation.textContent = `${index + 1}. ${answers[index] === question.answer ? "Correcto." : `Respuesta: ${question.options[question.answer]}.`} ${question.explanation}`;
        result.append(explanation);
      });
    });
    section.append(form);
    return section;
  }

  function renderWorldMap() {
    const map = document.getElementById("world-map");
    map.replaceChildren();
    data.worlds.forEach((world) => {
      const section = element("section", "world-card");
      section.id = world.id;
      section.append(element("div", "world-kicker", world.subtitle));
      const heading = element("div", "world-heading");
      const title = element("h3", "", world.name);
      heading.append(title, element("span", "world-evaluation", world.evaluation));
      section.append(heading);
      section.append(element("p", "world-path-copy", "Completa cada misión para seguir el camino."));
      const path = element("div", "mission-path");
      world.missions.forEach((mission) => {
        const card = element("article", "mission-card");
        card.dataset.missionId = mission.id;
        const toggle = element("button", "mission-toggle");
        toggle.type = "button";
        toggle.dataset.missionToggle = mission.id;
        toggle.setAttribute("aria-expanded", "false");
        const number = element("span", "mission-number", String(mission.number).padStart(2, "0"));
        const name = element("span", "mission-name", mission.title);
        const status = element("span", "mission-status", "🔒 Bloqueada");
        toggle.append(number, name, status);
        toggle.addEventListener("click", () => {
          const details = card.querySelector(".mission-details");
          const opening = details.hidden;
          details.hidden = !opening;
          toggle.setAttribute("aria-expanded", String(opening));
        });
        card.append(toggle);
        const details = element("div", "mission-details");
        details.hidden = true;
        details.append(element("p", "mission-summary", mission.summary));
        const checklistTitle = element("h4", "", "Checklist de misión");
        details.append(checklistTitle);
        const checklist = element("div", "mission-checklist");
        data.checklist.forEach((labelText, index) => {
          const label = element("label", "checklist-item");
          const input = document.createElement("input");
          input.type = "checkbox";
          input.dataset.missionCheck = mission.id;
          input.dataset.checkIndex = String(index);
          input.addEventListener("change", () => {
            if (!state.missionChecks[mission.id]) {
              state.missionChecks[mission.id] = data.checklist.map(() => false);
            }
            state.missionChecks[mission.id][index] = input.checked;
            recordActivity();
            tryCompleteMission(mission, world);
            persist();
            updateAll();
          });
          label.append(input, document.createTextNode(labelText));
          checklist.append(label);
        });
        details.append(checklist, renderQuiz(mission, world));
        card.append(details);
        path.append(card);
      });
      section.append(path);
      map.append(section);
    });
    refreshWorlds();
  }

  function refreshWorlds() {
    let previousComplete = true;
    data.worlds.forEach((world) => {
      const section = document.getElementById(world.id);
      const complete = worldIsComplete(world);
      section.classList.toggle("world-complete", complete);
      section.querySelector(".world-path-copy").textContent =
        `${worldProgress(world)}% de preparación · ${complete ? "Mundo completado" : "Desbloquea las misiones en orden"}`;
      world.missions.forEach((mission, index) => {
        const card = section.querySelector(`[data-mission-id="${mission.id}"]`);
        const toggle = card.querySelector(".mission-toggle");
        const locked = !previousComplete || (index > 0 && !state.completedMissions.includes(world.missions[index - 1].id));
        const done = state.completedMissions.includes(mission.id);
        toggle.disabled = locked;
        toggle.classList.toggle("mission-locked", locked);
        toggle.classList.toggle("mission-complete", done);
        card.classList.toggle("mission-is-complete", done);
        card.querySelector(".mission-status").textContent = locked ? "🔒 Bloqueada" : done ? "✓ Completada" : "En curso";
        card.querySelector(".mission-details").hidden = locked || card.querySelector(".mission-details").hidden;
        toggle.setAttribute("aria-expanded", String(!locked && !card.querySelector(".mission-details").hidden));
        card.querySelectorAll("[data-mission-check]").forEach((input) => {
          input.checked = Boolean(state.missionChecks[mission.id]?.[Number(input.dataset.checkIndex)]);
          input.disabled = done;
        });
        const passed = state.passedQuizzes.includes(mission.id);
        const quizTitle = card.querySelector(".mission-quiz h4");
        quizTitle.textContent = passed
          ? "Mini-quiz · aprobado (puedes practicar de nuevo)"
          : `Mini-quiz · aprueba con ${data.passingPercent} %`;
        previousComplete = done;
      });
    });
  }

  function renderSideQuest() {
    const container = document.getElementById("sidequest-card");
    container.replaceChildren();
    const card = element("div", "sidequest-card");
    const copy = element("div", "sidequest-copy");
    copy.append(element("h3", "", data.sideQuest.title));
    copy.append(element("p", "", data.sideQuest.summary));
    const list = element("div", "sidequest-checklist");
    data.sideQuest.checklist.forEach((item, index) => {
      const label = element("label", "checklist-item");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.sidequestCheck = String(index);
      input.addEventListener("change", () => {
        state.sideQuestChecks[index] = input.checked;
        recordActivity();
        const allDone = state.sideQuestChecks.length === data.sideQuest.checklist.length &&
          state.sideQuestChecks.every(Boolean);
        const newBadges = [];
        if (allDone) unlockBadge("ocean-guardian", newBadges);
        const rankMessage = allDone ? awardXP(data.xp.sideQuestStep * data.sideQuest.checklist.length) : "";
        persist();
        announceRewards(rankMessage ? [rankMessage] : [], newBadges);
        updateAll();
      });
      label.append(input, document.createTextNode(item));
      list.append(label);
    });
    const note = element("p", "sidequest-note", "Cada paso suma actividad; al completar los cinco recibirás XP y la insignia Guardián del Océano. Copernicus aporta contexto ambiental, no una detección directa de microplásticos.");
    copy.append(list, note);
    card.append(copy);
    container.append(card);
    refreshSideQuest();
  }

  function refreshSideQuest() {
    const complete = state.sideQuestChecks.length === data.sideQuest.checklist.length &&
      state.sideQuestChecks.every(Boolean);
    document.querySelectorAll("[data-sidequest-check]").forEach((input) => {
      input.checked = Boolean(state.sideQuestChecks[Number(input.dataset.sidequestCheck)]);
      input.disabled = complete;
    });
    document.querySelector(".sidequest-card").classList.toggle("sidequest-complete", complete);
  }

  function renderLibrary() {
    const container = document.getElementById("library-list");
    container.replaceChildren();
    data.library.forEach((book) => {
      const card = element("article", "library-card");
      const copy = element("div", "library-copy");
      copy.append(element("span", "library-kicker", `LECTURA · +${data.xp.reading} XP`));
      const link = element("a", "library-title", book.title);
      link.href = book.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      copy.append(link);
      const actions = element("div", "library-actions");
      const read = element("label", "library-read");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.bookId = book.id;
      input.addEventListener("change", () => {
        if (input.checked && !state.readBooks.includes(book.id)) {
          state.readBooks.push(book.id);
          const rankMessage = awardXP(data.xp.reading);
          const newBadges = [];
          if (state.readBooks.length === data.library.length) unlockBadge("bookworm", newBadges);
          persist();
          announceRewards(rankMessage ? [rankMessage] : [], newBadges);
          updateAll();
        }
      });
      read.append(input, document.createTextNode("Leído"));
      actions.append(read);
      card.append(copy, actions);
      container.append(card);
    });
    refreshLibrary();
  }

  function refreshLibrary() {
    document.querySelectorAll("[data-book-id]").forEach((input) => {
      const read = state.readBooks.includes(input.dataset.bookId);
      input.checked = read;
      input.disabled = read;
    });
  }

  function renderBadges() {
    const container = document.getElementById("badge-list");
    container.replaceChildren();
    data.badges.forEach((badge) => {
      const earned = state.badges.includes(badge.id);
      const card = element("article", `badge-card${earned ? " badge-earned" : ""}`);
      card.append(element("span", "badge-icon", badge.icon));
      const copy = element("div", "badge-copy");
      copy.append(element("strong", "", badge.name));
      copy.append(element("span", "", badge.description));
      card.append(copy, element("span", "badge-state", earned ? "Desbloqueada" : "Por desbloquear"));
      container.append(card);
    });
    document.getElementById("badge-summary").textContent =
      `${state.badges.length} de ${data.badges.length} insignias desbloqueadas`;
  }

  function refreshDashboard() {
    const rank = rankForXP(state.xp);
    const rankIndex = data.ranks.indexOf(rank);
    const nextRank = data.ranks[rankIndex + 1];
    const completed = state.completedMissions.length;
    const progress = Math.round((completed / missionList().length) * 100);
    document.getElementById("quest-rank").textContent = rank.name;
    document.getElementById("quest-next-rank").textContent = nextRank
      ? `Siguiente: ${nextRank.name} · ${nextRank.xp - state.xp} XP`
      : "Rango máximo alcanzado";
    document.getElementById("quest-xp").textContent = `${state.xp} XP`;
    document.getElementById("quest-streak").textContent = `${streakNow()} ${streakNow() === 1 ? "día" : "días"}`;
    document.getElementById("quest-progress-label").textContent = `${progress}%`;
    document.getElementById("quest-progress-detail").textContent = `${completed} de ${missionList().length} misiones`;
    document.getElementById("quest-progress").style.width = `${progress}%`;
    document.querySelector(".quest-progress[role='progressbar']").setAttribute("aria-valuenow", String(progress));
    renderBadges();
    updateBosses();
  }

  function renderCourse() {
    document.title = `BI Quest | ${data.course.code}`;
    document.getElementById("course-code").textContent = data.course.code;
    document.getElementById("course-cycle").textContent = `${data.course.institution} · ${data.course.cycle}`;
    document.getElementById("course-period").textContent =
      `${data.course.period} · ${data.course.credits} créditos · ${data.course.hours} h`;
    document.getElementById("course-name").textContent = data.course.name;
    document.getElementById("course-teacher").textContent = data.course.teacher;
    document.getElementById("course-timezone").textContent = `Actividad en ${data.course.timezone}`;
  }

  function updateAll() {
    refreshDashboard();
    refreshWorlds();
    refreshSideQuest();
    refreshLibrary();
  }

  function resetProgress() {
    if (!window.confirm("¿Reiniciar todo el progreso de BI Quest? Esta acción no se puede deshacer.")) return;
    state = normalizeState(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("No se pudo eliminar el progreso guardado de BI Quest.", error);
      setSaveStatus("No se pudo borrar el progreso del navegador.", true);
    }
    persist();
    updateAll();
    document.querySelectorAll(".mission-details").forEach((details) => {
      details.hidden = true;
    });
    const first = document.querySelector("[data-mission-id='mission-1'] .mission-details");
    first.hidden = false;
    document.querySelector("[data-mission-toggle='mission-1']").setAttribute("aria-expanded", "true");
    showToast("Progreso reiniciado. ¡Tu aventura comienza de nuevo!", false);
  }

  async function start() {
    try {
      const response = await fetch("data/bi-quest.json");
      if (!response.ok) throw new Error(`No se pudo cargar el sílabo (HTTP ${response.status}).`);
      data = await response.json();
      if (!data.worlds?.length || !data.library?.length || !data.badges?.length) {
        throw new Error("El archivo de datos de BI Quest está incompleto.");
      }
      state = loadState();
      renderCourse();
      renderBosses();
      renderWorldMap();
      renderSideQuest();
      renderLibrary();
      document.getElementById("reset-progress").addEventListener("click", resetProgress);
      updateAll();
      window.setInterval(updateBosses, 1000);
    } catch (error) {
      console.error("No se pudo iniciar BI Quest.", error);
      const container = document.querySelector(".quest-content");
      container.replaceChildren(element("p", "quest-load-error", "No se pudo cargar el sílabo. Abre esta página desde el servidor del proyecto y vuelve a intentarlo."));
    }
  }

  start();
})();
