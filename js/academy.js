(function () {
  "use strict";

  const activities = {
    chart: {
      category: "RETO 01 · FUNDAMENTOS",
      title: "¿Cómo contarías esta tendencia?",
      prompt: "El equipo quiere comparar los ingresos de cada mes y detectar si suben o bajan con el tiempo. ¿Qué visualización ayuda mejor a ver esa evolución?",
      context: "Ingresos mensuales de enero a diciembre",
      options: ["Gráfico de líneas", "Gráfico circular", "Tarjeta KPI", "Tabla sin ordenar"],
      correct: 0,
      explanation: "La línea muestra el cambio a través del tiempo y permite detectar tendencia, picos y caídas entre meses.",
      xp: 100
    },
    etl: {
      category: "RETO 02 · ETL",
      title: "Construye el flujo ETL.",
      prompt: "Selecciona las etapas en el orden en que se prepara la información: primero se obtiene de las fuentes, luego se deja lista y finalmente se almacena.",
      context: "Toca cada etapa para añadirla a la secuencia",
      order: ["Extraer", "Transformar", "Cargar"],
      choices: ["Cargar", "Extraer", "Transformar"],
      explanation: "ETL significa Extract, Transform, Load: extraer los datos, transformarlos para asegurar calidad y cargarlos en el destino analítico.",
      xp: 120
    },
    kpi: {
      category: "RETO 03 · KPI",
      title: "Lee el indicador antes de actuar.",
      prompt: "Esta semana el ticket promedio subió 12%, pero el número de transacciones cayó 15%. ¿Cuál es la lectura más responsable?",
      context: "Ticket promedio <strong>+12%</strong> &nbsp;·&nbsp; Transacciones <strong>−15%</strong>",
      options: ["El negocio está mejor en todo; no hace falta revisar", "Se gasta más por compra, pero llegan menos compras; investiga el volumen", "El ingreso total necesariamente creció 12%", "El ticket promedio y los ingresos son el mismo KPI"],
      correct: 1,
      explanation: "Un KPI necesita contexto. El ticket promedio crece, pero menos transacciones pueden compensar o superar esa mejora; revisa el ingreso total y el tráfico.",
      xp: 100
    },
    decision: {
      category: "RETO 04 · DECISIONES",
      title: "Primero diagnostica; después invierte.",
      prompt: "En Urdesa bajaron las ventas durante dos semanas, mientras los demás sectores se mantienen estables. ¿Qué harías antes de ampliar los descuentos?",
      context: "URDESA <strong>−15%</strong> &nbsp;·&nbsp; Otros sectores <strong>estable</strong>",
      options: ["Aplicar un descuento a todos los productos en toda la ciudad", "Comparar horarios, mezcla de productos y afluencia en Urdesa", "Dejar de vender en Urdesa inmediatamente", "Aumentar precios en los sectores estables"],
      correct: 1,
      explanation: "Segmentar por sector, horario y producto puede revelar la causa. Luego se prueba una acción acotada y se mide su efecto.",
      xp: 130
    },
    sales: {
      category: "RETO 05 · CASO NUBE DE AZÚCAR",
      title: "Encuentra el sector líder.",
      prompt: "Con las ventas simuladas de todo 2025, ¿qué sector generó más ingresos? Suma los ingresos del caso para elegir una prioridad comercial basada en evidencia.",
      context: "Caso simulado · ventas del 1 de enero al 31 de diciembre de 2025",
      options: [],
      correct: 0,
      explanation: "",
      xp: 160
    }
  };

  const challengeOrder = Object.keys(activities);
  const panel = document.getElementById("activity-panel");
  const content = document.getElementById("activity-content");
  const feedback = document.getElementById("activity-feedback");
  const tabs = [...document.querySelectorAll(".challenge-tab")];
  let currentChallenge = "chart";
  let etlSelection = [];

  function getSalesLeader() {
    const totals = new Map();
    window.BIData.sales.forEach((sale) => {
      totals.set(sale.sector, (totals.get(sale.sector) || 0) + sale.revenue);
    });
    return [...totals.entries()].sort((left, right) => right[1] - left[1])[0][0];
  }

  const salesLeader = getSalesLeader();
  const salesActivity = activities.sales;
  const sectorOptions = [...new Set(window.BIData.sales.map((sale) => sale.sector))].sort();
  salesActivity.options = sectorOptions;
  salesActivity.correct = sectorOptions.indexOf(salesLeader);
  salesActivity.explanation = `${salesLeader} lidera los ingresos simulados del año completo. Para convertir ese dato en una acción, compara también el margen, la capacidad del local y la evolución mensual del sector.`;

  function refreshProgress() {
    const snapshot = window.BIGamification.getSnapshot();
    const progressBar = document.querySelector(".progress-track");
    document.getElementById("learner-level").textContent = snapshot.level.name;
    document.getElementById("learner-xp").textContent = `${snapshot.xp} XP acumulados`;
    document.getElementById("level-step").textContent = `NIVEL ${snapshot.level.number}`;
    document.getElementById("level-progress").style.width = `${snapshot.totalProgress}%`;
    progressBar.setAttribute("aria-valuenow", String(snapshot.totalProgress));
    document.getElementById("progress-caption").textContent = `${snapshot.totalProgress}% de la ruta completada`;
    document.getElementById("next-level-caption").textContent = snapshot.level.number === 3
      ? "Nivel máximo alcanzado"
      : `Siguiente: ${snapshot.level.number === 1 ? "Analista" : "Experto"}`;
    document.getElementById("streak-count").textContent = `Racha de ${snapshot.streak}`;
    document.getElementById("badge-count").textContent = `${snapshot.badges.length} desbloqueadas`;

    const preview = document.getElementById("badge-preview");
    preview.replaceChildren();
    const earnedIds = new Set(snapshot.badges.map((badge) => badge.id));
    Object.entries(snapshot.badgeCatalog).forEach(([id, badge]) => {
      const item = document.createElement("span");
      item.textContent = earnedIds.has(id) ? badge.icon : "◇";
      item.title = earnedIds.has(id) ? badge.label : "Insignia por desbloquear";
      if (earnedIds.has(id)) item.classList.add("earned");
      preview.append(item);
    });

    document.getElementById("challenge-completed").textContent = `${snapshot.completedCount} de 5 completados`;
    document.getElementById("challenge-progress").style.width = `${snapshot.totalProgress}%`;
    tabs.forEach((tab) => {
      const done = window.BIGamification.isCompleted(tab.dataset.challenge);
      tab.classList.toggle("completed", done);
      tab.querySelector(".challenge-state").textContent = done ? "✓" : String(challengeOrder.indexOf(tab.dataset.challenge) + 1).padStart(2, "0");
    });

    const allDone = snapshot.completedCount === snapshot.totalChallenges;
    const results = document.getElementById("resultados");
    results.hidden = !allDone;
    if (allDone) {
      document.getElementById("results-xp").textContent = String(snapshot.xp);
      document.getElementById("results-level").textContent = snapshot.level.name;
      document.getElementById("results-badges").textContent = String(snapshot.badges.length);
      document.getElementById("results-badge-list").textContent = snapshot.badges.length
        ? `Logros obtenidos: ${snapshot.badges.map((badge) => badge.label).join(" · ")}`
        : "Sigue practicando para desbloquear tus primeras insignias.";
      document.getElementById("results-summary").textContent = `Completaste los cinco retos con una mejor racha de ${snapshot.bestStreak}.`;
      document.getElementById("results-recommendation").textContent = snapshot.xp >= 500
        ? "Siguiente paso recomendado: vuelve al dashboard, filtra un sector y comunica un hallazgo con contexto."
        : "Siguiente paso recomendado: vuelve a revisar los conceptos y practica la lectura de indicadores antes de proponer acciones.";
    }
  }

  function setFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = `activity-feedback${type ? ` ${type}` : ""}`;
  }

  function addNextButton() {
    if (content.querySelector(".activity-next")) return;
    const next = challengeOrder.find((id) => !window.BIGamification.isCompleted(id));
    const wrapper = document.createElement("div");
    wrapper.className = "activity-next";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-primary";
    button.textContent = next ? "Continuar al siguiente reto →" : "Ver resultados →";
    button.addEventListener("click", () => {
      if (next) selectChallenge(next);
      else document.getElementById("resultados").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    wrapper.append(button);
    content.append(wrapper);
  }

  function renderCompleted(activity) {
    content.innerHTML = `<h3 class="activity-title">${activity.title}</h3><p class="activity-prompt">${activity.explanation}</p><div class="activity-context"><strong>✓ Reto completado</strong><span>El progreso ya está guardado en este navegador.</span></div>`;
    setFeedback("Este reto ya sumó sus puntos. Puedes volver a practicarlo sin duplicar XP.", "success");
    addNextButton();
  }

  function rewardCorrect(activity) {
    const result = window.BIGamification.complete(currentChallenge, activity.xp);
    refreshProgress();
    setFeedback(
      `¡Correcto! ${activity.explanation} +${result.xpEarned} XP.${result.newBadges.length ? ` Insignia desbloqueada: ${result.newBadges.join(", ")}.` : ""}`,
      "success"
    );
    addNextButton();
  }

  function renderMultipleChoice(activity) {
    const prompt = document.createElement("p");
    prompt.className = "activity-prompt";
    prompt.textContent = activity.prompt;
    content.append(prompt);

    const context = document.createElement("div");
    context.className = "activity-context";
    const label = document.createElement("span");
    label.textContent = activity.context;
    context.append(label);
    if (currentChallenge === "chart") {
      const totals = window.BIData.months.map((month) => window.BIData.sales
        .filter((sale) => sale.month === month)
        .reduce((sum, sale) => sum + sale.revenue, 0));
      const max = Math.max(...totals);
      const chart = document.createElement("span");
      chart.className = "sparkline";
      chart.setAttribute("aria-label", "Ventas por mes en una vista previa");
      totals.forEach((total) => {
        const bar = document.createElement("i");
        bar.style.height = `${Math.max(12, Math.round((total / max) * 34))}px`;
        chart.append(bar);
      });
      context.append(chart);
    }
    content.append(context);

    const options = document.createElement("div");
    options.className = "answer-options";
    activity.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-option";
      button.textContent = option;
      button.addEventListener("click", () => {
        if (button.disabled || window.BIGamification.isCompleted(currentChallenge)) return;
        if (index === activity.correct) {
          options.querySelectorAll("button").forEach((choice) => {
            choice.disabled = true;
            if (choice === button) choice.classList.add("correct");
          });
          rewardCorrect(activity);
        } else {
          button.disabled = true;
          button.classList.add("incorrect");
          window.BIGamification.recordIncorrect();
          refreshProgress();
          setFeedback("No exactamente. Revisa qué está midiendo cada opción y prueba otra respuesta.", "error");
        }
      });
      options.append(button);
    });
    content.append(options);
  }

  function renderETL(activity) {
    const prompt = document.createElement("p");
    prompt.className = "activity-prompt";
    prompt.textContent = activity.prompt;
    content.append(prompt);
    const context = document.createElement("div");
    context.className = "activity-context";
    context.innerHTML = "<span>Etapas en orden:</span>";
    content.append(context);
    const sequence = document.createElement("p");
    sequence.className = "etl-order";
    sequence.textContent = etlSelection.length
      ? `Tu secuencia: ${etlSelection.join(" → ")}`
      : "Aún no has seleccionado etapas.";
    content.append(sequence);
    const list = document.createElement("div");
    list.className = "etl-sort-list";
    activity.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `etl-sort-button${etlSelection.includes(choice) ? " selected" : ""}`;
      button.textContent = choice;
      button.disabled = etlSelection.includes(choice);
      button.addEventListener("click", () => {
        if (etlSelection.length < activity.order.length) {
          etlSelection.push(choice);
          renderActivityControls();
          if (etlSelection.length === activity.order.length) {
            const isCorrect = etlSelection.every((step, index) => step === activity.order[index]);
            if (isCorrect) {
              rewardCorrect(activity);
            } else {
              window.BIGamification.recordIncorrect();
              refreshProgress();
              setFeedback("El orden no es correcto. En ETL primero se obtienen los datos; revisa las etapas y vuelve a intentarlo.", "error");
              etlSelection = [];
              renderActivityControls();
            }
          }
        }
      });
      list.append(button);
    });
    content.append(list);
    const actions = document.createElement("div");
    actions.className = "etl-actions";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "button button-outline";
    clear.textContent = "Reiniciar orden";
    clear.addEventListener("click", () => {
      etlSelection = [];
      setFeedback("", "");
      renderActivityControls();
    });
    actions.append(clear);
    content.append(actions);
  }

  function renderActivityControls() {
    const activity = activities[currentChallenge];
    content.replaceChildren();
    const title = document.createElement("h3");
    title.className = "activity-title";
    title.textContent = activity.title;
    content.append(title);
    if (currentChallenge === "etl") renderETL(activity);
    else renderMultipleChoice(activity);
  }

  function renderActivity() {
    const activity = activities[currentChallenge];
    panel.querySelector(".activity-category").textContent = activity.category;
    panel.querySelector(".xp-chip").textContent = `✦ +${activity.xp} XP`;
    content.replaceChildren();
    etlSelection = [];
    if (window.BIGamification.isCompleted(currentChallenge)) {
      renderCompleted(activity);
      return;
    }
    setFeedback("", "");
    renderActivityControls();
  }

  function selectChallenge(id) {
    currentChallenge = id;
    tabs.forEach((tab) => {
      const active = tab.dataset.challenge === id;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    renderActivity();
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => selectChallenge(tab.dataset.challenge)));
  document.getElementById("restart-learning").addEventListener("click", () => {
    const next = challengeOrder.find((id) => !window.BIGamification.isCompleted(id)) || "chart";
    selectChallenge(next);
    document.getElementById("retos").scrollIntoView({ behavior: "smooth" });
  });

  refreshProgress();
  const firstIncomplete = challengeOrder.find((id) => !window.BIGamification.isCompleted(id));
  if (firstIncomplete) selectChallenge(firstIncomplete);
  else {
    selectChallenge("chart");
    document.getElementById("resultados").hidden = false;
  }
})();
