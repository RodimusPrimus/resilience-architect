/**
 * Dashboard Renderer — Chart.js visualizations and tradeoff cards.
 *
 * Renders pie chart (strategy distribution), quadrant chart (cost vs criticality),
 * and tradeoff cards (pros/cons per strategy). Handles Chart.js CDN unavailability
 * with fallback tables.
 */

import { STRATEGY_INFO } from './mapping-engine.js';
import { t } from './i18n.js';

/**
 * Accessible, distinct colors for each DR strategy.
 * @type {Record<string, string>}
 */
const STRATEGY_COLORS = {
  'backup-restore': '#f59e0b',
  'pilot-light': '#3b82f6',
  'warm-standby': '#10b981',
  'multi-site-active-active': '#ef4444'
};

/**
 * Strategy display labels (i18n keys).
 * @type {Record<string, string>}
 */
const STRATEGY_LABEL_KEYS = {
  'backup-restore': 'strategy.backupRestore',
  'pilot-light': 'strategy.pilotLight',
  'warm-standby': 'strategy.warmStandby',
  'multi-site-active-active': 'strategy.multiSiteActiveActive'
};

/**
 * Criticality tier to X-axis numeric value mapping.
 * @type {Record<string, number>}
 */
const CRITICALITY_X = {
  'tier3': 1,
  'tier2': 2,
  'tier1': 3
};

/** @type {import('chart.js').Chart | null} */
let pieChartInstance = null;

/** @type {import('chart.js').Chart | null} */
let quadrantChartInstance = null;

/** @type {string} */
let currentTheme = 'dark';

/**
 * Returns the text color based on the current theme.
 * @param {string} theme - 'dark' or 'light'
 * @returns {string} CSS color value
 */
function getTextColor(theme) {
  return theme === 'dark' ? '#f0f0f0' : '#1e293b';
}

/**
 * Returns the grid/border color based on the current theme.
 * @param {string} theme - 'dark' or 'light'
 * @returns {string} CSS color value
 */
function getGridColor(theme) {
  return theme === 'dark' ? '#2a3a5e' : '#cbd5e1';
}

/**
 * Groups workloads by their assigned strategy.
 * @param {object[]} workloads - Array of MappedWorkload objects
 * @returns {Record<string, object[]>} Workloads grouped by strategy key
 */
function groupByStrategy(workloads) {
  const groups = {};
  for (const w of workloads) {
    if (!groups[w.strategy]) {
      groups[w.strategy] = [];
    }
    groups[w.strategy].push(w);
  }
  return groups;
}

/**
 * Checks if Chart.js is available (loaded via CDN).
 * @returns {boolean}
 */
function isChartAvailable() {
  return typeof window !== 'undefined' && typeof window.Chart !== 'undefined';
}

/**
 * Orchestrates full dashboard rendering: pie chart, quadrant chart, and tradeoff cards.
 * @param {object} config - Dashboard configuration
 * @param {object[]} config.workloads - Array of MappedWorkload objects
 * @param {string} config.locale - 'en' or 'es'
 * @param {string} config.theme - 'dark' or 'light'
 */
export function renderDashboard(config) {
  const { workloads, theme } = config;
  currentTheme = theme || 'dark';

  // Determine unique strategies present in workloads
  const strategies = [...new Set(workloads.map(w => w.strategy))];

  renderPieChart(workloads);
  renderQuadrantChart(workloads);
  renderTradeoffCards(strategies);
}

/**
 * Creates a Chart.js pie chart showing strategy distribution.
 * Falls back to a table if Chart.js is unavailable.
 * @param {object[]} workloads - Array of MappedWorkload objects
 * @returns {object|null} Chart instance or null if fallback used
 */
export function renderPieChart(workloads) {
  const canvas = document.getElementById('pie-chart');
  const fallbackEl = document.getElementById('pie-chart-fallback');

  if (!isChartAvailable()) {
    renderPieChartFallback(workloads, canvas, fallbackEl);
    return null;
  }

  // Show canvas, hide fallback
  if (canvas) canvas.parentElement.classList.remove('hidden');
  if (fallbackEl) fallbackEl.classList.add('hidden');

  const groups = groupByStrategy(workloads);
  const labels = [];
  const data = [];
  const colors = [];
  const workloadNames = [];

  for (const strategy of Object.keys(STRATEGY_COLORS)) {
    if (groups[strategy]) {
      const label = t(STRATEGY_LABEL_KEYS[strategy]);
      const count = groups[strategy].length;
      labels.push(`${label} (${count})`);
      data.push(count);
      colors.push(STRATEGY_COLORS[strategy]);
      workloadNames.push(groups[strategy].map(w => w.name));
    }
  }

  // Destroy existing chart instance if present
  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  const ctx = canvas.getContext('2d');
  pieChartInstance = new window.Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: currentTheme === 'dark' ? '#1a1a2e' : '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getTextColor(currentTheme),
            font: { size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            afterLabel: function(context) {
              const names = workloadNames[context.dataIndex];
              if (names && names.length > 0) {
                return names.join(', ');
              }
              return '';
            }
          }
        }
      }
    }
  });

  return pieChartInstance;
}

/**
 * Renders a fallback table when Chart.js is unavailable for the pie chart.
 * @param {object[]} workloads - Array of MappedWorkload objects
 * @param {HTMLCanvasElement|null} canvas - The canvas element to hide
 * @param {HTMLElement|null} fallbackEl - The fallback container element
 */
function renderPieChartFallback(workloads, canvas, fallbackEl) {
  if (canvas) canvas.parentElement.classList.add('hidden');
  if (!fallbackEl) return;

  fallbackEl.classList.remove('hidden');

  const groups = groupByStrategy(workloads);
  let html = '<table role="table" aria-label="Strategy distribution"><thead><tr>';
  html += `<th scope="col">${t('dashboard.pieChart.title')}</th>`;
  html += '<th scope="col">#</th>';
  html += '<th scope="col">Workloads</th>';
  html += '</tr></thead><tbody>';

  for (const strategy of Object.keys(STRATEGY_COLORS)) {
    if (groups[strategy]) {
      const label = t(STRATEGY_LABEL_KEYS[strategy]);
      const count = groups[strategy].length;
      const names = groups[strategy].map(w => w.name).join(', ');
      html += `<tr><td>${label}</td><td>${count}</td><td>${escapeForTable(names)}</td></tr>`;
    }
  }

  html += '</tbody></table>';
  fallbackEl.innerHTML = html;
}

/**
 * Creates a Chart.js scatter chart plotting workloads by cost (Y) vs criticality (X).
 * Falls back to a table if Chart.js is unavailable.
 * @param {object[]} workloads - Array of MappedWorkload objects
 * @returns {object|null} Chart instance or null if fallback used
 */
export function renderQuadrantChart(workloads) {
  const canvas = document.getElementById('quadrant-chart');
  const fallbackEl = document.getElementById('quadrant-chart-fallback');

  if (!isChartAvailable()) {
    renderQuadrantChartFallback(workloads, canvas, fallbackEl);
    return null;
  }

  // Show canvas, hide fallback
  if (canvas) canvas.parentElement.classList.remove('hidden');
  if (fallbackEl) fallbackEl.classList.add('hidden');

  // Build datasets grouped by strategy for color coding
  const groups = groupByStrategy(workloads);
  const datasets = [];

  for (const strategy of Object.keys(STRATEGY_COLORS)) {
    if (groups[strategy]) {
      const points = groups[strategy].map(w => ({
        x: CRITICALITY_X[w.criticality] || 1,
        y: STRATEGY_INFO[strategy].costLevel,
        label: w.name
      }));

      datasets.push({
        label: t(STRATEGY_LABEL_KEYS[strategy]),
        data: points,
        backgroundColor: STRATEGY_COLORS[strategy],
        borderColor: STRATEGY_COLORS[strategy],
        pointRadius: 8,
        pointHoverRadius: 11
      });
    }
  }

  // Destroy existing chart instance if present
  if (quadrantChartInstance) {
    quadrantChartInstance.destroy();
    quadrantChartInstance = null;
  }

  const ctx = canvas.getContext('2d');
  quadrantChartInstance = new window.Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Criticality',
            color: getTextColor(currentTheme)
          },
          min: 0.5,
          max: 3.5,
          ticks: {
            stepSize: 1,
            color: getTextColor(currentTheme),
            callback: function(value) {
              const labels = { 1: 'Tier 3', 2: 'Tier 2', 3: 'Tier 1' };
              return labels[value] || '';
            }
          },
          grid: {
            color: getGridColor(currentTheme)
          }
        },
        y: {
          title: {
            display: true,
            text: 'Cost Level',
            color: getTextColor(currentTheme)
          },
          min: 0.5,
          max: 4.5,
          ticks: {
            stepSize: 1,
            color: getTextColor(currentTheme),
            callback: function(value) {
              const labels = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Very High' };
              return labels[value] || '';
            }
          },
          grid: {
            color: getGridColor(currentTheme)
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getTextColor(currentTheme),
            font: { size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const point = context.raw;
              return point.label || '';
            }
          }
        }
      }
    }
  });

  return quadrantChartInstance;
}

/**
 * Renders a fallback table when Chart.js is unavailable for the quadrant chart.
 * @param {object[]} workloads - Array of MappedWorkload objects
 * @param {HTMLCanvasElement|null} canvas - The canvas element to hide
 * @param {HTMLElement|null} fallbackEl - The fallback container element
 */
function renderQuadrantChartFallback(workloads, canvas, fallbackEl) {
  if (canvas) canvas.parentElement.classList.add('hidden');
  if (!fallbackEl) return;

  fallbackEl.classList.remove('hidden');

  let html = '<table role="table" aria-label="Cost vs criticality matrix"><thead><tr>';
  html += '<th scope="col">Workload</th>';
  html += '<th scope="col">Strategy</th>';
  html += '<th scope="col">Criticality</th>';
  html += '<th scope="col">Cost Level</th>';
  html += '</tr></thead><tbody>';

  for (const w of workloads) {
    const strategyLabel = t(STRATEGY_LABEL_KEYS[w.strategy]);
    const costLevel = STRATEGY_INFO[w.strategy].costLevel;
    html += `<tr><td>${escapeForTable(w.name)}</td><td>${strategyLabel}</td><td>${w.criticality}</td><td>${costLevel}</td></tr>`;
  }

  html += '</tbody></table>';
  fallbackEl.innerHTML = html;
}

/**
 * Renders tradeoff cards (pros/cons) for each assigned strategy.
 * Only shows cards for strategies that have at least one workload assigned.
 * @param {string[]} strategies - Array of unique strategy keys present in workloads
 */
export function renderTradeoffCards(strategies) {
  const container = document.getElementById('tradeoff-cards');
  if (!container) return;

  container.innerHTML = '';

  for (const strategy of strategies) {
    const info = STRATEGY_INFO[strategy];
    if (!info) continue;

    const card = document.createElement('div');
    card.className = 'tradeoff-card';
    card.setAttribute('role', 'listitem');

    const title = document.createElement('h4');
    title.textContent = t(STRATEGY_LABEL_KEYS[strategy]);
    title.style.borderLeft = `4px solid ${STRATEGY_COLORS[strategy]}`;
    title.style.paddingLeft = '8px';
    card.appendChild(title);

    // Pros section
    const prosHeading = document.createElement('p');
    prosHeading.className = 'pros-heading';
    prosHeading.textContent = t('dashboard.tradeoff.pros');
    prosHeading.style.fontWeight = '600';
    prosHeading.style.marginTop = '0.5rem';
    card.appendChild(prosHeading);

    const prosList = document.createElement('ul');
    prosList.className = 'pros';
    for (const proKey of info.pros) {
      const li = document.createElement('li');
      li.textContent = t(proKey);
      prosList.appendChild(li);
    }
    card.appendChild(prosList);

    // Cons section
    const consHeading = document.createElement('p');
    consHeading.className = 'cons-heading';
    consHeading.textContent = t('dashboard.tradeoff.cons');
    consHeading.style.fontWeight = '600';
    consHeading.style.marginTop = '0.5rem';
    card.appendChild(consHeading);

    const consList = document.createElement('ul');
    consList.className = 'cons';
    for (const conKey of info.cons) {
      const li = document.createElement('li');
      li.textContent = t(conKey);
      consList.appendChild(li);
    }
    card.appendChild(consList);

    container.appendChild(card);
  }
}

/**
 * Updates chart colors when theme changes.
 * @param {string} theme - 'dark' or 'light'
 */
export function updateChartsTheme(theme) {
  currentTheme = theme;

  if (pieChartInstance) {
    const borderColor = theme === 'dark' ? '#1a1a2e' : '#ffffff';
    pieChartInstance.data.datasets[0].borderColor = borderColor;
    pieChartInstance.options.plugins.legend.labels.color = getTextColor(theme);
    pieChartInstance.update();
  }

  if (quadrantChartInstance) {
    const textColor = getTextColor(theme);
    const gridColor = getGridColor(theme);

    quadrantChartInstance.options.scales.x.title.color = textColor;
    quadrantChartInstance.options.scales.x.ticks.color = textColor;
    quadrantChartInstance.options.scales.x.grid.color = gridColor;
    quadrantChartInstance.options.scales.y.title.color = textColor;
    quadrantChartInstance.options.scales.y.ticks.color = textColor;
    quadrantChartInstance.options.scales.y.grid.color = gridColor;
    quadrantChartInstance.options.plugins.legend.labels.color = textColor;
    quadrantChartInstance.update();
  }
}

/**
 * Minimal HTML escape for fallback table content.
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for innerHTML in table context
 */
function escapeForTable(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
