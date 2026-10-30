import Chart from 'chart.js/auto';

const STORAGE_KEY = 'aeterna_finances_scenarios';
const LEGACY_STORAGE_KEY = 'moniflow_scenarios';

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const fields = {
  income: {
    range: $('#range-income'),
    number: $('#num-income'),
    display: $('#display-income'),
  },
  fixed: {
    range: $('#range-fixed'),
    number: $('#num-fixed'),
    display: $('#display-fixed'),
  },
  variable: {
    range: $('#range-variable'),
    number: $('#num-variable'),
    display: $('#display-variable'),
  },
  savings: {
    range: $('#range-savings'),
    number: $('#num-savings'),
    display: $('#display-savings'),
  },
};

const metricRemaining = $('#metric-remaining');
const metricRate = $('#metric-rate');
const statusBadge = $('#status-badge');
const badgeTitle = $('#badge-title');
const badgeDesc = $('#badge-desc');
const modal = $('#modal-scenarios');
const modalTitle = $('#modal-title');
const modalBody = $('#modal-body');
const mobileMenu = $('#mobile-menu');
let distributionChart;
let projectionChart;
let lastFocusedElement = null;

const formatCurrency = (value) =>
  `${new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value)} MXN`;

const formatCurrencyShort = (value) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);

function getFieldValue(field) {
  const value = Number.parseFloat(field.number.value);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function syncField(field, source) {
  const rawValue = source.value;
  const value = Math.max(0, Number.parseFloat(rawValue) || 0);

  if (source === field.range) {
    field.number.value = String(value);
  } else {
    // A numeric field may exceed the slider's maximum; keep the typed value
    // and clamp only the visual slider thumb to its supported range.
    const min = Number(field.range.min || 0);
    const max = Number(field.range.max || Number.MAX_SAFE_INTEGER);
    field.range.value = String(Math.min(max, Math.max(min, value)));
  }

  field.display.textContent = formatCurrency(value);
  updateCalculations();
}

function bindFields() {
  Object.values(fields).forEach((field) => {
    field.range.addEventListener('input', (event) => syncField(field, event.currentTarget));
    field.number.addEventListener('input', (event) => syncField(field, event.currentTarget));
    field.number.addEventListener('blur', () => {
      if (field.number.value.trim() === '') {
        field.number.value = '0';
        field.display.textContent = formatCurrency(0);
        updateCalculations();
      }
    });
  });
}

function updateStatus(remaining, savingsRate) {
  const icon = $('i', statusBadge);

  if (remaining < 0) {
    statusBadge.className = 'p-4 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 flex items-start space-x-3';
    icon.className = 'fa-solid fa-triangle-exclamation text-xl text-rose-600 mt-0.5';
    badgeTitle.textContent = 'Presupuesto Deficitario';
    badgeDesc.textContent = 'Tus egresos superan tus ingresos netos. Revisa tus gastos variables o fijos.';
  } else if (savingsRate < 10) {
    statusBadge.className = 'p-4 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-start space-x-3';
    icon.className = 'fa-solid fa-circle-exclamation text-xl text-amber-600 mt-0.5';
    badgeTitle.textContent = 'Margen Moderado';
    badgeDesc.textContent = 'Tu margen es positivo, pero tu tasa de ahorro es baja (menor al 10%).';
  } else {
    statusBadge.className = 'p-4 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-start space-x-3';
    icon.className = 'fa-solid fa-circle-check text-xl text-emerald-600 mt-0.5';
    badgeTitle.textContent = 'Presupuesto Saludable';
    badgeDesc.textContent = 'Tus gastos e ingresos están en equilibrio. Mantienes margen para imprevistos.';
  }
}

function renderCharts(income, fixed, variable, savings, remaining) {
  const distributionCanvas = $('#chartDistribution');
  const projectionCanvas = $('#chartProjection');
  if (!distributionCanvas || !projectionCanvas) return;

  distributionChart?.destroy();
  distributionChart = new Chart(distributionCanvas, {
    type: 'doughnut',
    data: {
      labels: ['Gastos Fijos', 'Gastos Variables', 'Ahorro', 'Restante'],
      datasets: [{
        data: [fixed, variable, savings, remaining],
        backgroundColor: ['#f43f5e', '#f59e0b', '#10b981', '#6366f1'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
    },
  });

  projectionChart?.destroy();
  projectionChart = new Chart(projectionCanvas, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 12 }, (_, index) => `M${index + 1}`),
      datasets: [{
        label: 'Ahorro Acumulado (MXN)',
        data: Array.from({ length: 12 }, (_, index) => savings * (index + 1)),
        backgroundColor: '#10b981',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function updateDynamicTips(income, fixed, savingsRate) {
  const container = $('#tips-container');
  const fixedRatio = income > 0 ? ((fixed / income) * 100).toFixed(0) : '0';
  const emergencyFund = formatCurrencyShort(fixed * 3);
  const savingsMessage = savingsRate >= 20
    ? '¡Excelente! Estás cumpliendo o superando la meta recomendada del 20% para tu futuro.'
    : 'Intenta ajustar progresivamente un 2% o 5% adicional hasta acercarte al estándar del 20%.';
  const fixedMessage = Number(fixedRatio) > 50
    ? 'Tus costos fijos comprometen más del 50% de tus ingresos. Evalúa renegociar servicios o deudas.'
    : 'Tus gastos fijos se encuentran dentro de un margen manejable y saludable.';

  container.innerHTML = `
    <article class="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-3">
      <div class="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center font-bold">
        <i class="fa-solid fa-piggy-bank" aria-hidden="true"></i>
      </div>
      <h4 class="font-bold text-lg">Capacidad de Ahorro (${savingsRate.toFixed(1)}%)</h4>
      <p class="text-slate-400 text-sm leading-relaxed">${savingsMessage}</p>
    </article>
    <article class="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-3">
      <div class="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center font-bold">
        <i class="fa-solid fa-shield-cat" aria-hidden="true"></i>
      </div>
      <h4 class="font-bold text-lg">Fondo de Emergencia</h4>
      <p class="text-slate-400 text-sm leading-relaxed">Con tus gastos fijos actuales, se recomienda acumular un colchón inicial de 3 meses equivalente a <strong>${emergencyFund} MXN</strong>.</p>
    </article>
    <article class="bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-3">
      <div class="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center font-bold">
        <i class="fa-solid fa-scale-balanced" aria-hidden="true"></i>
      </div>
      <h4 class="font-bold text-lg">Gastos Fijos (${fixedRatio}%)</h4>
      <p class="text-slate-400 text-sm leading-relaxed">${fixedMessage}</p>
    </article>
  `;
}

function updateCalculations() {
  const income = getFieldValue(fields.income);
  const fixed = getFieldValue(fields.fixed);
  const variable = getFieldValue(fields.variable);
  const savings = getFieldValue(fields.savings);
  const remaining = income - fixed - variable - savings;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  metricRemaining.textContent = formatCurrency(remaining);
  metricRemaining.className = `text-2xl font-extrabold mt-1 ${remaining < 0 ? 'text-rose-600' : 'text-slate-900'}`;
  metricRate.textContent = `${savingsRate.toFixed(1)}%`;

  updateStatus(remaining, savingsRate);
  renderCharts(income, fixed, variable, savings, Math.max(0, remaining));
  updateDynamicTips(income, fixed, savingsRate);
}

function readSavedScenarios() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const parsed = JSON.parse(current ?? legacy ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('No fue posible leer los escenarios guardados:', error);
    return [];
  }
}

function writeSavedScenarios(scenarios) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    return true;
  } catch (error) {
    console.error('No fue posible guardar los escenarios:', error);
    alert('No fue posible guardar el escenario. Revisa el almacenamiento disponible en tu navegador.');
    return false;
  }
}

function saveCurrentScenario() {
  const nameInput = $('#scenario-name');
  const name = nameInput.value.trim() || `Simulación ${new Date().toLocaleDateString('es-MX')}`;
  const scenario = {
    name,
    income: getFieldValue(fields.income),
    fixed: getFieldValue(fields.fixed),
    variable: getFieldValue(fields.variable),
    savings: getFieldValue(fields.savings),
    date: new Date().toLocaleDateString('es-MX'),
  };

  const scenarios = readSavedScenarios();
  scenarios.push(scenario);
  if (writeSavedScenarios(scenarios)) {
    nameInput.value = '';
    alert(`¡Simulación "${name}" guardada localmente!`);
  }
}

function createScenarioCard(scenario, index) {
  const card = document.createElement('article');
  card.className = 'bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3';

  const details = document.createElement('div');
  details.className = 'min-w-0';
  const title = document.createElement('h4');
  title.className = 'font-bold text-slate-900 text-sm break-words';
  title.textContent = String(scenario.name ?? `Simulación ${index + 1}`);
  const summary = document.createElement('p');
  summary.className = 'text-xs text-slate-500';
  summary.textContent = `Ingresos: ${formatCurrencyShort(Number(scenario.income) || 0)} • Ahorro: ${formatCurrencyShort(Number(scenario.savings) || 0)}`;
  const date = document.createElement('span');
  date.className = 'text-[10px] text-slate-400';
  date.textContent = String(scenario.date ?? '');
  details.append(title, summary, date);

  const actions = document.createElement('div');
  actions.className = 'flex flex-shrink-0 space-x-2';
  const loadButton = document.createElement('button');
  loadButton.type = 'button';
  loadButton.dataset.action = 'load-scenario';
  loadButton.dataset.index = String(index);
  loadButton.className = 'bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors';
  loadButton.textContent = 'Cargar';
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.dataset.action = 'delete-scenario';
  deleteButton.dataset.index = String(index);
  deleteButton.className = 'bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors';
  deleteButton.setAttribute('aria-label', `Eliminar ${title.textContent}`);
  deleteButton.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
  actions.append(loadButton, deleteButton);
  card.append(details, actions);
  return card;
}

function renderScenarioModal() {
  const scenarios = readSavedScenarios();
  modalTitle.textContent = 'Escenarios Guardados';
  modalBody.replaceChildren();

  if (scenarios.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-6 space-y-3';
    empty.innerHTML = '<i class="fa-solid fa-folder-open text-4xl text-slate-300" aria-hidden="true"></i>';
    const message = document.createElement('p');
    message.className = 'text-sm text-slate-500';
    message.textContent = 'No hay escenarios guardados en este navegador todavía.';
    empty.append(message);
    modalBody.append(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'space-y-3 max-h-80 overflow-y-auto pr-1';
  scenarios.forEach((scenario, index) => list.append(createScenarioCard(scenario, index)));
  modalBody.append(list);
}

function openSaveModal() {
  lastFocusedElement = document.activeElement;
  renderScenarioModal();
  modal.classList.remove('hidden');
  $('button', modal)?.focus();
}

function closeSaveModal() {
  modal.classList.add('hidden');
  lastFocusedElement?.focus?.();
}

function loadScenario(index) {
  const scenario = readSavedScenarios()[index];
  if (!scenario) return;

  Object.entries(fields).forEach(([key, field]) => {
    const value = Math.max(0, Number(scenario[key]) || 0);
    field.number.value = String(value);
    const min = Number(field.range.min || 0);
    const max = Number(field.range.max || Number.MAX_SAFE_INTEGER);
    field.range.value = String(Math.min(max, Math.max(min, value)));
    field.display.textContent = formatCurrency(value);
  });

  updateCalculations();
  closeSaveModal();
}

function deleteScenario(index) {
  const scenarios = readSavedScenarios();
  if (index < 0 || index >= scenarios.length) return;
  scenarios.splice(index, 1);
  if (writeSavedScenarios(scenarios)) renderScenarioModal();
}

function toggleFaq(button) {
  const content = button.nextElementSibling;
  const icon = $('i', button);
  if (!content) return;
  const isOpening = content.classList.contains('hidden');
  content.classList.toggle('hidden', !isOpening);
  button.setAttribute('aria-expanded', String(isOpening));
  icon?.classList.toggle('rotate-180', isOpening);
}

function bindInterfaceEvents() {
  document.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const { action, index } = actionButton.dataset;
      switch (action) {
        case 'open-save-modal':
          openSaveModal();
          break;
        case 'close-save-modal':
          closeSaveModal();
          break;
        case 'save-scenario':
          saveCurrentScenario();
          break;
        case 'toggle-faq':
          toggleFaq(actionButton);
          break;
        case 'load-scenario':
          loadScenario(Number(index));
          break;
        case 'delete-scenario':
          deleteScenario(Number(index));
          break;
        default:
          break;
      }
    }

    if (event.target === modal) closeSaveModal();
  });

  $('#mobile-menu-btn').addEventListener('click', () => {
    const isHidden = mobileMenu.classList.toggle('hidden');
    $('#mobile-menu-btn').setAttribute('aria-expanded', String(!isHidden));
  });

  $$('#mobile-menu a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
      $('#mobile-menu-btn').setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeSaveModal();
  });
}

function initialize() {
  bindFields();
  bindInterfaceEvents();
  updateCalculations();
}

initialize();
