/**
 * App Entry Point — Module orchestration and event wiring.
 *
 * Initializes all modules (theme, i18n, wizard, service worker, PDF),
 * wires event listeners for language/theme toggles and export,
 * connects wizard completion to dashboard rendering,
 * and integrates session guard for refresh protection.
 *
 * Requirements: 1.1, 1.2, 1.3, 3.2, 15.5
 */

import { initWizard, onDashboard, getCurrentStep } from './wizard.js';
import { initTheme, toggleTheme, getTheme } from './theme.js';
import { initI18n, setLocale, getLocale } from './i18n.js';
import { saveToSession, loadFromSession, hasSessionData } from './session-guard.js';
import { renderDashboard, updateChartsTheme } from './dashboard.js';
import { exportDashboardToPDF, checkPDFAvailability } from './pdf-export.js';
import { registerServiceWorker } from './sw-register.js';

/**
 * Debounce utility — delays execution until after a pause in calls.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * Collects raw workload data from the form for session persistence.
 * @returns {Array<object>} Array of workload objects from the form
 */
function collectWorkloadsFromForm() {
  const entries = document.querySelectorAll('.workload-entry');
  const workloads = [];

  entries.forEach((entry) => {
    const id = entry.getAttribute('data-workload-id') || '';
    const nameInput = entry.querySelector('.workload-name');
    const criticalitySelect = entry.querySelector('.workload-criticality');
    const rtoValueInput = entry.querySelector('.workload-rto-value');
    const rtoUnitSelect = entry.querySelector('.workload-rto-unit');
    const rpoValueInput = entry.querySelector('.workload-rpo-value');
    const rpoUnitSelect = entry.querySelector('.workload-rpo-unit');

    workloads.push({
      id: `wl-${id}`,
      name: nameInput ? nameInput.value : '',
      criticality: criticalitySelect ? criticalitySelect.value : '',
      rto: {
        value: rtoValueInput ? rtoValueInput.value : '',
        unit: rtoUnitSelect ? rtoUnitSelect.value : 'hours'
      },
      rpo: {
        value: rpoValueInput ? rpoValueInput.value : '',
        unit: rpoUnitSelect ? rpoUnitSelect.value : 'hours'
      }
    });
  });

  return workloads;
}

/**
 * Restores workload data from session storage into the form.
 * @param {Array<object>} workloads - Saved workload objects
 */
function restoreWorkloadsToForm(workloads) {
  if (!workloads || workloads.length === 0) return;

  const workloadList = document.getElementById('workload-list');
  if (!workloadList) return;

  // Get the first entry as template
  const firstEntry = workloadList.querySelector('.workload-entry');
  if (!firstEntry) return;

  // Fill the first entry with the first workload
  fillWorkloadEntry(firstEntry, workloads[0], 1);

  // Add additional entries for remaining workloads
  for (let i = 1; i < workloads.length; i++) {
    const newEntry = firstEntry.cloneNode(true);
    const id = i + 1;

    newEntry.setAttribute('data-workload-id', id);

    const numberSpan = newEntry.querySelector('.workload-number');
    if (numberSpan) numberSpan.textContent = id;

    // Update IDs
    const nameInput = newEntry.querySelector('.workload-name');
    if (nameInput) nameInput.id = `workload-name-${id}`;

    const criticalitySelect = newEntry.querySelector('.workload-criticality');
    if (criticalitySelect) criticalitySelect.id = `workload-criticality-${id}`;

    const rtoValueInput = newEntry.querySelector('.workload-rto-value');
    if (rtoValueInput) rtoValueInput.id = `workload-rto-value-${id}`;

    const rtoUnitSelect = newEntry.querySelector('.workload-rto-unit');
    if (rtoUnitSelect) rtoUnitSelect.id = `workload-rto-unit-${id}`;

    const rpoValueInput = newEntry.querySelector('.workload-rpo-value');
    if (rpoValueInput) rpoValueInput.id = `workload-rpo-value-${id}`;

    const rpoUnitSelect = newEntry.querySelector('.workload-rpo-unit');
    if (rpoUnitSelect) rpoUnitSelect.id = `workload-rpo-unit-${id}`;

    // Update labels
    const labels = newEntry.querySelectorAll('label');
    labels.forEach((label) => {
      const forAttr = label.getAttribute('for');
      if (forAttr) {
        label.setAttribute('for', forAttr.replace(/-\d+$/, `-${id}`));
      }
    });

    // Update remove button
    const removeBtn = newEntry.querySelector('.btn-remove-workload');
    if (removeBtn) {
      removeBtn.setAttribute('aria-label', `Remove workload ${id}`);
    }

    fillWorkloadEntry(newEntry, workloads[i], id);
    workloadList.appendChild(newEntry);
  }
}

/**
 * Fills a workload entry element with saved data.
 * @param {Element} entry - The workload fieldset element
 * @param {object} workload - The saved workload data
 * @param {number} id - The workload ID number
 */
function fillWorkloadEntry(entry, workload, id) {
  const nameInput = entry.querySelector('.workload-name');
  if (nameInput) nameInput.value = workload.name || '';

  const criticalitySelect = entry.querySelector('.workload-criticality');
  if (criticalitySelect && workload.criticality) {
    criticalitySelect.value = workload.criticality;
  }

  const rtoValueInput = entry.querySelector('.workload-rto-value');
  if (rtoValueInput && workload.rto) {
    rtoValueInput.value = workload.rto.value || '';
  }

  const rtoUnitSelect = entry.querySelector('.workload-rto-unit');
  if (rtoUnitSelect && workload.rto) {
    rtoUnitSelect.value = workload.rto.unit || 'hours';
  }

  const rpoValueInput = entry.querySelector('.workload-rpo-value');
  if (rpoValueInput && workload.rpo) {
    rpoValueInput.value = workload.rpo.value || '';
  }

  const rpoUnitSelect = entry.querySelector('.workload-rpo-unit');
  if (rpoUnitSelect && workload.rpo) {
    rpoUnitSelect.value = workload.rpo.unit || 'hours';
  }
}

/**
 * Initializes the application: theme, i18n, wizard, service worker,
 * PDF availability, session restoration, and event wiring.
 */
async function initApp() {
  // Initialize theme (synchronous — applies immediately)
  initTheme();

  // Initialize i18n (async — loads translation files)
  // Non-blocking: if translations fail to load, the app still works with hardcoded text
  try {
    await initI18n('en');
  } catch (error) {
    console.warn('App: i18n initialization failed, continuing with default text.', error);
  }

  // Initialize wizard (sets up step navigation and form handling)
  initWizard();

  // Register service worker (non-blocking)
  registerServiceWorker();

  // Check PDF library availability
  checkPDFAvailability();

  // Restore session data if available
  if (hasSessionData()) {
    const savedWorkloads = loadFromSession();
    if (savedWorkloads && savedWorkloads.length > 0) {
      restoreWorkloadsToForm(savedWorkloads);
    }
  }

  // Wire wizard dashboard callback
  onDashboard((mappedWorkloads) => {
    renderDashboard({
      workloads: mappedWorkloads,
      locale: getLocale(),
      theme: getTheme()
    });

    // Save mapped workloads to session
    saveToSession(mappedWorkloads, {
      currentStep: 'dashboard',
      locale: getLocale()
    });
  });

  // Wire language toggle
  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', () => {
      const current = getLocale();
      const next = current === 'en' ? 'es' : 'en';
      setLocale(next);

      // Update charts theme if on dashboard (re-renders with new locale labels)
      if (getCurrentStep() === 'dashboard') {
        updateChartsTheme(getTheme());
      }
    });
  }

  // Wire theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      toggleTheme();

      // Update charts if on dashboard
      if (getCurrentStep() === 'dashboard') {
        updateChartsTheme(getTheme());
      }
    });
  }

  // Wire PDF export button
  const exportBtn = document.getElementById('btn-export-pdf');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportDashboardToPDF({
        title: 'Resilience Architect: AWS DR Strategy Mapper',
        locale: getLocale(),
        theme: getTheme()
      });
    });
  }

  // Wire session guard — save workloads on form input changes (debounced)
  const workloadList = document.getElementById('workload-list');
  if (workloadList) {
    const debouncedSave = debounce(() => {
      const workloads = collectWorkloadsFromForm();
      saveToSession(workloads, {
        currentStep: getCurrentStep(),
        locale: getLocale()
      });
    }, 500);

    workloadList.addEventListener('input', debouncedSave);
    workloadList.addEventListener('change', debouncedSave);
  }
}

// Initialize the app — since this is a type="module" script, it runs after DOM is parsed
initApp().catch((error) => {
  console.error('App: Critical initialization error:', error);
});
