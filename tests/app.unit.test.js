/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

/**
 * Unit tests for app.js entry point.
 * Tests the integration wiring: event listeners, session restore, and module initialization.
 */

describe('app entry point', () => {
  let fetchMock;

  function setupDOM() {
    document.body.innerHTML = `
      <html data-theme="dark">
      <nav class="wizard-nav">
        <ol class="wizard-steps-indicator">
          <li class="step-indicator active" data-step="context">
            <span class="step-number">1</span>
            <span class="step-label">Executive Context</span>
          </li>
          <li class="step-indicator" data-step="ingestion">
            <span class="step-number">2</span>
            <span class="step-label">Workload Ingestion</span>
          </li>
          <li class="step-indicator" data-step="dashboard">
            <span class="step-number">3</span>
            <span class="step-label">Dashboard</span>
          </li>
        </ol>
      </nav>

      <section id="step-context" class="wizard-step">
        <button type="button" id="btn-context-proceed">Get Started</button>
      </section>

      <section id="step-ingestion" class="wizard-step hidden">
        <div id="workload-list" class="workload-list">
          <fieldset class="workload-entry" data-workload-id="1">
            <legend><span class="workload-number">1</span></legend>
            <div class="form-group">
              <label for="workload-name-1">Name</label>
              <input type="text" id="workload-name-1" class="form-control workload-name" maxlength="100">
              <span class="error-message"></span>
            </div>
            <div class="form-group">
              <label for="workload-criticality-1">Criticality</label>
              <select id="workload-criticality-1" class="form-control workload-criticality">
                <option value="" disabled selected>Select tier...</option>
                <option value="tier1">Tier 1</option>
                <option value="tier2">Tier 2</option>
                <option value="tier3">Tier 3</option>
              </select>
              <span class="error-message"></span>
            </div>
            <div class="form-group form-group-inline">
              <label for="workload-rto-value-1">RTO</label>
              <input type="number" id="workload-rto-value-1" class="form-control workload-rto-value" min="0.01" step="any">
              <select id="workload-rto-unit-1" class="form-control workload-rto-unit">
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours" selected>Hours</option>
                <option value="days">Days</option>
              </select>
              <span class="error-message"></span>
            </div>
            <div class="form-group form-group-inline">
              <label for="workload-rpo-value-1">RPO</label>
              <input type="number" id="workload-rpo-value-1" class="form-control workload-rpo-value" min="0.01" step="any">
              <select id="workload-rpo-unit-1" class="form-control workload-rpo-unit">
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours" selected>Hours</option>
                <option value="days">Days</option>
              </select>
              <span class="error-message"></span>
            </div>
            <button type="button" class="btn btn-danger btn-remove-workload" aria-label="Remove workload 1">Remove</button>
          </fieldset>
        </div>
        <button type="button" id="btn-add-workload">+ Add Workload</button>
        <div id="ingestion-error" class="form-error hidden">
          <span>Please add at least one workload before proceeding.</span>
        </div>
        <button type="button" id="btn-ingestion-back">Back</button>
        <button type="button" id="btn-ingestion-proceed">Analyze Workloads</button>
      </section>

      <section id="step-dashboard" class="wizard-step hidden">
        <div class="step-content">
          <div id="pie-chart-container"><canvas id="pie-chart"></canvas></div>
          <div id="pie-chart-fallback" class="hidden"></div>
          <div id="quadrant-chart-container"><canvas id="quadrant-chart"></canvas></div>
          <div id="quadrant-chart-fallback" class="hidden"></div>
          <div id="tradeoff-cards"></div>
        </div>
        <button type="button" id="btn-dashboard-back">Back</button>
        <button type="button" id="btn-export-pdf">Export PDF</button>
      </section>

      <header>
        <button type="button" id="lang-toggle"><span data-i18n="controls.lang">EN</span></button>
        <button type="button" id="theme-toggle"><span data-i18n="controls.theme">🌙</span></button>
      </header>
      </html>
    `;
  }

  function mockFetch() {
    const enTranslations = { 'app.title': 'Resilience Architect', 'controls.lang': 'EN' };
    const esTranslations = { 'app.title': 'Arquitecto de Resiliencia', 'controls.lang': 'ES' };

    fetchMock = vi.fn((url) => {
      if (url.includes('en.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(enTranslations) });
      }
      if (url.includes('es.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(esTranslations) });
      }
      return Promise.resolve({ ok: false });
    });

    globalThis.fetch = fetchMock;
  }

  beforeEach(() => {
    setupDOM();
    mockFetch();
    // Mock sessionStorage
    const store = {};
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
    });
    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn(() => Promise.resolve({ scope: '/' })) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('initializes without errors when imported', async () => {
    // Importing app.js triggers initApp()
    await expect(import('../js/app.js')).resolves.not.toThrow();
  });

  it('sets up language toggle event listener', async () => {
    await import('../js/app.js');
    // Wait for async init
    await new Promise((r) => setTimeout(r, 50));

    const langToggle = document.getElementById('lang-toggle');
    expect(langToggle).not.toBeNull();

    // Click should not throw
    langToggle.click();
  });

  it('sets up theme toggle event listener', async () => {
    await import('../js/app.js');
    await new Promise((r) => setTimeout(r, 50));

    const themeToggle = document.getElementById('theme-toggle');
    expect(themeToggle).not.toBeNull();

    // Click should not throw
    themeToggle.click();

    // Theme should have toggled (dark → light)
    const theme = document.documentElement.getAttribute('data-theme');
    expect(theme).toBe('light');
  });

  it('sets up export PDF button event listener', async () => {
    await import('../js/app.js');
    await new Promise((r) => setTimeout(r, 50));

    const exportBtn = document.getElementById('btn-export-pdf');
    expect(exportBtn).not.toBeNull();

    // Click should not throw (html2pdf not available, so it just returns)
    exportBtn.click();
  });

  it('saves workload data to session on form input changes', async () => {
    await import('../js/app.js');
    await new Promise((r) => setTimeout(r, 50));

    const nameInput = document.querySelector('.workload-name');
    nameInput.value = 'Test Workload';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait for debounce (500ms)
    await new Promise((r) => setTimeout(r, 600));

    expect(sessionStorage.setItem).toHaveBeenCalled();
  });

  it('makes zero external API calls for data processing', async () => {
    await import('../js/app.js');
    await new Promise((r) => setTimeout(r, 50));

    // Only fetch calls should be for i18n translation files (local assets)
    const fetchCalls = fetchMock.mock.calls;
    for (const call of fetchCalls) {
      const url = call[0];
      // All fetch calls should be for local i18n files only
      expect(url).toMatch(/i18n\/(en|es)\.json/);
    }
  });
});
