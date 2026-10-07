const firebaseConfig = {
  apiKey: "AIzaSyAxXSyMv4Jc6tyX5UwcF76f-JcbT1lqIoc",
  authDomain: "clima-f5f62.firebaseapp.com",
  projectId: "clima-f5f62",
  storageBucket: "clima-f5f62.firebasestorage.app",
  messagingSenderId: "807535958608",
  appId: "1:807535958608:web:f1ab8992db1f0304708f55"
};

const API_BASE_URL = String(window.AGROCLIMA_API_BASE || "").replace(/\/+$/, "");
function apiPath(path) { return API_BASE_URL ? API_BASE_URL + path : path; }
async function apiHeaders() {
  const headers = { Accept: "application/geo+json, application/json" };
  if (currentUser && typeof currentUser.getIdToken === "function") {
    headers.Authorization = "Bearer " + await currentUser.getIdToken();
  }
  return headers;
}

const $ = function (selector, root) { return (root || document).querySelector(selector); };
const $$ = function (selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
const escapeHtml = function (value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
};
const now = function () { return new Date(); };
const pad = function (value) { return String(value).padStart(2, "0"); };
const todayISO = function () {
  const date = now();
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
};
const localTime = function () { return pad(now().getHours()) + ":" + pad(now().getMinutes()); };
const dateFromISO = function (value) {
  if (!value) return null;
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return new Date(value);
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
};
const formatDate = function (value, options) {
  const date = dateFromISO(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", options || { day: "2-digit", month: "short", year: "numeric" }).format(date);
};
const formatShortDate = function (value) { return formatDate(value, { day: "2-digit", month: "short" }); };
const toNumber = function (value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const round = function (value, digits) {
  if (!Number.isFinite(value)) return "—";
  const multiplier = Math.pow(10, digits == null ? 1 : digits);
  return String(Math.round(value * multiplier) / multiplier);
};
const initials = function (name) {
  const words = String(name || "AgroClima").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(function (word) { return word[0].toUpperCase(); }).join("");
};
const keyFromStorage = function (name) {
  try { return sessionStorage.getItem(name) || ""; } catch (_) { return ""; }
};

let app, auth, db;
let initializeApp, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword;
let signOut, onAuthStateChanged, updateProfile, getFirestore, collection, doc, getDoc;
let getDocs, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp, setDoc;
let firebaseReadyPromise = null;
let currentUser = null;
let currentProfile = null;
let demoMode = false;
let firebaseProblem = "";
let observations = [];
let alerts = [];
let registeredUsers = [];
let observationChart = null;
let historyChart = null;
let forecastChart = null;
let chartLibPromise = null;
let editingObservationId = null;
let editingAlertId = null;
let pendingConfirmAction = null;
let currentSourceTab = "manual";
let importedReading = null;
let senamhiStations = [];
let forecastDaily = [];
let forecastHourly = [];
let googleConfigured = false;
let weatherLat = Number(keyFromStorage("agroclima_weather_lat") || "-12.84");
let weatherLon = Number(keyFromStorage("agroclima_weather_lon") || "-74.57");
let weatherPlace = keyFromStorage("agroclima_weather_place") || "Acobamba · Huancavelica";
let usingCurrentLocation = false;
let activeRoute = "dashboard";

const DEMO_OBSERVATIONS = [
  { id: "demo-o1", date: "2026-09-12", time: "07:00", location: "Parcela norte", temperature: 23.8, rainfall: 1.3, humidity: 78, windSpeed: 8, sky: "Llovizna", crop: "Papa", notes: "Lectura de demostración.", source: "manual", createdBy: "demo_user", createdByName: "María Quispe" },
  { id: "demo-o2", date: "2026-09-06", time: "07:10", location: "Huerto familiar", temperature: 24.2, rainfall: 2.8, humidity: 81, windSpeed: 6, sky: "Parcialmente nublado", crop: "Maíz", notes: "Lectura de demostración.", source: "manual", createdBy: "demo_user", createdByName: "María Quispe" },
  { id: "demo-o3", date: "2026-09-01", time: "06:50", location: "Sector bajo", temperature: 25.4, rainfall: 0, humidity: 71, windSpeed: 9, sky: "Despejado", crop: "Papa", notes: "Lectura de demostración.", source: "manual", createdBy: "demo_user", createdByName: "Joel Escobar" },
  { id: "demo-o4", date: "2026-08-28", time: "07:00", location: "Sector bajo", temperature: 24.4, rainfall: 0.8, humidity: 76, windSpeed: 7, sky: "Parcialmente nublado", crop: "Maíz", notes: "Lectura de demostración.", source: "manual", createdBy: "demo_user", createdByName: "María Quispe" },
  { id: "demo-o5", date: "2026-08-20", time: "07:15", location: "Parcela norte", temperature: 23.7, rainfall: 1.9, humidity: 82, windSpeed: 6, sky: "Llovizna", crop: "Papa", notes: "Lectura de demostración.", source: "manual", createdBy: "demo_user", createdByName: "Joel Escobar" },
  { id: "demo-o6", date: "2026-08-12", time: "06:55", location: "Huerto familiar", temperature: 22.3, rainfall: 4.4, humidity: 85, windSpeed: 5, sky: "Lluvia", crop: "Maíz", notes: "Lectura de demostración.", source: "manual", createdBy: "demo_user", createdByName: "María Quispe" },
  { id: "demo-o7", date: "2026-08-07", time: "07:05", location: "Parcela norte", temperature: 24.5, rainfall: 0.5, humidity: 72, windSpeed: 8, sky: "Despejado", crop: "Papa", notes: "Lectura de demostración.", source: "manual", createdBy: "demo_user", createdByName: "Joel Escobar" },
  { id: "demo-o8", date: "2026-08-02", time: "07:00", location: "Sector bajo", temperature: 23.4, rainfall: 1.1, humidity: 80, windSpeed: 7, sky: "Nublado", crop: "Maíz", notes: "Lectura de demostración.", source: "manual", createdBy: "demo_user", createdByName: "María Quispe" }
];
const DEMO_ALERTS = [
  { id: "demo-a1", date: "2026-09-12", title: "Lluvia acumulada en la jornada", type: "Lluvia", severity: "preventiva", status: "activa", location: "Parcela norte", message: "Se registró lluvia durante la mañana.", recommendation: "Revisar el drenaje antes de iniciar labores.", createdBy: "demo_user", createdByName: "María Quispe" },
  { id: "demo-a2", date: "2026-09-06", title: "Temperatura elevada al mediodía", type: "Temperatura", severity: "informativa", status: "resuelta", location: "Sector bajo", message: "La lectura de mediodía superó el promedio semanal.", recommendation: "Mantener observación en las próximas jornadas.", createdBy: "demo_user", createdByName: "Joel Escobar" },
  { id: "demo-a3", date: "2026-08-29", title: "Llovizna persistente", type: "Lluvia", severity: "alta", status: "activa", location: "Huerto familiar", message: "Se observó precipitación continua por varias horas.", recommendation: "Evitar ingresar a la parcela hasta revisar el suelo.", createdBy: "demo_user", createdByName: "María Quispe" },
  { id: "demo-a4", date: "2026-08-20", title: "Humedad del suelo en descenso", type: "Otro", severity: "preventiva", status: "resuelta", location: "Parcela norte", message: "El suelo superficial se observó más seco.", recommendation: "Volver a revisar al inicio de la siguiente jornada.", createdBy: "demo_user", createdByName: "Joel Escobar" }
];

function setConnectionState(state, label) {
  const status = $("#firebaseConnection");
  if (!status) return;
  status.classList.remove("is-demo", "is-offline");
  if (state === "demo") status.classList.add("is-demo");
  if (state === "offline") status.classList.add("is-offline");
  status.querySelector("span:last-child").textContent = label;
  const mode = $("#modeLabel");
  if (mode) {
    mode.textContent = state === "demo" ? "MODO DEMOSTRACIÓN" : state === "offline" ? "REVISAR CONEXIÓN" : "CUADERNO ACTIVO";
    mode.classList.toggle("is-demo", state === "demo");
  }
}

function showToast(message, kind) {
  const region = $("#toastRegion");
  const item = document.createElement("div");
  item.className = "toast" + (kind === "error" ? " toast-error" : "");
  item.innerHTML = '<span class="toast-icon">' + (kind === "error" ? "!" : "✓") + '</span><span>' + escapeHtml(message) + "</span>";
  region.appendChild(item);
  window.setTimeout(function () { item.remove(); }, 4600);
}

function showModal(id) {
  const dialog = document.getElementById(id);
  if (dialog && !dialog.open) dialog.showModal();
}
function closeModal(id) {
  const dialog = document.getElementById(id);
  if (dialog && dialog.open) dialog.close();
}

function loadChartLibrary() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartLibPromise) return chartLibPromise;
  chartLibPromise = new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js";
    script.async = true;
    script.onload = function () { resolve(window.Chart); };
    script.onerror = function () { reject(new Error("No se pudo cargar el componente de gráficos.")); };
    document.head.appendChild(script);
  });
  return chartLibPromise;
}

function showAuth() {
  $("#authView").classList.remove("is-hidden");
  $("#appView").classList.add("is-hidden");
}
function showApplication() {
  $("#authView").classList.add("is-hidden");
  $("#appView").classList.remove("is-hidden");
  renderAll();
  showRoute(activeRoute);
}
function getUserDisplayName() {
  if (currentProfile && currentProfile.displayName) return currentProfile.displayName;
  if (currentUser && currentUser.displayName) return currentUser.displayName;
  if (currentUser && currentUser.email) return currentUser.email.split("@")[0];
  return "Observador de campo";
}
function canManage(record) {
  return demoMode || (currentProfile && currentProfile.role === "admin") || !!(currentUser && record && record.createdBy === currentUser.uid);
}
function isAdmin() { return !!(currentProfile && currentProfile.role === "admin"); }
function canDeleteRecords() { return !demoMode && isAdmin(); }

function showRoute(route) {
  const names = { dashboard: "Resumen", observations: "Observaciones", history: "Histórico", forecast: "Pronóstico", alerts: "Alertas manuales", admin: "Administración" };
  if (!names[route] || (route === "admin" && (!isAdmin() || demoMode))) route = "dashboard";
  activeRoute = route;
  $$(".page-section").forEach(function (section) { section.classList.add("is-hidden"); });
  $("#page-" + route).classList.remove("is-hidden");
  $("#currentSection").textContent = names[route];
  $$(".nav-link").forEach(function (button) { button.classList.toggle("is-active", button.dataset.route === route); });
  closeSidebar();
  if (route === "forecast" && googleConfigured && !forecastDaily.length) loadForecast();
  if (route === "dashboard" || route === "history") window.setTimeout(function () { renderAllCharts(); }, 40);
}

function closeSidebar() {
  $("#sidebar").classList.remove("is-open");
  $("#sidebarShade").classList.remove("is-visible");
}

function getActiveName() {
  return (currentProfile && currentProfile.location) || "Acobamba · Huancavelica";
}

function updateIdentity() {
  const name = getUserDisplayName();
  const userInitials = initials(name);
  $("#userName").textContent = name;
  $("#topName").textContent = name;
  $("#userAvatar").textContent = userInitials;
  $("#topAvatar").textContent = userInitials;
  $("#userRole").textContent = isAdmin() ? "Administrador" : demoMode ? "Modo demostración" : "Observador";
  const adminLink = $("#adminNavLink");
  if (adminLink) adminLink.classList.toggle("is-hidden", !isAdmin() || demoMode);
  $("#sidebarPlace").textContent = getActiveName();
  $("#headingPlace").textContent = getActiveName();
  $("#forecastPlace").textContent = weatherPlace;
  $("#todayLine").textContent = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long" }).format(now()).toLocaleUpperCase("es-PE");
}

function sortByDateDesc(list) {
  return list.slice().sort(function (a, b) {
    return String(b.date || "").localeCompare(String(a.date || "")) || String(b.time || "").localeCompare(String(a.time || ""));
  });
}

function recordsInRange(records, from, to, location) {
  return records.filter(function (record) {
    if (from && record.date < from) return false;
    if (to && record.date > to) return false;
    if (location && record.location !== location) return false;
    return true;
  });
}

function locationsFrom(records) {
  return Array.from(new Set(records.map(function (record) { return record.location; }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, "es"); });
}

function fillLocationSelect(select, selectedValue) {
  const options = locationsFrom(observations);
  select.innerHTML = '<option value="">Todas las ubicaciones</option>' + options.map(function (place) {
    return '<option value="' + escapeHtml(place) + '">' + escapeHtml(place) + "</option>";
  }).join("");
  select.value = selectedValue || "";
}

function renderFilterOptions() {
  const selects = ["dashLocation", "historyLocation"];
  selects.forEach(function (id) {
    const select = $("#" + id);
    const value = select.value;
    fillLocationSelect(select, value);
  });
}

function getDashboardRecords() {
  return recordsInRange(observations, $("#dashFrom").value, $("#dashTo").value, $("#dashLocation").value);
}
function getHistoryRecords() {
  return recordsInRange(observations, $("#historyFrom").value, $("#historyTo").value, $("#historyLocation").value);
}

function sourceLabel(record) {
  if (record.source === "senamhi") return '<span class="source-pill senamhi"><i class="source-dot"></i>SENAMHI</span>';
  if (record.source === "demo" || demoMode) return '<span class="source-pill">Demo</span>';
  return '<span class="source-pill">Manual</span>';
}

function dateCell(record) {
  return '<span class="date-cell"><strong>' + escapeHtml(formatDate(record.date)) + '</strong><small>' + escapeHtml(record.time || "—") + "</small></span>";
}

function aggregateDaily(records) {
  const groups = new Map();
  records.forEach(function (record) {
    if (!record.date) return;
    if (!groups.has(record.date)) groups.set(record.date, { date: record.date, temps: [], rain: 0, count: 0 });
    const group = groups.get(record.date);
    const temp = toNumber(record.temperature);
    const rain = toNumber(record.rainfall);
    if (temp !== null) group.temps.push(temp);
    if (rain !== null) group.rain += rain;
    group.count += 1;
  });
  return Array.from(groups.values()).map(function (group) {
    group.temperature = group.temps.length ? group.temps.reduce(function (sum, value) { return sum + value; }, 0) / group.temps.length : null;
    return group;
  }).sort(function (a, b) { return a.date.localeCompare(b.date); });
}

function drawObservedChart(canvasId, emptyId, records, options) {
  const canvas = $("#" + canvasId);
  const empty = $("#" + emptyId);
  const chartName = options.chartName;
  const current = chartName === "history" ? historyChart : observationChart;
  if (current) current.destroy();
  if (!records.length) {
    empty.classList.remove("is-hidden");
    canvas.classList.add("is-hidden");
    if (chartName === "history") historyChart = null; else observationChart = null;
    return;
  }
  empty.classList.add("is-hidden");
  canvas.classList.remove("is-hidden");
  if (!window.Chart) return;
  const daily = aggregateDaily(records).slice(-14);
  if (!daily.length) return;
  const chart = new window.Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: daily.map(function (item) { return formatShortDate(item.date); }),
      datasets: [
        { type: "bar", label: "Lluvia (mm)", data: daily.map(function (item) { return Number(item.rain.toFixed(1)); }), yAxisID: "rainAxis", backgroundColor: "rgba(177, 208, 225, .75)", borderColor: "rgba(141, 180, 201, .72)", borderWidth: 1, borderRadius: 4, maxBarThickness: 23, order: 2 },
        { type: "line", label: "Temperatura (°C)", data: daily.map(function (item) { return item.temperature === null ? null : Number(item.temperature.toFixed(1)); }), yAxisID: "temperatureAxis", borderColor: "#45864e", backgroundColor: "#45864e", pointBackgroundColor: "#ffffff", pointBorderColor: "#45864e", pointBorderWidth: 2, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2, tension: .34, spanGaps: true, order: 1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#173f35", padding: 9, titleFont: { family: "DM Sans", size: 10 }, bodyFont: { family: "DM Sans", size: 9 }, callbacks: { label: function (context) { return context.dataset.label + ": " + (context.raw == null ? "—" : context.raw) + (context.dataset.yAxisID === "rainAxis" ? " mm" : " °C"); } } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: "#99a49b", font: { family: "DM Sans", size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: options.chartName === "history" ? 10 : 8 } },
        temperatureAxis: { position: "left", grid: { color: "#edf1ed" }, border: { display: false }, ticks: { color: "#87948a", font: { family: "DM Sans", size: 8 }, padding: 7, callback: function (value) { return value + "°"; } }, title: { display: false } },
        rainAxis: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, border: { display: false }, ticks: { color: "#89a6b6", font: { family: "DM Sans", size: 8 }, padding: 7, callback: function (value) { return value + " mm"; } } }
      }
    }
  });
  if (chartName === "history") historyChart = chart; else observationChart = chart;
}

function renderDashboard() {
  const records = getDashboardRecords();
  const values = records.map(function (record) { return toNumber(record.temperature); }).filter(function (value) { return value !== null; });
  const rainfall = records.map(function (record) { return toNumber(record.rainfall); }).filter(function (value) { return value !== null; });
  const active = alerts.filter(function (alert) { return alert.status === "activa"; });
  $("#metricObservations").textContent = String(records.length);
  $("#metricTemperature").textContent = values.length ? round(values.reduce(function (sum, value) { return sum + value; }, 0) / values.length, 1) : "—";
  $("#metricRainfall").textContent = rainfall.length ? round(rainfall.reduce(function (sum, value) { return sum + value; }, 0), 1) : "—";
  $("#metricAlerts").textContent = String(active.length);
  $("#filterTotal").textContent = $("#dashFrom").value || $("#dashTo").value || $("#dashLocation").value ? records.length + " registros" : "Todos los registros";
  $("#chartRange").textContent = records.length ? records.length + " lecturas" : "Sin lecturas";
  $("#observationNavCount").textContent = observations.length ? String(observations.length) : "";
  $("#alertNavCount").textContent = active.length ? String(active.length) : "";
  const recent = sortByDateDesc(records).slice(0, 5);
  $("#recentObservations").innerHTML = recent.map(function (record) {
    return "<tr><td>" + dateCell(record).replace('<span class="date-cell">', '<span class="date-cell">') + "</td><td>" + escapeHtml(record.location || "—") + "</td><td><strong>" + escapeHtml(record.temperature == null ? "—" : round(Number(record.temperature), 1) + " °C") + "</strong></td><td>" + escapeHtml(record.rainfall == null ? "—" : round(Number(record.rainfall), 1) + " mm") + "</td><td>" + sourceLabel(record) + "</td></tr>";
  }).join("");
  $("#recentEmpty").classList.toggle("is-hidden", recent.length > 0);
  $("#recentObservations").closest(".table-wrap").classList.toggle("is-hidden", recent.length === 0);
  const latestAlerts = sortByDateDesc(alerts).slice(0, 3);
  $("#dashboardAlerts").innerHTML = latestAlerts.map(function (alert) {
    return '<div class="alert-item"><span class="alert-bullet ' + escapeHtml(alert.severity || "preventiva") + '"></span><div class="alert-item-main"><strong>' + escapeHtml(alert.title) + '</strong><small>' + escapeHtml(alert.location || "Sin ubicación") + " · " + escapeHtml(formatShortDate(alert.date)) + '</small></div><span class="alert-severity ' + escapeHtml(alert.severity || "preventiva") + '">' + escapeHtml(alert.status === "resuelta" ? "Resuelta" : alert.severity || "Preventiva") + "</span></div>";
  }).join("");
  $("#dashboardAlertsEmpty").classList.toggle("is-hidden", latestAlerts.length > 0);
  $("#dashboardAlerts").classList.toggle("is-hidden", latestAlerts.length === 0);
  drawObservedChart("observationsChart", "chartEmpty", records, { chartName: "dashboard" });
}

function renderObservationTable() {
  const searchTerm = $("#observationSearch").value.trim().toLocaleLowerCase("es-PE");
  const source = $("#observationSourceFilter").value;
  const filtered = sortByDateDesc(observations).filter(function (record) {
    const combined = [record.location, record.crop, record.sky, record.notes, record.sourceStation].join(" ").toLocaleLowerCase("es-PE");
    if (searchTerm && !combined.includes(searchTerm)) return false;
    if (source && (record.source || "manual") !== source) return false;
    return true;
  });
  $("#observationRows").innerHTML = filtered.map(function (record) {
    const actionButtons = [];
    if (canManage(record)) actionButtons.push('<button class="table-action" type="button" data-edit-observation="' + escapeHtml(record.id) + '">Editar</button>');
    if (canDeleteRecords()) actionButtons.push('<button class="table-action delete-action" type="button" data-delete-observation="' + escapeHtml(record.id) + '">Eliminar</button>');
    const actions = actionButtons.length ? '<span class="table-actions">' + actionButtons.join("") + '</span>' : '<span class="muted-cell">—</span>';
    const weather = record.sky ? '<span class="weather-pill">' + escapeHtml(record.sky) + "</span>" : '<span class="muted-cell">—</span>';
    return "<tr><td>" + dateCell(record) + "</td><td>" + escapeHtml(record.location || "—") + "</td><td><strong>" + escapeHtml(record.temperature == null ? "—" : round(Number(record.temperature), 1) + " °C") + "</strong></td><td>" + escapeHtml(record.rainfall == null ? "—" : round(Number(record.rainfall), 1) + " mm") + "</td><td>" + escapeHtml(record.humidity == null || record.humidity === "" ? "—" : record.humidity + " %") + "</td><td>" + weather + "</td><td>" + sourceLabel(record) + "</td><td>" + actions + "</td></tr>";
  }).join("");
  $("#observationCount").textContent = filtered.length + (filtered.length === 1 ? " entrada" : " entradas");
  $("#observationsEmpty").classList.toggle("is-hidden", filtered.length > 0);
  $("#observationRows").closest(".table-wrap").classList.toggle("is-hidden", filtered.length === 0);
  renderDashboard();
}

function renderHistory() {
  const records = getHistoryRecords();
  const sorted = sortByDateDesc(records);
  const temps = records.map(function (record) { return toNumber(record.temperature); }).filter(function (value) { return value !== null; });
  const rain = records.map(function (record) { return toNumber(record.rainfall); }).filter(function (value) { return value !== null; });
  $("#historyTotal").textContent = records.length + (records.length === 1 ? " lectura" : " lecturas");
  const from = $("#historyFrom").value;
  const to = $("#historyTo").value;
  $("#historyPeriod").textContent = (from ? formatDate(from, { day: "2-digit", month: "short", year: "numeric" }) : "Inicio") + " — " + (to ? formatDate(to, { day: "2-digit", month: "short", year: "numeric" }) : "Hoy");
  const avg = temps.length ? temps.reduce(function (sum, value) { return sum + value; }, 0) / temps.length : null;
  const rainTotal = rain.length ? rain.reduce(function (sum, value) { return sum + value; }, 0) : null;
  $("#historySummary").innerHTML = '<div class="history-stat"><span>Temperatura media observada</span><strong>' + (avg == null ? "—" : round(avg, 1) + " °C") + '</strong></div><div class="history-stat"><span>Lluvia acumulada observada</span><strong>' + (rainTotal == null ? "—" : round(rainTotal, 1) + " mm") + '</strong></div><div class="history-stat"><span>Entradas en el periodo</span><strong>' + sorted.length + "</strong></div>";
  drawObservedChart("historyChart", "historyChartEmpty", records, { chartName: "history" });
}

function renderAlerts() {
  const stateFilter = $("#alertStateFilter").value;
  const severityFilter = $("#alertSeverityFilter").value;
  const filtered = sortByDateDesc(alerts).filter(function (alert) {
    if (stateFilter && alert.status !== stateFilter) return false;
    if (severityFilter && alert.severity !== severityFilter) return false;
    return true;
  });
  const active = alerts.filter(function (alert) { return alert.status === "activa"; });
  const resolved = alerts.filter(function (alert) { return alert.status === "resuelta"; });
  const last = sortByDateDesc(alerts)[0];
  $("#alertsActiveMetric").textContent = String(active.length);
  $("#alertsResolvedMetric").textContent = String(resolved.length);
  $("#alertsLastMetric").textContent = last ? formatDate(last.date, { day: "2-digit", month: "short" }) : "—";
  $("#alertCount").textContent = filtered.length + (filtered.length === 1 ? " alerta" : " alertas");
  $("#alertPanelCount").textContent = String(filtered.length);
  $("#alertRows").innerHTML = filtered.map(function (alert) {
    const severity = alert.severity || "preventiva";
    const action = alert.status === "activa" ? "Resolver" : "Reactivar";
    const actionClass = alert.status === "activa" ? "resolve-action" : "";
    const actionButtons = [];
    if (canManage(alert)) actionButtons.push('<button class="table-action ' + actionClass + '" type="button" data-toggle-alert="' + escapeHtml(alert.id) + '">' + action + '</button><button class="table-action" type="button" data-edit-alert="' + escapeHtml(alert.id) + '">Editar</button>');
    if (canDeleteRecords()) actionButtons.push('<button class="table-action delete-action" type="button" data-delete-alert="' + escapeHtml(alert.id) + '">Eliminar</button>');
    const actions = actionButtons.length ? '<span class="table-actions">' + actionButtons.join("") + '</span>' : '<span class="muted-cell">—</span>';
    return "<tr><td>" + escapeHtml(formatDate(alert.date)) + '</td><td><strong>' + escapeHtml(alert.title || "—") + '</strong><small class="table-subline">' + escapeHtml(alert.message || "") + '</small></td><td>' + escapeHtml(alert.location || "—") + '</td><td>' + escapeHtml(alert.type || "—") + '</td><td><span class="severity-chip ' + escapeHtml(severity) + '">' + escapeHtml(severity) + '</span></td><td><span class="status-chip ' + escapeHtml(alert.status || "activa") + '">' + escapeHtml(alert.status || "activa") + '</span></td><td>' + actions + "</td></tr>";
  }).join("");
  $("#alertsEmpty").classList.toggle("is-hidden", filtered.length > 0);
  $("#alertRows").closest(".table-wrap").classList.toggle("is-hidden", filtered.length === 0);
  $("#alertNavCount").textContent = active.length ? String(active.length) : "";
}

function renderAllCharts() {
  if (!window.Chart) return;
  if (activeRoute === "dashboard") drawObservedChart("observationsChart", "chartEmpty", getDashboardRecords(), { chartName: "dashboard" });
  if (activeRoute === "history") drawObservedChart("historyChart", "historyChartEmpty", getHistoryRecords(), { chartName: "history" });
  if (activeRoute === "forecast") renderForecastChart();
}

function renderAll() {
  updateIdentity();
  $("#demoBanner").classList.toggle("is-hidden", !demoMode);
  $("#firebaseBanner").classList.toggle("is-hidden", !firebaseProblem || demoMode);
  renderFilterOptions();
  renderDashboard();
  renderObservationTable();
  renderHistory();
  renderAlerts();
  renderAdminUsers();
  loadChartLibrary().then(renderAllCharts).catch(function () {
    $("#chartEmpty").classList.remove("is-hidden");
    $("#historyChartEmpty").classList.remove("is-hidden");
  });
  updateGoogleKeyState();
}

function profileCreatedAt(value) {
  let date = null;
  if (value && typeof value.toDate === "function") date = value.toDate();
  else if (value instanceof Date) date = value;
  else if (value && typeof value === "object" && Number.isFinite(value.seconds)) date = new Date(value.seconds * 1000);
  else if (value) date = new Date(value);
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(date)
    : "—";
}

function renderAdminUsers() {
  const body = $("#adminUserRows");
  if (!body) return;
  const users = isAdmin() && !demoMode ? registeredUsers.slice().sort(function (a, b) {
    const aDate = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : 0;
    const bDate = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : 0;
    return bDate - aDate || String(a.displayName || "").localeCompare(String(b.displayName || ""), "es");
  }) : [];
  body.innerHTML = users.map(function (user) {
    const name = user.displayName || user.email || "Usuario";
    const role = user.role === "admin" ? "Administrador" : "Observador";
    const badge = user.role === "admin" ? "admin" : "observer";
    return "<tr><td><strong>" + escapeHtml(name) + '</strong><small class="table-subline">' + escapeHtml(user.uid || "") + "</small></td><td>" + escapeHtml(user.email || "—") + '</td><td><span class="role-chip ' + badge + '">' + role + "</span></td><td>" + escapeHtml(profileCreatedAt(user.createdAt)) + "</td></tr>";
  }).join("");
  $("#adminUsersCount").textContent = String(users.length) + (users.length === 1 ? " cuenta" : " cuentas");
  $("#adminUsersCountMetric").textContent = String(users.length);
  $("#adminUsersEmpty").classList.toggle("is-hidden", users.length > 0);
  $("#adminUsersTableWrap").classList.toggle("is-hidden", users.length === 0);
  $("#adminObservationsCount").textContent = String(observations.length);
  $("#adminAlertsCount").textContent = String(alerts.length);
}

async function ensureUserProfile(user, requestedName) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return snap.data();
  const profile = {
    uid: user.uid,
    email: user.email || "",
    displayName: requestedName || user.displayName || (user.email ? user.email.split("@")[0] : "Observador"),
    role: "observador",
    createdAt: serverTimestamp()
  };
  await setDoc(userRef, profile);
  return profile;
}

async function readCloudData() {
  if (!currentUser) return false;
  let loaded = true;
  try {
    const profileRef = doc(db, "users", currentUser.uid);
    const profileSnapshot = await getDoc(profileRef);
    if (profileSnapshot.exists()) currentProfile = profileSnapshot.data();
    else currentProfile = await ensureUserProfile(currentUser);
    const observationQuery = isAdmin() ? collection(db, "observations") : query(collection(db, "observations"), where("createdBy", "==", currentUser.uid));
    const alertQuery = isAdmin() ? collection(db, "alerts") : query(collection(db, "alerts"), where("createdBy", "==", currentUser.uid));
    const requests = [getDocs(observationQuery), getDocs(alertQuery)];
    if (isAdmin()) requests.push(getDocs(collection(db, "users")));
    const values = await Promise.all(requests);
    observations = values[0].docs.map(function (entry) { return Object.assign({ id: entry.id }, entry.data()); });
    alerts = values[1].docs.map(function (entry) { return Object.assign({ id: entry.id }, entry.data()); });
    registeredUsers = isAdmin() ? values[2].docs.map(function (entry) { return Object.assign({ uid: entry.id }, entry.data()); }) : [];
    firebaseProblem = "";
    setConnectionState("online", "Firebase conectado");
  } catch (error) {
    loaded = false;
    console.error("Firebase read failed:", error);
    firebaseProblem = "No se pudo leer Firestore. Revisa que exista la base de datos y que las reglas estén publicadas.";
    observations = [];
    alerts = [];
    registeredUsers = [];
    setConnectionState("offline", "Revisar configuración Firebase");
    $("#firebaseBanner").classList.remove("is-hidden");
    showToast("No se pudieron leer los datos de Firestore. Revisa las reglas y la configuración.", "error");
  }
  showApplication();
  return loaded;
}

async function createRecord(collectionName, record) {
  if (demoMode) {
    const newItem = Object.assign({}, record, { id: makeLocalId(), createdBy: "demo_user", createdByName: getUserDisplayName() });
    if (collectionName === "observations") {
      observations.unshift(newItem);
      persistDemoRecords();
    } else {
      alerts.unshift(newItem);
      persistDemoRecords();
    }
    return newItem.id;
  }
  const payload = Object.assign({}, record, {
    createdBy: currentUser.uid,
    createdByName: getUserDisplayName(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  const result = await addDoc(collection(db, collectionName), payload);
  return result.id;
}

async function updateRecord(collectionName, id, record) {
  if (demoMode) {
    const list = collectionName === "observations" ? observations : alerts;
    const index = list.findIndex(function (item) { return item.id === id; });
    if (index < 0) throw new Error("No se encontró el registro.");
    list[index] = Object.assign({}, list[index], record);
    persistDemoRecords();
    return;
  }
  await updateDoc(doc(db, collectionName, id), Object.assign({}, record, { updatedAt: serverTimestamp() }));
}

async function removeRecord(collectionName, id) {
  if (!canDeleteRecords()) throw new Error("Solo una cuenta administradora puede eliminar registros.");
  if (demoMode) {
    throw new Error("No se pueden eliminar registros desde el modo demostración.");
  }
  await deleteDoc(doc(db, collectionName, id));
}

function makeLocalId() {
  return "local-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
function persistDemoRecords() {
  if (!demoMode) return;
  try {
    localStorage.setItem("agroclima_demo_observations", JSON.stringify(observations));
    localStorage.setItem("agroclima_demo_alerts", JSON.stringify(alerts));
  } catch (_) {}
}
function startDemo() {
  demoMode = true;
  sessionStorage.setItem("agroclima_demo", "1");
  currentUser = { uid: "demo_user", email: "demo@agroclima.local", displayName: "María Quispe" };
  currentProfile = { role: "observador", displayName: "María Quispe", location: "Acobamba · Huancavelica" };
  try {
    observations = JSON.parse(localStorage.getItem("agroclima_demo_observations") || "null") || DEMO_OBSERVATIONS.map(function (item) { return Object.assign({}, item); });
    alerts = JSON.parse(localStorage.getItem("agroclima_demo_alerts") || "null") || DEMO_ALERTS.map(function (item) { return Object.assign({}, item); });
  } catch (_) {
    observations = DEMO_OBSERVATIONS.map(function (item) { return Object.assign({}, item); });
    alerts = DEMO_ALERTS.map(function (item) { return Object.assign({}, item); });
  }
  firebaseProblem = "";
  setConnectionState("demo", "Datos locales de demostración");
  showApplication();
}

function errorText(error) {
  const code = error && error.code ? error.code : "";
  const messages = {
    "auth/invalid-credential": "El correo o la contraseña no son correctos.",
    "auth/invalid-email": "Escribe un correo electrónico válido.",
    "auth/user-not-found": "No encontramos una cuenta con ese correo.",
    "auth/wrong-password": "La contraseña no es correcta.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/weak-password": "Usa una contraseña de al menos 6 caracteres.",
    "auth/too-many-requests": "Hubo demasiados intentos. Espera un momento y vuelve a probar.",
    "auth/operation-not-allowed": "Activa el acceso con correo y contraseña en Firebase Authentication.",
    "auth/network-request-failed": "No se pudo conectar. Revisa la conexión a internet."
  };
  return messages[code] || (error && error.message) || "No se pudo completar la operación.";
}

async function initFirebase() {
  try {
    const modules = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js")
    ]);
    initializeApp = modules[0].initializeApp;
    getAuth = modules[1].getAuth;
    createUserWithEmailAndPassword = modules[1].createUserWithEmailAndPassword;
    signInWithEmailAndPassword = modules[1].signInWithEmailAndPassword;
    signOut = modules[1].signOut;
    onAuthStateChanged = modules[1].onAuthStateChanged;
    updateProfile = modules[1].updateProfile;
    getFirestore = modules[2].getFirestore;
    collection = modules[2].collection;
    doc = modules[2].doc;
    getDoc = modules[2].getDoc;
    getDocs = modules[2].getDocs;
    addDoc = modules[2].addDoc;
    updateDoc = modules[2].updateDoc;
    deleteDoc = modules[2].deleteDoc;
    query = modules[2].query;
    where = modules[2].where;
    serverTimestamp = modules[2].serverTimestamp;
    setDoc = modules[2].setDoc;
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    onAuthStateChanged(auth, async function (user) {
      if (demoMode) return;
      currentUser = user;
      if (!user) {
        currentProfile = null;
        showAuth();
        return;
      }
      await readCloudData();
      await refreshWeatherStatus();
    });
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    firebaseProblem = "No se pudo iniciar Firebase en este navegador.";
    if (!demoMode) {
      showAuth();
      $("#authError").textContent = "Firebase no está disponible ahora. Puedes usar el modo demostración.";
    }
  }
}

function setAuthCreateMode(createMode) {
  $("#authTitle").textContent = createMode ? "Crea tu cuenta" : "Bienvenido de nuevo";
  $("#authIntro").textContent = createMode ? "Empieza a registrar las observaciones de tu equipo." : "Ingresa para continuar tu cuaderno.";
  $("#authNameWrap").classList.toggle("is-hidden", !createMode);
  $("#authName").required = createMode;
  $("#authPassword").autocomplete = createMode ? "new-password" : "current-password";
  $("#authSubmit").innerHTML = createMode ? "Crear cuenta <span aria-hidden=\"true\">→</span>" : "Ingresar <span aria-hidden=\"true\">→</span>";
  $("#authSwitchText").textContent = createMode ? "¿Ya tienes una cuenta?" : "¿Aún no tienes una cuenta?";
  $("#authSwitch").textContent = createMode ? "Ingresar" : "Crear una cuenta";
  $("#authForm").dataset.createMode = createMode ? "true" : "false";
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  $("#authError").textContent = "";
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const createMode = $("#authForm").dataset.createMode === "true";
  const button = $("#authSubmit");
  button.disabled = true;
  button.textContent = createMode ? "Creando cuenta…" : "Ingresando…";
  try {
    if (!auth && firebaseReadyPromise) await firebaseReadyPromise;
    if (!auth) throw new Error("Firebase no está disponible. Revisa la conexión y vuelve a intentar.");
    if (createMode) {
      const name = $("#authName").value.trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await ensureUserProfile(credential.user, name);
      currentUser = credential.user;
      currentProfile = { uid: credential.user.uid, email: email, displayName: name, role: "observador" };
      demoMode = false;
      await readCloudData();
      showToast("Cuenta creada. El rol inicial es observador.");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    $("#authError").textContent = errorText(error);
  } finally {
    button.disabled = false;
    setAuthCreateMode(createMode);
  }
}

function initAuth() {
  setAuthCreateMode(false);
  $("#authForm").addEventListener("submit", handleAuthSubmit);
  $("#authSwitch").addEventListener("click", function () {
    setAuthCreateMode($("#authForm").dataset.createMode !== "true");
    $("#authError").textContent = "";
  });
  $("#demoButton").addEventListener("click", startDemo);
  $("#signOutButton").addEventListener("click", async function () {
    if (demoMode) {
      leaveDemo();
      return;
    }
    try { await signOut(auth); } catch (error) { showToast(errorText(error), "error"); }
  });
  $("#userMenu").addEventListener("click", function () { $("#signOutButton").click(); });
  $("#leaveDemo").addEventListener("click", leaveDemo);
}

function leaveDemo() {
  demoMode = false;
  sessionStorage.removeItem("agroclima_demo");
  currentUser = null;
  currentProfile = null;
  observations = [];
  alerts = [];
  showAuth();
}

function renderForecastChart() {
  const canvas = $("#forecastChart");
  const empty = $("#forecastChartEmpty");
  if (forecastChart) forecastChart.destroy();
  if (!forecastDaily.length) {
    canvas.classList.add("is-hidden");
    empty.classList.remove("is-hidden");
    return;
  }
  canvas.classList.remove("is-hidden");
  empty.classList.add("is-hidden");
  if (!window.Chart) return;
  forecastChart = new window.Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: forecastDaily.map(function (day) { return day.label; }),
      datasets: [
        { label: "Máxima (°C)", data: forecastDaily.map(function (day) { return day.max; }), borderColor: "#d09a46", backgroundColor: "#d09a46", pointRadius: 3, borderWidth: 2, tension: .3 },
        { label: "Mínima (°C)", data: forecastDaily.map(function (day) { return day.min; }), borderColor: "#6b9aab", backgroundColor: "#6b9aab", pointRadius: 3, borderWidth: 2, tension: .3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: "top", align: "end", labels: { usePointStyle: true, boxWidth: 6, boxHeight: 6, color: "#7f8d82", font: { family: "DM Sans", size: 8 }, padding: 13 } }, tooltip: { backgroundColor: "#173f35", padding: 8, bodyFont: { family: "DM Sans", size: 9 } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: "#94a097", font: { family: "DM Sans", size: 8 } } },
        y: { grid: { color: "#edf1ed" }, border: { display: false }, ticks: { color: "#87948a", font: { family: "DM Sans", size: 8 }, callback: function (value) { return value + "°"; } } }
      }
    }
  });
}

function savePlantingPreferences() {
  try {
    localStorage.setItem("agroclima_planting_crop", $("#plantingCrop").value.trim());
    localStorage.setItem("agroclima_planting_water", $("#plantingWater").value);
    localStorage.setItem("agroclima_planting_soil", $("#plantingSoil").value);
  } catch (_) {}
}

function initPlantingAssistant() {
  try {
    $("#plantingCrop").value = localStorage.getItem("agroclima_planting_crop") || "";
    $("#plantingWater").value = localStorage.getItem("agroclima_planting_water") || "secano";
    $("#plantingSoil").value = localStorage.getItem("agroclima_planting_soil") || "";
  } catch (_) {}
  $("#plantingForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!$("#plantingForm").reportValidity()) return;
    savePlantingPreferences();
    renderPlantingAdvice();
  });
}

function setPlantingAdvice(state, badge, title, reason, signals) {
  const result = $("#plantingResult");
  result.className = "planting-result planting-" + state;
  $("#plantingResultBadge").textContent = badge;
  $("#plantingResultMark").textContent = state === "yes" ? "✓" : state === "wait" ? "×" : state === "caution" ? "!" : "i";
  $("#plantingResultTitle").textContent = title;
  $("#plantingResultReason").textContent = reason;
  $("#plantingSignals").innerHTML = (signals || []).map(function (signal) { return "<li>" + escapeHtml(signal) + "</li>"; }).join("");
}

function renderPlantingAdvice() {
  const crop = $("#plantingCrop").value.trim();
  const water = $("#plantingWater").value;
  const soil = $("#plantingSoil").value;
  const days = forecastDaily.slice(0, 7);
  const dateStart = days[0] && days[0].date ? formatShortDate(days[0].date) : "";
  const dateEnd = days[days.length - 1] && days[days.length - 1].date ? formatShortDate(days[days.length - 1].date) : "";
  $("#plantingPeriod").textContent = dateStart && dateEnd ? dateStart + "–" + dateEnd : "7 DÍAS";

  if (!crop) {
    setPlantingAdvice("pending", "COMPLETA LOS DATOS", "Indica el cultivo para evaluar.", "La evaluación considera el pronóstico de esta ubicación y el estado del terreno.", []);
    return;
  }
  if (!days.length) {
    const reason = googleConfigured
      ? "Aún no hay pronóstico de Google Weather. Pulsa Actualizar y vuelve a evaluar."
      : "El pronóstico no está disponible. El administrador debe configurar la clave GOOGLE_WEATHER_API_KEY.";
    setPlantingAdvice("review", "SIN PRONÓSTICO", "Todavía no se puede recomendar la siembra.", reason, ["Cultivo indicado: " + crop]);
    return;
  }

  const minTemps = days.map(function (day) { return day.min; }).filter(Number.isFinite);
  const maxTemps = days.map(function (day) { return day.max; }).filter(Number.isFinite);
  const rainDays = days.filter(function (day) { return Number.isFinite(day.rainAmount); });
  const minTemp = minTemps.length ? Math.min.apply(null, minTemps) : null;
  const maxTemp = maxTemps.length ? Math.max.apply(null, maxTemps) : null;
  const rainTotal = rainDays.reduce(function (sum, day) { return sum + day.rainAmount; }, 0);
  const highestDailyRain = rainDays.reduce(function (highest, day) { return Math.max(highest, day.rainAmount); }, 0);
  const weatherSignals = [];
  if (minTemp !== null) weatherSignals.push("Temperatura mínima prevista: " + round(minTemp, 1) + " °C.");
  if (rainDays.length) weatherSignals.push("Lluvia prevista en " + rainDays.length + " de " + days.length + " días con dato: " + round(rainTotal, 1) + " mm acumulados.");
  weatherSignals.push("Cultivo: " + crop + ".");
  if (!minTemps.length || !rainDays.length) {
    setPlantingAdvice("review", "DATOS INCOMPLETOS", "Revisa el pronóstico antes de decidir.", "No hay datos suficientes de temperatura o lluvia para evaluar los riesgos de esta semana.", weatherSignals);
    return;
  }
  if (soil === "saturated") {
    setPlantingAdvice("wait", "NO POR AHORA", "Espera antes de sembrar.", "Indicaste que el terreno está encharcado. Revisa drenaje y vuelve a evaluar cuando el suelo esté trabajable.", weatherSignals);
    return;
  }
  if (minTemp <= 0) {
    setPlantingAdvice("wait", "NO RECOMENDADO", "Espera a que pase el riesgo de helada.", "Se pronostica una mínima de 0 °C o menos. La helada puede afectar la emergencia; revisa de nuevo el pronóstico antes de sembrar.", weatherSignals);
    return;
  }
  if (soil === "dry") {
    const nextStep = water === "riego" ? "Humedece el terreno con riego y confirma que esté preparado antes de colocar la semilla." : "En secano, espera lluvia efectiva y comprueba que la humedad haya llegado al surco antes de sembrar.";
    setPlantingAdvice("wait", "PREPARA EL TERRENO", "No siembres todavía en suelo seco.", nextStep, weatherSignals);
    return;
  }
  if (!soil || soil === "unknown") {
    setPlantingAdvice("review", "REVISA EL SUELO", "Falta comprobar la parcela.", "Verifica humedad y drenaje del terreno. El pronóstico por sí solo no permite confirmar que el suelo esté listo para sembrar.", weatherSignals);
    return;
  }
  const riskSignals = [];
  if (highestDailyRain >= 25) riskSignals.push("Hay un día con 25 mm o más de lluvia prevista; confirma que el terreno drene bien.");
  if (maxTemp !== null && maxTemp >= 35) riskSignals.push("Se prevé una máxima de 35 °C o más; vigila la pérdida de humedad y la disponibilidad de agua.");
  if (water === "secano" && rainTotal < 1) riskSignals.push("No se espera lluvia apreciable esta semana; en secano, vigila la humedad hasta la emergencia.");
  if (riskSignals.length) {
    setPlantingAdvice("caution", "CON PRECAUCIÓN", "La siembra requiere una revisión adicional.", "El suelo figura como húmedo y preparado, pero el pronóstico presenta estas señales:", weatherSignals.concat(riskSignals));
    return;
  }
  setPlantingAdvice("yes", "VENTANA FAVORABLE", "Sí, el pronóstico permite considerar la siembra.", "No aparecen heladas ni señales fuertes de calor o lluvia en estos 7 días y reportas el terreno húmedo y preparado. Comprueba el calendario local y las necesidades de tu variedad.", weatherSignals);
}

function renderForecast() {
  const referenceCoordinates = Number(weatherLat).toFixed(2) === "-12.84" && Number(weatherLon).toFixed(2) === "-74.57";
  $("#forecastPlace").textContent = weatherPlace;
  $("#forecastCoordinates").textContent = (referenceCoordinates ? "Coordenadas referenciales · " : "Lat. ") + (referenceCoordinates ? "Acobamba, Perú" : Number(weatherLat).toFixed(4) + " · Lon. " + Number(weatherLon).toFixed(4));
  $("#forecastUpdated").textContent = forecastDaily.length ? "Actualizado " + new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(now()) : googleConfigured ? "Consultando Google Weather…" : "API no configurada";
  $("#forecastConfigCallout").classList.toggle("is-hidden", googleConfigured);
  renderPlantingAdvice();
  $("#forecastDays").innerHTML = forecastDaily.map(function (day, index) {
    return '<article class="forecast-day"><div class="forecast-weekday">' + (index === 0 ? "Hoy" : escapeHtml(day.weekday)) + '</div><div class="forecast-icon">' + weatherIcon(day.type) + '</div><div class="forecast-description" title="' + escapeHtml(day.description) + '">' + escapeHtml(day.description) + '</div><div class="forecast-temperatures"><span>' + escapeHtml(day.max == null ? "—" : round(day.max, 0) + "°") + '</span><small>' + escapeHtml(day.min == null ? "—" : round(day.min, 0) + "°") + '</small></div><div class="forecast-rain">⌁ ' + escapeHtml(day.rainPercent == null ? "—" : day.rainPercent + "%") + ' <span>·</span> ' + escapeHtml(day.rainAmount == null ? "—" : round(day.rainAmount, 1) + " mm") + "</div></article>";
  }).join("");
  const hours = forecastHourly.slice(0, 24);
  $("#hourlyList").innerHTML = hours.length ? hours.map(function (hour) {
    return '<div class="hourly-row"><span class="hourly-time">' + escapeHtml(hour.time) + '</span><span class="hourly-icon">' + weatherIcon(hour.type) + '</span><span class="hourly-condition">' + escapeHtml(hour.description) + '</span><span class="hourly-temp">' + escapeHtml(hour.temperature == null ? "—" : round(hour.temperature, 0) + "°") + '</span><span class="hourly-rain">' + escapeHtml(hour.rainPercent == null ? "—" : hour.rainPercent + "%") + "</span></div>";
  }).join("") : '<div class="hourly-placeholder">' + (googleConfigured ? "No hay observaciones horarias disponibles para esta ubicación." : "El administrador del sitio debe configurar el secreto GOOGLE_WEATHER_API_KEY.") + "</div>";
  loadChartLibrary().then(renderForecastChart).catch(function () {});
}

function weatherIcon(type) {
  const value = String(type || "").toUpperCase();
  if (value.includes("THUNDER") || value.includes("STORM")) return "ϟ";
  if (value.includes("SNOW") || value.includes("ICE")) return "❄";
  if (value.includes("RAIN") || value.includes("SHOWER") || value.includes("DRIZZLE")) return "☂";
  if (value.includes("FOG") || value.includes("MIST")) return "≋";
  if (value.includes("CLOUD") && !value.includes("PARTLY")) return "☁";
  if (value.includes("PARTLY") || value.includes("MOSTLY")) return "◒";
  return "☼";
}

function updateGoogleKeyState() {
  const state = $("#googleKeyState");
  if (state) {
    state.textContent = googleConfigured ? "CONFIGURADA" : "REQUIERE CLAVE";
    state.classList.toggle("service-ready", googleConfigured);
  }
}

function setObservationSource(source) {
  currentSourceTab = source;
  $$(".source-tab").forEach(function (button) {
    const selected = button.dataset.sourceTab === source;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  $("#senamhiImport").classList.toggle("is-hidden", source !== "senamhi");
}

function openObservationForm(record) {
  editingObservationId = record ? record.id : null;
  importedReading = record && record.source === "senamhi" ? {
    stationName: record.sourceStation || "",
    stationId: record.sourceStationId || "",
    observationId: record.sourceObservationId || ""
  } : null;
  $("#observationForm").reset();
  $("#observationDialogTitle").textContent = record ? "Editar observación" : "Registrar observación";
  $("#saveObservation").innerHTML = record ? "Guardar cambios <span>→</span>" : "Guardar observación <span>→</span>";
  $("#obsDate").value = record ? record.date : todayISO();
  $("#obsTime").value = record ? record.time || localTime() : localTime();
  $("#obsLocation").value = record ? record.location || "" : "Parcela norte";
  $("#obsCrop").value = record ? record.crop || "" : "";
  $("#obsTemperature").value = record && record.temperature != null ? record.temperature : "";
  $("#obsRainfall").value = record && record.rainfall != null ? record.rainfall : "";
  $("#obsHumidity").value = record && record.humidity != null ? record.humidity : "";
  $("#obsWind").value = record && record.windSpeed != null ? record.windSpeed : "";
  $("#obsSky").value = record ? record.sky || "" : "";
  $("#obsNotes").value = record ? record.notes || "" : "";
  $("#importStationName").textContent = importedReading ? importedReading.stationName : "";
  $("#importAttribution").classList.toggle("is-hidden", !importedReading);
  setObservationSource(record && record.source === "senamhi" ? "senamhi" : "manual");
  showModal("observationDialog");
}

function openAlertForm(record) {
  editingAlertId = record ? record.id : null;
  $("#alertForm").reset();
  $("#alertDialogTitle").textContent = record ? "Editar alerta climática" : "Registrar alerta climática";
  $("#saveAlert").innerHTML = record ? "Guardar cambios <span>→</span>" : "Guardar alerta <span>→</span>";
  $("#alertDate").value = record ? record.date : todayISO();
  $("#alertType").value = record ? record.type || "Lluvia" : "Lluvia";
  $("#alertTitle").value = record ? record.title || "" : "";
  $("#alertLocation").value = record ? record.location || "" : "Parcela norte";
  $("#alertSeverity").value = record ? record.severity || "preventiva" : "preventiva";
  $("#alertMessage").value = record ? record.message || "" : "";
  $("#alertRecommendation").value = record ? record.recommendation || "" : "";
  showModal("alertDialog");
}

async function saveObservation(event) {
  event.preventDefault();
  if (!$("#observationForm").reportValidity()) return;
  const oldRecord = editingObservationId ? observations.find(function (item) { return item.id === editingObservationId; }) : null;
  const observation = {
    date: $("#obsDate").value,
    time: $("#obsTime").value,
    location: $("#obsLocation").value.trim(),
    crop: $("#obsCrop").value.trim(),
    temperature: Number($("#obsTemperature").value),
    rainfall: Number($("#obsRainfall").value),
    humidity: $("#obsHumidity").value === "" ? null : Number($("#obsHumidity").value),
    windSpeed: $("#obsWind").value === "" ? null : Number($("#obsWind").value),
    sky: $("#obsSky").value,
    notes: $("#obsNotes").value.trim(),
    source: currentSourceTab === "senamhi" ? "senamhi" : "manual"
  };
  if (importedReading && currentSourceTab === "senamhi") {
    observation.sourceStation = importedReading.stationName || "";
    observation.sourceStationId = importedReading.stationId || "";
    observation.sourceObservationId = importedReading.observationId || "";
    observation.sourceUrl = SENAMHI_OBSERVATIONS_URL;
  } else if (oldRecord && oldRecord.source === "senamhi" && currentSourceTab === "senamhi") {
    observation.sourceStation = oldRecord.sourceStation || "";
    observation.sourceStationId = oldRecord.sourceStationId || "";
    observation.sourceObservationId = oldRecord.sourceObservationId || "";
    observation.sourceUrl = oldRecord.sourceUrl || SENAMHI_OBSERVATIONS_URL;
  }
  try {
    $("#saveObservation").disabled = true;
    if (editingObservationId) {
      await updateRecord("observations", editingObservationId, observation);
      const index = observations.findIndex(function (item) { return item.id === editingObservationId; });
      if (index >= 0) observations[index] = Object.assign({}, observations[index], observation);
      showToast("La observación se actualizó.");
    } else {
      const id = await createRecord("observations", observation);
      observations.unshift(Object.assign({}, observation, { id: id, createdBy: currentUser.uid, createdByName: getUserDisplayName() }));
      showToast(observation.source === "senamhi" ? "Observación de SENAMHI agregada al cuaderno." : "Observación guardada en el cuaderno.");
    }
    closeModal("observationDialog");
    renderAll();
  } catch (error) {
    console.error("Observation save failed:", error);
    showToast("No se pudo guardar la observación. Comprueba los permisos de Firestore.", "error");
  } finally {
    $("#saveObservation").disabled = false;
  }
}

async function saveAlert(event) {
  event.preventDefault();
  if (!$("#alertForm").reportValidity()) return;
  const record = {
    date: $("#alertDate").value,
    title: $("#alertTitle").value.trim(),
    location: $("#alertLocation").value.trim(),
    type: $("#alertType").value,
    severity: $("#alertSeverity").value,
    message: $("#alertMessage").value.trim(),
    recommendation: $("#alertRecommendation").value.trim(),
    status: editingAlertId ? (alerts.find(function (item) { return item.id === editingAlertId; }) || {}).status || "activa" : "activa"
  };
  try {
    $("#saveAlert").disabled = true;
    if (editingAlertId) {
      await updateRecord("alerts", editingAlertId, record);
      const index = alerts.findIndex(function (item) { return item.id === editingAlertId; });
      if (index >= 0) alerts[index] = Object.assign({}, alerts[index], record);
      showToast("La alerta se actualizó.");
    } else {
      const id = await createRecord("alerts", record);
      alerts.unshift(Object.assign({}, record, { id: id, createdBy: currentUser.uid, createdByName: getUserDisplayName() }));
      showToast("Alerta manual registrada.");
    }
    closeModal("alertDialog");
    renderAll();
  } catch (error) {
    console.error("Alert save failed:", error);
    showToast("No se pudo guardar la alerta. Comprueba los permisos de Firestore.", "error");
  } finally {
    $("#saveAlert").disabled = false;
  }
}

function askToConfirm(title, message, action) {
  $("#confirmTitle").textContent = title;
  $("#confirmText").textContent = message;
  pendingConfirmAction = action;
  showModal("confirmDialog");
}

async function performConfirmedAction() {
  const action = pendingConfirmAction;
  pendingConfirmAction = null;
  closeModal("confirmDialog");
  if (!action) return;
  try {
    await action();
    renderAll();
  } catch (error) {
    console.error("Confirmed action failed:", error);
    showToast("No se pudo completar la acción. Comprueba la conexión y los permisos.", "error");
  }
}

async function toggleAlert(alertId) {
  const record = alerts.find(function (item) { return item.id === alertId; });
  if (!record || !canManage(record)) return;
  const status = record.status === "activa" ? "resuelta" : "activa";
  try {
    await updateRecord("alerts", alertId, { status: status });
    record.status = status;
    showToast(status === "resuelta" ? "Alerta marcada como resuelta." : "Alerta reactivada.");
    renderAll();
  } catch (error) {
    showToast("No se pudo cambiar el estado de la alerta.", "error");
  }
}

const SENAMHI_STATIONS_URL = apiPath("/api/senamhi/stations");
const SENAMHI_OBSERVATIONS_URL = "https://wis.senamhi.gob.pe/oapi/collections/urn%3Awmo%3Amd%3Ape-senamhi%3Asynop-hourly/items?f=json";

async function getJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(function () { controller.abort(); }, timeoutMs || 18000);
  try {
    const response = await fetch(url, { headers: await apiHeaders(), signal: controller.signal, cache: "no-store" });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch (_) { throw new Error("El servicio devolvió una respuesta que no es JSON."); }
    if (!response.ok) throw new Error(result.detail || result.message || "Respuesta HTTP " + response.status);
    return result;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("La consulta demoró demasiado. Inténtalo nuevamente.");
    if (error instanceof TypeError) throw new Error("No se pudo acceder al servicio desde el navegador. Revisa la conexión o la disponibilidad de SENAMHI.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function geoFeatures(payload) {
  if (Array.isArray(payload.features)) return payload.features;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload)) return payload;
  return [];
}
function featureProperties(feature) { return feature && feature.properties ? feature.properties : feature || {}; }
function readFirst(object, names) {
  if (!object || typeof object !== "object") return undefined;
  const normalizedNames = names.map(function (name) { return name.toLowerCase().replace(/[^a-z0-9]/g, ""); });
  const entries = Object.entries(object);
  for (const entry of entries) {
    const key = entry[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalizedNames.includes(key) && entry[1] != null) return entry[1];
  }
  for (const entry of entries) {
    if (entry[1] && typeof entry[1] === "object") {
      const result = readFirst(entry[1], names);
      if (result !== undefined) return result;
    }
  }
  return undefined;
}
function stationInfo(feature) {
  const props = featureProperties(feature);
  const id = readFirst(props, ["wigos_station_identifier", "wigosIdentifier", "wigos", "stationId", "station_id", "id"]) || feature.id || "";
  const name = readFirst(props, ["name", "stationName", "station_name", "name_en", "station", "description"]) || feature.id || id || "Estación SENAMHI";
  return { id: String(id), name: String(name), props: props, feature: feature };
}

async function loadStations() {
  $("#loadStations").disabled = true;
  $("#stationStatus").textContent = "Consultando el catálogo oficial de estaciones…";
  try {
    const result = await getJson(SENAMHI_STATIONS_URL, 25000);
    senamhiStations = geoFeatures(result).map(stationInfo).filter(function (station) { return station.id; });
    senamhiStations.sort(function (a, b) { return a.name.localeCompare(b.name, "es"); });
    if (!senamhiStations.length) throw new Error("La respuesta no contiene estaciones disponibles.");
    renderStationOptions();
    $("#stationStatus").textContent = senamhiStations.length + " estaciones recibidas desde SENAMHI. Busca por nombre o identificador.";
  } catch (error) {
    $("#stationStatus").textContent = error.message + " Puedes continuar con el registro manual.";
    showToast("No se pudo cargar el catálogo de SENAMHI.", "error");
  } finally {
    $("#loadStations").disabled = false;
  }
}

function renderStationOptions() {
  const needle = $("#stationSearch").value.trim().toLocaleLowerCase("es-PE");
  const matched = senamhiStations.filter(function (station) {
    return !needle || (station.name + " " + station.id).toLocaleLowerCase("es-PE").includes(needle);
  }).slice(0, 150);
  const select = $("#stationSelect");
  if (!matched.length) {
    select.innerHTML = '<option value="">Sin coincidencias</option>';
    return;
  }
  select.innerHTML = '<option value="">Selecciona una estación</option>' + matched.map(function (station) {
    const index = senamhiStations.indexOf(station);
    return '<option value="' + index + '">' + escapeHtml(station.name) + " · " + escapeHtml(station.id) + "</option>";
  }).join("");
}

async function fetchStationObservations(station) {
  const url = new URL(apiPath("/api/senamhi/observations"), API_BASE_URL || window.location.origin);
  url.searchParams.set("station", station.id);
  return geoFeatures(await getJson(url.toString(), 26000));
}

function numericMeasurement(value, preferredNames) {
  if (value == null) return null;
  let unit = "";
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      for (const item of value) {
        const parsed = numericMeasurement(item, preferredNames);
        if (parsed !== null) return parsed;
      }
      return null;
    }
    unit = String(value.unit || value.units || value.uom || value.measurementUnit || "");
    let nested = value.value ?? value.amount ?? value.degrees ?? value.result ?? value.observedValue;
    if (nested == null) {
      const selected = readFirst(value, preferredNames || ["value", "amount", "degrees", "result"]);
      nested = selected;
    }
    value = nested;
  }
  const parsed = typeof value === "string" ? parseFloat(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (/kelvin|^k$/i.test(unit)) return parsed - 273.15;
  if (/^m$|metre|meter/i.test(unit)) return parsed * 1000;
  return parsed;
}

function findMeasurement(properties, names) {
  const value = readFirst(properties, names);
  return numericMeasurement(value, names);
}

function localDateTimeParts(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = {};
  parts.forEach(function (part) { values[part.type] = part.value; });
  return { date: values.year + "-" + values.month + "-" + values.day, time: values.hour + ":" + values.minute };
}

function observationFromSenamhi(feature, station) {
  const props = featureProperties(feature);
  const temp = findMeasurement(props, ["airTemperature", "temperature", "temperature_2m", "temp", "t2m", "ta"]);
  const rain = findMeasurement(props, ["precipitation", "precipitationAmount", "totalPrecipitation", "rainfall", "rain", "rr"]);
  const humidity = findMeasurement(props, ["relativeHumidity", "humidity", "relative_humidity", "rh"]);
  const windSpeed = findMeasurement(props, ["windSpeed", "wind_speed", "meanWindSpeed", "ff"]);
  const observedAt = readFirst(props, ["datetime", "obsTime", "phenomenonTime", "dateTime", "date", "referenceTime", "time", "observedAt"]);
  let date = "", time = "";
  if (observedAt) {
    const parts = localDateTimeParts(typeof observedAt === "string" ? observedAt : observedAt.value || observedAt.date || "");
    date = parts.date;
    time = parts.time;
  }
  if (!date) time = "";
  const skyValue = readFirst(props, ["weather", "weatherCondition", "skyCondition", "cloudCover"]);
  const sky = typeof skyValue === "object" ? (skyValue.description || skyValue.text || skyValue.value || "") : (skyValue == null ? "" : String(skyValue));
  return {
    date: date,
    time: time,
    location: station.name,
    temperature: temp,
    rainfall: rain,
    humidity: humidity,
    windSpeed: windSpeed,
    sky: sky,
    notes: "Importado del servicio horario de observaciones SYNOP de SENAMHI.",
    observationId: String(feature.id || readFirst(props, ["id", "data_id", "observationId"]) || ""),
    observedAt: observedAt || ""
  };
}

async function loadStationReading() {
  const selectedIndex = $("#stationSelect").value;
  if (selectedIndex === "") {
    $("#stationStatus").textContent = "Selecciona una estación antes de consultar.";
    return;
  }
  const station = senamhiStations[Number(selectedIndex)];
  if (!station) return;
  const button = $("#loadStationReading");
  button.disabled = true;
  button.textContent = "Consultando estación…";
  $("#stationStatus").textContent = "Buscando observaciones horarias publicadas por SENAMHI…";
  try {
    const features = await fetchStationObservations(station);
    if (!features.length) throw new Error("No se encontraron observaciones disponibles para esta estación. Prueba otra estación o registra la lectura manual.");
    const parsed = features.map(function (feature) { return observationFromSenamhi(feature, station); });
    const usable = parsed.filter(function (item) { return item.temperature !== null || item.rainfall !== null; });
    if (!usable.length) throw new Error("La API respondió, pero no se reconocieron temperatura o precipitación para esta estación.");
    usable.sort(function (a, b) { return (b.date + "T" + b.time).localeCompare(a.date + "T" + a.time); });
    const reading = usable[0];
    if (reading.temperature === null) throw new Error("La observación más reciente no contiene temperatura; consulta otra estación o completa el campo manualmente.");
    importedReading = { stationName: station.name, stationId: station.id, observationId: reading.observationId, observedAt: reading.observedAt };
    $("#obsDate").value = reading.date;
    $("#obsTime").value = reading.time;
    $("#obsLocation").value = station.name;
    $("#obsTemperature").value = reading.temperature == null ? "" : round(reading.temperature, 1);
    $("#obsRainfall").value = reading.rainfall == null ? "" : round(reading.rainfall, 1);
    $("#obsHumidity").value = reading.humidity == null ? "" : round(reading.humidity, 0);
    $("#obsWind").value = reading.windSpeed == null ? "" : round(reading.windSpeed, 1);
    $("#obsSky").value = ["Despejado", "Parcialmente nublado", "Nublado", "Llovizna", "Lluvia", "Tormenta", "Niebla"].includes(reading.sky) ? reading.sky : "";
    $("#obsNotes").value = reading.notes + (reading.observedAt ? " Fecha/hora de la fuente: " + reading.observedAt + "." : "");
    $("#importStationName").textContent = station.name;
    $("#importAttribution").classList.remove("is-hidden");
    setObservationSource("senamhi");
    $("#stationStatus").textContent = "Lectura recibida de " + station.name + (reading.date ? " · " + reading.date + (reading.time ? " " + reading.time : "") : "") + ". Completa los datos faltantes y revisa los campos antes de guardar.";
    showToast("Lectura de SENAMHI lista para revisar.");
  } catch (error) {
    console.error("SENAMHI request failed:", error);
    $("#stationStatus").textContent = error.message;
    showToast("No se pudo importar esta observación de SENAMHI.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Consultar última observación";
  }
}

function openSettings() {
  $("#weatherLat").value = Number(weatherLat).toFixed(4);
  $("#weatherLon").value = Number(weatherLon).toFixed(4);
  updateGoogleKeyState();
  showModal("settingsDialog");
  refreshWeatherStatus();
}

function saveSettings(event) {
  event.preventDefault();
  if (!$("#settingsForm").reportValidity()) return;
  weatherLat = Number($("#weatherLat").value);
  weatherLon = Number($("#weatherLon").value);
  if (!Number.isFinite(weatherLat) || !Number.isFinite(weatherLon)) {
    showToast("Ingresa coordenadas válidas.", "error");
    return;
  }
  if (usingCurrentLocation) weatherPlace = "Ubicación actual";
  else if (Number(weatherLat).toFixed(2) === "-12.84" && Number(weatherLon).toFixed(2) === "-74.57") weatherPlace = "Acobamba · Huancavelica";
  else weatherPlace = "Ubicación configurada";
  try {
    sessionStorage.setItem("agroclima_weather_lat", String(weatherLat));
    sessionStorage.setItem("agroclima_weather_lon", String(weatherLon));
    sessionStorage.setItem("agroclima_weather_place", weatherPlace);
  } catch (_) {}
  forecastDaily = [];
  forecastHourly = [];
  closeModal("settingsDialog");
  updateGoogleKeyState();
  renderForecast();
  if (googleConfigured && activeRoute === "forecast") loadForecast();
  else showToast("Coordenadas guardadas en esta pestaña.");
}

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    showToast("Este navegador no permite obtener la ubicación.", "error");
    return;
  }
  $("#useCurrentLocation").textContent = "Buscando ubicación…";
  navigator.geolocation.getCurrentPosition(function (position) {
    weatherLat = position.coords.latitude;
    weatherLon = position.coords.longitude;
    usingCurrentLocation = true;
    $("#weatherLat").value = weatherLat.toFixed(4);
    $("#weatherLon").value = weatherLon.toFixed(4);
    $("#useCurrentLocation").textContent = "⌖ Usar mi ubicación actual";
    showToast("Ubicación lista. Guarda la configuración para consultar el pronóstico.");
  }, function () {
    $("#useCurrentLocation").textContent = "⌖ Usar mi ubicación actual";
    showToast("No se pudo obtener la ubicación. Puedes ingresar las coordenadas manualmente.", "error");
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

function googleForecastUrl(endpoint, params) {
  const url = new URL(apiPath("/api/weather/" + endpoint), API_BASE_URL || window.location.origin);
  Object.keys(params).forEach(function (key) { url.searchParams.set(key, String(params[key])); });
  return url;
}

async function requestGoogleForecast(endpoint, params) {
  const url = googleForecastUrl(endpoint, params);
  const response = await fetch(url.toString(), { headers: await apiHeaders(), cache: "no-store" });
  let payload = {};
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok) {
    const message = payload.detail || (typeof payload.error === "string" ? payload.error : payload.error && payload.error.message ? payload.error.message : "Google Weather respondió HTTP " + response.status + ".");
    throw new Error(message);
  }
  return payload;
}

function dayDate(day) {
  if (day.displayDate && day.displayDate.year) {
    return String(day.displayDate.year) + "-" + pad(day.displayDate.month) + "-" + pad(day.displayDate.day);
  }
  return day.interval && day.interval.startTime ? day.interval.startTime.slice(0, 10) : "";
}
function weatherDescription(condition) {
  return condition && condition.description ? condition.description.text || condition.description : "";
}
function forecastDayValue(day) {
  const daytime = day.daytimeForecast || {};
  const nighttime = day.nighttimeForecast || {};
  const rainDay = daytime.precipitation || {};
  const rainNight = nighttime.precipitation || {};
  const probabilities = [rainDay.probability && rainDay.probability.percent, rainNight.probability && rainNight.probability.percent].filter(function (value) { return Number.isFinite(Number(value)); });
  const amounts = [rainDay.qpf && rainDay.qpf.quantity, rainNight.qpf && rainNight.qpf.quantity].filter(function (value) { return Number.isFinite(Number(value)); }).map(Number);
  const date = dayDate(day);
  return {
    date: date,
    label: formatShortDate(date),
    weekday: date ? formatDate(date, { weekday: "short" }) : "Día",
    description: weatherDescription(daytime.weatherCondition) || weatherDescription(nighttime.weatherCondition) || "Pronóstico diario",
    type: (daytime.weatherCondition || nighttime.weatherCondition || {}).type || "",
    max: toNumber(day.maxTemperature && day.maxTemperature.degrees),
    min: toNumber(day.minTemperature && day.minTemperature.degrees),
    rainPercent: probabilities.length ? Math.max.apply(null, probabilities) : null,
    rainAmount: amounts.length ? amounts.reduce(function (sum, value) { return sum + value; }, 0) : null
  };
}

function forecastHourValue(hour) {
  const timestamp = hour.interval && hour.interval.startTime || "";
  const date = new Date(timestamp);
  const displayTime = Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit" }).format(date);
  const rain = hour.precipitation && hour.precipitation.probability ? hour.precipitation.probability.percent : null;
  return {
    time: displayTime,
    description: weatherDescription(hour.weatherCondition) || "Condición prevista",
    type: hour.weatherCondition && hour.weatherCondition.type,
    temperature: toNumber(hour.temperature && hour.temperature.degrees),
    rainPercent: rain == null ? null : Number(rain)
  };
}

async function loadForecast() {
  $("#forecastError").classList.add("is-hidden");
  if (!googleConfigured) {
    forecastDaily = [];
    forecastHourly = [];
    renderForecast();
    return;
  }
  $("#refreshForecast").disabled = true;
  $("#refreshForecast").textContent = "Consultando…";
  $("#forecastUpdated").textContent = "Consultando Google Weather…";
  $("#forecastDays").innerHTML = "";
  $("#hourlyList").innerHTML = '<div class="hourly-placeholder">Consultando condiciones por hora…</div>';
  try {
    const dailyResult = await requestGoogleForecast("days", { "location.latitude": weatherLat, "location.longitude": weatherLon, days: 7 });
    forecastDaily = (dailyResult.forecastDays || []).map(forecastDayValue);
    try {
      const hourlyResult = await requestGoogleForecast("hours", { "location.latitude": weatherLat, "location.longitude": weatherLon, hours: 24 });
      forecastHourly = (hourlyResult.forecastHours || []).map(forecastHourValue);
    } catch (hourError) {
      forecastHourly = [];
      console.warn("Google hourly forecast unavailable:", hourError);
    }
    if (!forecastDaily.length) throw new Error("Google Weather no devolvió días de pronóstico para estas coordenadas.");
    $("#forecastUpdated").textContent = "Actualizado " + new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(now());
    renderForecast();
    showToast("Pronóstico actualizado.");
  } catch (error) {
    console.error("Google Weather request failed:", error);
    forecastDaily = [];
    forecastHourly = [];
    renderForecast();
    $("#forecastError").textContent = "No se pudo consultar Google Weather. " + error.message + " Verifica la clave del servidor, Weather API y la facturación del proyecto.";
    $("#forecastError").classList.remove("is-hidden");
    $("#forecastUpdated").textContent = "No disponible";
  } finally {
    $("#refreshForecast").disabled = false;
    $("#refreshForecast").innerHTML = "↻ Actualizar";
  }
}

function initSettings() {
  $("#openSettings").addEventListener("click", openSettings);
  $("#forecastSettings").addEventListener("click", openSettings);
  $("#configureForecast").addEventListener("click", openSettings);
  $("#settingsForm").addEventListener("submit", saveSettings);
  $("#useCurrentLocation").addEventListener("click", useCurrentLocation);
  $("#weatherLat").addEventListener("input", function () { usingCurrentLocation = false; });
  $("#weatherLon").addEventListener("input", function () { usingCurrentLocation = false; });
  $("#refreshForecast").addEventListener("click", loadForecast);
  $("#openSetupInfo").addEventListener("click", function () { showModal("setupDialog"); });
}

async function refreshWeatherStatus() {
  try {
    const response = await fetch(apiPath("/api/weather/status"), { headers: await apiHeaders(), cache: "no-store" });
    const result = await response.json();
    googleConfigured = response.ok && result.configured === true;
  } catch (_) {
    googleConfigured = false;
  }
  updateGoogleKeyState();
  renderForecast();
  if (googleConfigured && activeRoute === "forecast" && !forecastDaily.length) loadForecast();
}

function initObservationEvents() {
  $("#observationForm").addEventListener("submit", saveObservation);
  $("#newObservation").addEventListener("click", function () { openObservationForm(null); });
  $("#quickObservation").addEventListener("click", function () { openObservationForm(null); });
  $("#emptyNewObservation").addEventListener("click", function () { openObservationForm(null); });
  $$(".source-tab").forEach(function (button) {
    button.addEventListener("click", function () {
      setObservationSource(button.dataset.sourceTab);
      if (button.dataset.sourceTab === "manual" && !editingObservationId) {
        importedReading = null;
        $("#importAttribution").classList.add("is-hidden");
      }
    });
  });
  $("#loadStations").addEventListener("click", loadStations);
  $("#stationSearch").addEventListener("input", renderStationOptions);
  $("#loadStationReading").addEventListener("click", loadStationReading);
  $("#observationSearch").addEventListener("input", renderObservationTable);
  $("#observationSourceFilter").addEventListener("change", renderObservationTable);
  $("#dashFrom").addEventListener("change", renderDashboard);
  $("#dashTo").addEventListener("change", renderDashboard);
  $("#dashLocation").addEventListener("change", renderDashboard);
  $("#clearDashFilter").addEventListener("click", function () {
    $("#dashFrom").value = "";
    $("#dashTo").value = "";
    $("#dashLocation").value = "";
    renderDashboard();
  });
  $("#historyFrom").addEventListener("change", renderHistory);
  $("#historyTo").addEventListener("change", renderHistory);
  $("#historyLocation").addEventListener("change", renderHistory);
  $("#clearHistoryFilter").addEventListener("click", function () {
    $("#historyFrom").value = "";
    $("#historyTo").value = "";
    $("#historyLocation").value = "";
    renderHistory();
  });
}

function initAlertEvents() {
  $("#alertForm").addEventListener("submit", saveAlert);
  $("#newAlert").addEventListener("click", function () { openAlertForm(null); });
  $("#quickAlert").addEventListener("click", function () { openAlertForm(null); });
  $("#emptyNewAlert").addEventListener("click", function () { openAlertForm(null); });
  $("#alertStateFilter").addEventListener("change", renderAlerts);
  $("#alertSeverityFilter").addEventListener("change", renderAlerts);
}

function initNavigation() {
  $("#appView").addEventListener("click", function (event) {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) {
      showRoute(routeButton.dataset.route);
      return;
    }
    const editObservationButton = event.target.closest("[data-edit-observation]");
    if (editObservationButton) {
      const record = observations.find(function (item) { return item.id === editObservationButton.dataset.editObservation; });
      if (record && canManage(record)) openObservationForm(record);
      return;
    }
    const deleteObservationButton = event.target.closest("[data-delete-observation]");
    if (deleteObservationButton) {
      const record = observations.find(function (item) { return item.id === deleteObservationButton.dataset.deleteObservation; });
      if (!record || !canDeleteRecords()) return;
      askToConfirm("¿Eliminar esta observación?", "Esta entrada saldrá del histórico y no se puede recuperar.", async function () {
        await removeRecord("observations", record.id);
        observations = observations.filter(function (item) { return item.id !== record.id; });
        showToast("La observación se eliminó.");
      });
      return;
    }
    const toggleButton = event.target.closest("[data-toggle-alert]");
    if (toggleButton) {
      toggleAlert(toggleButton.dataset.toggleAlert);
      return;
    }
    const editAlertButton = event.target.closest("[data-edit-alert]");
    if (editAlertButton) {
      const record = alerts.find(function (item) { return item.id === editAlertButton.dataset.editAlert; });
      if (record && canManage(record)) openAlertForm(record);
      return;
    }
    const deleteAlertButton = event.target.closest("[data-delete-alert]");
    if (deleteAlertButton) {
      const record = alerts.find(function (item) { return item.id === deleteAlertButton.dataset.deleteAlert; });
      if (!record || !canDeleteRecords()) return;
      askToConfirm("¿Eliminar esta alerta?", "Se borrará el aviso y su información de seguimiento.", async function () {
        await removeRecord("alerts", record.id);
        alerts = alerts.filter(function (item) { return item.id !== record.id; });
        showToast("La alerta se eliminó.");
      });
    }
  });
  $("#openSidebar").addEventListener("click", function () {
    $("#sidebar").classList.add("is-open");
    $("#sidebarShade").classList.add("is-visible");
  });
  $("#closeSidebar").addEventListener("click", closeSidebar);
  $("#sidebarShade").addEventListener("click", closeSidebar);
  $("#cancelConfirm").addEventListener("click", function () { pendingConfirmAction = null; closeModal("confirmDialog"); });
  $("#acceptConfirm").addEventListener("click", performConfirmedAction);
  $("#refreshAdminUsers").addEventListener("click", async function () {
    if (!isAdmin() || demoMode) return;
    const button = $("#refreshAdminUsers");
    button.disabled = true;
    button.textContent = "Actualizando…";
    const refreshed = await readCloudData();
    button.disabled = false;
    button.textContent = "↻ Actualizar lista";
    showToast(refreshed ? "Lista de usuarios actualizada." : "No se pudo actualizar la lista.", refreshed ? "success" : "error");
  });
}

function initDialogs() {
  $$("[data-close]").forEach(function (button) {
    button.addEventListener("click", function () { closeModal(button.dataset.close); });
  });
  $$("dialog").forEach(function (dialog) {
    dialog.addEventListener("click", function (event) {
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside && dialog.id !== "confirmDialog") dialog.close();
    });
  });
}

function setInitialDateFilters() {
  const start = new Date();
  start.setDate(start.getDate() - 90);
  const dateValue = start.getFullYear() + "-" + pad(start.getMonth() + 1) + "-" + pad(start.getDate());
  $("#dashFrom").value = dateValue;
  $("#dashTo").value = todayISO();
  $("#historyFrom").value = dateValue;
  $("#historyTo").value = todayISO();
}

function initializeAppUi() {
  initAuth();
  initNavigation();
  initObservationEvents();
  initAlertEvents();
  initPlantingAssistant();
  initSettings();
  initDialogs();
  setInitialDateFilters();
  renderForecast();
  refreshWeatherStatus();
  const savedDemo = keyFromStorage("agroclima_demo") === "1";
  if (savedDemo) startDemo();
  firebaseReadyPromise = initFirebase();
}

initializeAppUi();
