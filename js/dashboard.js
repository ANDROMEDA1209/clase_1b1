(function () {
  "use strict";

  const data = window.BIData;
  if (!data || !Array.isArray(data.sales) || data.sales.length === 0) {
    throw new Error("No se encontró el conjunto de ventas simulado para inicializar el dashboard.");
  }

  const PAGE_SIZE = 12;
  const PALETTE = ["#a99afa", "#6bd6ba", "#f1c879", "#82b4e8", "#ec91aa", "#83d5e5", "#c79de8", "#f39d73"];
  const chartInstances = new Map();
  const elements = {
    year: document.getElementById("filter-year"),
    month: document.getElementById("filter-month"),
    start: document.getElementById("filter-start"),
    end: document.getElementById("filter-end"),
    product: document.getElementById("filter-product"),
    category: document.getElementById("filter-category"),
    sector: document.getElementById("filter-sector"),
    payment: document.getElementById("filter-payment"),
    search: document.getElementById("table-search"),
    tableBody: document.getElementById("sales-table-body")
  };
  let currentPage = 1;
  let currentRows = [];

  const formatCurrency = (value) => new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
  const formatInteger = (value) => new Intl.NumberFormat("es-EC").format(value);
  const dateFormatter = new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

  function populateSelect(select, values, firstLabel, sortValues) {
    const sorted = sortValues ? [...values].sort((left, right) => left.localeCompare(right, "es")) : values;
    sorted.forEach((value) => {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = String(value);
      select.append(option);
    });
    select.options[0].textContent = firstLabel;
  }

  function initializeFilters() {
    const years = [...new Set(data.sales.map((sale) => sale.year))].sort((a, b) => a - b);
    const products = [...new Set(data.sales.map((sale) => sale.product))];
    const categories = [...new Set(data.sales.map((sale) => sale.category))];
    const sectors = [...new Set(data.sales.map((sale) => sale.sector))];
    const payments = [...new Set(data.sales.map((sale) => sale.paymentMethod))];
    populateSelect(elements.year, years, "Todos");
    populateSelect(elements.month, data.months, "Todos los meses");
    populateSelect(elements.product, products, "Todos los productos", true);
    populateSelect(elements.category, categories, "Todas las categorías", true);
    populateSelect(elements.sector, sectors, "Todos los sectores", true);
    populateSelect(elements.payment, payments, "Todos los métodos", true);
    [elements.year, elements.month, elements.product, elements.category, elements.sector, elements.payment]
      .forEach((select) => select.addEventListener("change", applyFilters));
    [elements.start, elements.end].forEach((input) => input.addEventListener("change", applyFilters));
    elements.search.addEventListener("input", () => {
      currentPage = 1;
      renderTable(currentRows);
    });
    document.getElementById("clear-filters").addEventListener("click", clearFilters);
    document.getElementById("prev-page").addEventListener("click", () => {
      currentPage = Math.max(1, currentPage - 1);
      renderTable(currentRows);
    });
    document.getElementById("next-page").addEventListener("click", () => {
      const pageCount = Math.max(1, Math.ceil(getSearchedRows(currentRows).length / PAGE_SIZE));
      currentPage = Math.min(pageCount, currentPage + 1);
      renderTable(currentRows);
    });
  }

  function getFilterValues() {
    return {
      year: elements.year.value,
      month: elements.month.value,
      start: elements.start.value,
      end: elements.end.value,
      product: elements.product.value,
      category: elements.category.value,
      sector: elements.sector.value,
      payment: elements.payment.value
    };
  }

  function matchesDimensions(sale, filters) {
    return (filters.year === "all" || String(sale.year) === filters.year) &&
      (filters.product === "all" || sale.product === filters.product) &&
      (filters.category === "all" || sale.category === filters.category) &&
      (filters.sector === "all" || sale.sector === filters.sector) &&
      (filters.payment === "all" || sale.paymentMethod === filters.payment);
  }

  function matchesSelectedPeriod(sale, filters) {
    if (!matchesDimensions(sale, filters)) return false;
    if (filters.month !== "all" && sale.month !== filters.month) return false;
    if (filters.start && sale.date < filters.start) return false;
    if (filters.end && sale.date > filters.end) return false;
    return true;
  }

  function dateScope(filters) {
    const dates = data.sales.map((sale) => sale.date).sort();
    let start = filters.start;
    let end = filters.end;

    if (filters.month !== "all") {
      const monthNumber = String(data.months.indexOf(filters.month) + 1).padStart(2, "0");
      const year = filters.year === "all" ? String(data.sales[0].year) : filters.year;
      const monthStart = `${year}-${monthNumber}-01`;
      const nextMonth = new Date(Date.UTC(Number(year), Number(monthNumber), 1));
      const monthEnd = new Date(nextMonth.getTime() - 86400000).toISOString().slice(0, 10);
      start = start && start > monthStart ? start : monthStart;
      end = end && end < monthEnd ? end : monthEnd;
    } else if (!start && !end && filters.year !== "all") {
      start = `${filters.year}-01-01`;
      end = `${filters.year}-12-31`;
    } else {
      start = start || dates[0];
      end = end || dates[dates.length - 1];
    }

    if (start && end && start > end) return null;
    return { start, end };
  }

  function previousPeriodRows(filters, scope) {
    if (!scope || !scope.start || !scope.end) return [];
    const startDate = new Date(`${scope.start}T00:00:00Z`);
    const endDate = new Date(`${scope.end}T00:00:00Z`);
    let previousStart;
    let previousEnd;
    if (filters.month !== "all" && !filters.start && !filters.end) {
      previousStart = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() - 1, 1));
      previousEnd = new Date(startDate.getTime() - 86400000);
    } else {
      const duration = Math.round((endDate - startDate) / 86400000) + 1;
      previousEnd = new Date(startDate.getTime() - 86400000);
      previousStart = new Date(previousEnd.getTime() - (duration - 1) * 86400000);
    }
    const start = previousStart.toISOString().slice(0, 10);
    const end = previousEnd.toISOString().slice(0, 10);
    return data.sales.filter((sale) =>
      matchesDimensions(sale, filters) && sale.date >= start && sale.date <= end
    );
  }

  function sum(rows, field) {
    return rows.reduce((total, row) => total + row[field], 0);
  }

  function groupBy(rows, field, valueField) {
    const groups = new Map();
    rows.forEach((row) => groups.set(row[field], (groups.get(row[field]) || 0) + row[valueField]));
    return groups;
  }

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function updateKPIs(rows, filters, scope) {
    const revenue = sum(rows, "revenue");
    const units = sum(rows, "quantity");
    const transactions = new Set(rows.map((row) => row.transactionNumber)).size;
    const previousRows = previousPeriodRows(filters, scope);
    const previousRevenue = sum(previousRows, "revenue");
    setText("kpi-revenue", formatCurrency(revenue));
    setText("kpi-units", formatInteger(units));
    setText("kpi-transactions", formatInteger(transactions));
    setText("kpi-ticket", transactions ? formatCurrency(revenue / transactions) : formatCurrency(0));

    const change = document.getElementById("kpi-revenue-change");
    if (previousRows.length && previousRevenue > 0) {
      const percentage = ((revenue - previousRevenue) / previousRevenue) * 100;
      change.textContent = `${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%`;
      change.className = `change-chip ${percentage > 0 ? "" : percentage < 0 ? "negative" : "neutral"}`.trim();
    } else {
      change.textContent = "Sin periodo previo";
      change.className = "change-chip neutral";
    }

    const productUnits = groupBy(rows, "product", "quantity");
    const bestProduct = [...productUnits.entries()].sort((a, b) => b[1] - a[1])[0];
    setText("kpi-product", bestProduct ? bestProduct[0] : "—");
    const monthRevenue = groupBy(rows, "month", "revenue");
    const bestMonth = [...monthRevenue.entries()].sort((a, b) => b[1] - a[1])[0];
    setText("kpi-best-month", bestMonth ? bestMonth[0] : "—");
    const sectorRevenue = groupBy(rows, "sector", "revenue");
    const bestSector = [...sectorRevenue.entries()].sort((a, b) => b[1] - a[1])[0];
    setText("kpi-best-sector", bestSector ? bestSector[0] : "—");
    const paymentRevenue = groupBy(rows, "paymentMethod", "revenue");
    const bestPayment = [...paymentRevenue.entries()].sort((a, b) => b[1] - a[1])[0];
    setText("kpi-best-payment", bestPayment ? bestPayment[0] : "—");

    const records = rows.length;
    setText("records-count", `${formatInteger(records)} registros`);
  }

  function aggregateMonths(rows, filters) {
    const months = data.months.map((month) => ({ month, revenue: 0, units: 0 }));
    const values = new Map(months.map((item) => [item.month, item]));
    rows.forEach((sale) => {
      const month = values.get(sale.month);
      if (month) {
        month.revenue += sale.revenue;
        month.units += sale.quantity;
      }
    });
    if (filters.year === "all") return months;
    return months;
  }

  function chartOptions(formatter, horizontal) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? "y" : "x",
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0b1220",
          borderColor: "rgba(185,199,222,.18)",
          borderWidth: 1,
          titleColor: "#e9edf6",
          bodyColor: "#bdc7d8",
          padding: 10,
          callbacks: { label: (context) => `${context.dataset.label || ""}: ${formatter(context.parsed[horizontal ? "x" : "y"] ?? context.raw)}` }
        }
      },
      scales: {
        x: { grid: { color: "rgba(185,199,222,.07)" }, ticks: { color: "#8996ad", font: { size: 9 } }, border: { display: false } },
        y: { grid: { color: "rgba(185,199,222,.07)" }, ticks: { color: "#8996ad", font: { size: 9 } }, border: { display: false } }
      }
    };
  }

  function drawChart(id, config) {
    if (typeof window.Chart !== "function") {
      const canvas = document.getElementById(id);
      canvas.insertAdjacentHTML("afterend", '<p class="chart-error">No se pudo cargar la librería de gráficos. Comprueba la conexión e inténtalo de nuevo.</p>');
      return;
    }
    if (chartInstances.has(id)) chartInstances.get(id).destroy();
    chartInstances.set(id, new window.Chart(document.getElementById(id), config));
  }

  function updateCharts(rows, filters) {
    const monthly = aggregateMonths(rows, filters);
    const revenueChartOptions = chartOptions(formatCurrency, false);
    revenueChartOptions.plugins.legend = { display: true, labels: { color: "#aab5c7", boxWidth: 8, boxHeight: 8, usePointStyle: true, font: { size: 9 } } };
    revenueChartOptions.scales.y.ticks.callback = (value) => `$${formatInteger(value)}`;
    revenueChartOptions.scales.y.beginAtZero = true;
    revenueChartOptions.scales.y2 = { position: "right", grid: { drawOnChartArea: false }, ticks: { color: "#8996ad", font: { size: 9 } }, border: { display: false }, beginAtZero: true };
    revenueChartOptions.plugins.tooltip.callbacks.label = (context) => context.dataset.label === "Unidades"
      ? `Unidades: ${formatInteger(context.parsed.y)}`
      : `Ingresos: ${formatCurrency(context.parsed.y)}`;
    drawChart("monthly-chart", {
      type: "line",
      data: {
        labels: monthly.map((item) => item.month.slice(0, 3)),
        datasets: [
          { label: "Ingresos", data: monthly.map((item) => Number(item.revenue.toFixed(2))), borderColor: "#a99afa", backgroundColor: "rgba(169,154,250,.13)", fill: true, tension: .36, pointRadius: 3, pointHoverRadius: 5, yAxisID: "y" },
          { label: "Unidades", data: monthly.map((item) => item.units), borderColor: "#6bd6ba", backgroundColor: "#6bd6ba", tension: .36, pointRadius: 2, pointHoverRadius: 4, yAxisID: "y2" }
        ]
      },
      options: revenueChartOptions
    });

    const categories = [...groupBy(rows, "category", "revenue").entries()].sort((a, b) => b[1] - a[1]);
    drawChart("category-chart", {
      type: "doughnut",
      data: { labels: categories.map(([name]) => name), datasets: [{ data: categories.map(([, value]) => value), backgroundColor: PALETTE.slice(0, categories.length), borderColor: "#172238", borderWidth: 3, hoverOffset: 5 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0b1220",
            borderColor: "rgba(185,199,222,.18)",
            borderWidth: 1,
            titleColor: "#e9edf6",
            bodyColor: "#bdc7d8",
            padding: 10,
            callbacks: { label: (context) => `${context.label}: ${formatCurrency(context.raw)}` }
          }
        }
      }
    });
    const categoryLegend = document.getElementById("category-legend");
    categoryLegend.replaceChildren();
    categories.forEach(([name, value], index) => {
      const item = document.createElement("span");
      const dot = document.createElement("i");
      dot.style.backgroundColor = PALETTE[index];
      item.append(dot, document.createTextNode(`${name} · ${rows.length ? Math.round((value / sum(rows, "revenue")) * 100) : 0}%`));
      categoryLegend.append(item);
    });

    const productUnits = [...groupBy(rows, "product", "quantity").entries()].sort((a, b) => b[1] - a[1]);
    const productOptions = chartOptions(formatInteger, true);
    productOptions.scales.x.beginAtZero = true;
    drawChart("product-chart", {
      type: "bar",
      data: { labels: productUnits.map(([name]) => name), datasets: [{ label: "Unidades", data: productUnits.map(([, value]) => value), backgroundColor: PALETTE[0], borderRadius: 4, maxBarThickness: 22 }] },
      options: productOptions
    });

    const sectorRevenue = [...groupBy(rows, "sector", "revenue").entries()].sort((a, b) => b[1] - a[1]);
    const sectorOptions = chartOptions(formatCurrency, true);
    sectorOptions.scales.x.beginAtZero = true;
    sectorOptions.scales.x.ticks.callback = (value) => `$${formatInteger(value)}`;
    drawChart("sector-chart", {
      type: "bar",
      data: { labels: sectorRevenue.map(([name]) => name), datasets: [{ label: "Ingresos", data: sectorRevenue.map(([, value]) => Number(value.toFixed(2))), backgroundColor: PALETTE[1], borderRadius: 4, maxBarThickness: 18 }] },
      options: sectorOptions
    });

    const paymentRevenue = [...groupBy(rows, "paymentMethod", "revenue").entries()].sort((a, b) => b[1] - a[1]);
    const paymentOptions = chartOptions(formatCurrency, true);
    paymentOptions.scales.x.beginAtZero = true;
    paymentOptions.scales.x.ticks.callback = (value) => `$${formatInteger(value)}`;
    drawChart("payment-chart", {
      type: "bar",
      data: { labels: paymentRevenue.map(([name]) => name), datasets: [{ label: "Ingresos", data: paymentRevenue.map(([, value]) => Number(value.toFixed(2))), backgroundColor: PALETTE[2], borderRadius: 4, maxBarThickness: 18 }] },
      options: paymentOptions
    });
  }

  function renderInsights(rows) {
    const container = document.getElementById("auto-insights");
    container.replaceChildren();
    if (!rows.length) {
      const message = document.createElement("p");
      message.className = "activity-prompt";
      message.textContent = "No hay ventas que coincidan. Amplía las fechas o limpia algunos filtros para volver a analizar el caso.";
      container.append(message);
      return;
    }
    const monthlyByRevenue = [...groupBy(rows, "month", "revenue").entries()].sort((a, b) => b[1] - a[1]);
    const monthlyByLowRevenue = [...monthlyByRevenue].sort((a, b) => a[1] - b[1]);
    const productUnits = [...groupBy(rows, "product", "quantity").entries()].sort((a, b) => b[1] - a[1]);
    const sectorRevenue = [...groupBy(rows, "sector", "revenue").entries()].sort((a, b) => b[1] - a[1]);
    const categoryRevenue = [...groupBy(rows, "category", "revenue").entries()].sort((a, b) => b[1] - a[1]);
    const totalRevenue = sum(rows, "revenue");
    const insights = [
      { icon: "⌁", text: `<strong>${monthlyByRevenue[0][0]}</strong> es el mejor mes (<strong>${formatCurrency(monthlyByRevenue[0][1])}</strong>) y <strong>${monthlyByLowRevenue[0][0]}</strong> el más bajo (<strong>${formatCurrency(monthlyByLowRevenue[0][1])}</strong>) en la selección.` },
      { icon: "✦", text: `<strong>${productUnits[0][0]}</strong> lidera en unidades con <strong>${formatInteger(productUnits[0][1])}</strong> (${Math.round((productUnits[0][1] / sum(rows, "quantity")) * 100)}% del volumen).` },
      { icon: "↗", text: `<strong>${sectorRevenue[0][0]}</strong> aporta <strong>${Math.round((sectorRevenue[0][1] / totalRevenue) * 100)}%</strong> de los ingresos; ${categoryRevenue[0][0].toLowerCase()} es la categoría de mayor aporte.` }
    ];
    insights.forEach((insight) => {
      const article = document.createElement("article");
      article.className = "auto-insight";
      article.innerHTML = `<span>${insight.icon}</span><p>${insight.text}</p>`;
      container.append(article);
    });
  }

  function getSearchedRows(rows) {
    const query = elements.search.value.trim().toLocaleLowerCase("es");
    if (!query) return rows;
    return rows.filter((sale) => [
      sale.transactionNumber, sale.date, sale.product, sale.category, sale.sector, sale.paymentMethod
    ].some((value) => String(value).toLocaleLowerCase("es").includes(query)));
  }

  function renderTable(rows) {
    const searchedRows = getSearchedRows(rows);
    const pageCount = Math.max(1, Math.ceil(searchedRows.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, pageCount);
    const visibleRows = searchedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    elements.tableBody.replaceChildren();
    if (visibleRows.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 9;
      cell.textContent = "No hay transacciones que coincidan con tu selección.";
      row.append(cell);
      elements.tableBody.append(row);
    } else {
      visibleRows.forEach((sale) => {
        const row = document.createElement("tr");
        const cells = [
          sale.transactionNumber,
          dateFormatter.format(new Date(`${sale.date}T00:00:00Z`)),
          sale.product,
          sale.category,
          sale.sector,
          formatInteger(sale.quantity),
          formatCurrency(sale.unitPrice),
          formatCurrency(sale.revenue),
          sale.paymentMethod
        ];
        cells.forEach((value, index) => {
          const cell = document.createElement("td");
          if (index === 0) cell.textContent = value;
          else if (index === 3) {
            const pill = document.createElement("span");
            pill.className = "product-pill";
            pill.textContent = value;
            cell.append(pill);
          } else cell.textContent = value;
          row.append(cell);
        });
        elements.tableBody.append(row);
      });
    }
    setText("table-count", `${formatInteger(searchedRows.length)} registros${elements.search.value.trim() ? " encontrados" : ""}`);
    setText("page-label", `${currentPage} / ${pageCount}`);
    document.getElementById("prev-page").disabled = currentPage <= 1;
    document.getElementById("next-page").disabled = currentPage >= pageCount;
    setText("table-caption", `${formatInteger(searchedRows.length)} transacciones para los filtros seleccionados`);
  }

  function clearFilters() {
    [elements.year, elements.month, elements.product, elements.category, elements.sector, elements.payment]
      .forEach((select) => { select.value = "all"; });
    elements.start.value = "";
    elements.end.value = "";
    elements.search.value = "";
    applyFilters();
  }

  function applyFilters() {
    currentPage = 1;
    const filters = getFilterValues();
    const scope = dateScope(filters);
    const rows = scope
      ? data.sales.filter((sale) => matchesSelectedPeriod(sale, filters))
      : [];
    currentRows = rows;
    updateKPIs(rows, filters, scope);
    updateCharts(rows, filters);
    renderInsights(rows);
    renderTable(rows);

    const recordsLabel = document.getElementById("records-count");
    if (!scope) recordsLabel.textContent = "Rango de fechas inválido";
  }

  initializeFilters();
  applyFilters();
})();
