/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need to set up the DOM before importing the wizard module
// because it imports sanitizer and mapping-engine which are pure modules.

describe('wizard controller', () => {
  let wizard;

  function setupDOM() {
    document.body.innerHTML = `
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
        <button type="button" id="btn-dashboard-back">Back</button>
      </section>
    `;
  }

  beforeEach(async () => {
    setupDOM();
    // Re-import the module fresh for each test
    vi.resetModules();
    wizard = await import('../js/wizard.js');
  });

  describe('initWizard', () => {
    it('shows context step initially', () => {
      wizard.initWizard();
      expect(wizard.getCurrentStep()).toBe('context');
      expect(document.getElementById('step-context').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('step-ingestion').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('step-dashboard').classList.contains('hidden')).toBe(true);
    });
  });

  describe('navigateToStep', () => {
    it('navigates from context to ingestion on proceed click', () => {
      wizard.initWizard();
      document.getElementById('btn-context-proceed').click();
      expect(wizard.getCurrentStep()).toBe('ingestion');
      expect(document.getElementById('step-ingestion').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('step-context').classList.contains('hidden')).toBe(true);
    });

    it('navigates back from ingestion to context', () => {
      wizard.initWizard();
      document.getElementById('btn-context-proceed').click();
      document.getElementById('btn-ingestion-back').click();
      expect(wizard.getCurrentStep()).toBe('context');
      expect(document.getElementById('step-context').classList.contains('hidden')).toBe(false);
    });

    it('updates step indicators when navigating forward', () => {
      wizard.initWizard();
      document.getElementById('btn-context-proceed').click();

      const contextIndicator = document.querySelector('[data-step="context"]');
      const ingestionIndicator = document.querySelector('[data-step="ingestion"]');

      expect(contextIndicator.classList.contains('complete')).toBe(true);
      expect(ingestionIndicator.classList.contains('active')).toBe(true);
    });

    it('does not navigate to invalid step names', () => {
      wizard.initWizard();
      wizard.navigateToStep('invalid');
      expect(wizard.getCurrentStep()).toBe('context');
    });
  });

  describe('workload management', () => {
    it('adds a new workload entry when add button is clicked', () => {
      wizard.initWizard();
      document.getElementById('btn-add-workload').click();
      const entries = document.querySelectorAll('.workload-entry');
      expect(entries.length).toBe(2);
    });

    it('new workload entry has cleared fields', () => {
      wizard.initWizard();
      // Fill in the first entry
      document.querySelector('.workload-name').value = 'Test';
      document.getElementById('btn-add-workload').click();
      const entries = document.querySelectorAll('.workload-entry');
      const newEntry = entries[1];
      expect(newEntry.querySelector('.workload-name').value).toBe('');
    });

    it('removes a workload entry when remove button is clicked', () => {
      wizard.initWizard();
      // Add a second entry first
      document.getElementById('btn-add-workload').click();
      expect(document.querySelectorAll('.workload-entry').length).toBe(2);

      // Remove the second entry
      const removeButtons = document.querySelectorAll('.btn-remove-workload');
      removeButtons[1].click();
      expect(document.querySelectorAll('.workload-entry').length).toBe(1);
    });

    it('does not remove the last workload entry', () => {
      wizard.initWizard();
      const removeBtn = document.querySelector('.btn-remove-workload');
      removeBtn.click();
      expect(document.querySelectorAll('.workload-entry').length).toBe(1);
    });
  });

  describe('validation on proceed to dashboard', () => {
    it('shows ingestion error when no workloads have data and fields are empty', () => {
      wizard.initWizard();
      // Navigate to ingestion first
      document.getElementById('btn-context-proceed').click();
      // Try to proceed with empty fields
      document.getElementById('btn-ingestion-proceed').click();
      // Should show validation errors (fields are empty)
      expect(wizard.getCurrentStep()).toBe('ingestion');
    });

    it('proceeds to dashboard with valid workload data', () => {
      wizard.initWizard();
      document.getElementById('btn-context-proceed').click();

      // Fill in valid workload data
      document.querySelector('.workload-name').value = 'Payment Gateway';
      document.querySelector('.workload-criticality').value = 'tier1';
      document.querySelector('.workload-rto-value').value = '4';
      document.querySelector('.workload-rto-unit').value = 'hours';
      document.querySelector('.workload-rpo-value').value = '1';
      document.querySelector('.workload-rpo-unit').value = 'hours';

      document.getElementById('btn-ingestion-proceed').click();
      expect(wizard.getCurrentStep()).toBe('dashboard');
      expect(document.getElementById('step-dashboard').classList.contains('hidden')).toBe(false);
    });

    it('calls onDashboard callback with mapped workloads', () => {
      wizard.initWizard();
      const callback = vi.fn();
      wizard.onDashboard(callback);

      document.getElementById('btn-context-proceed').click();

      // Fill in valid workload data
      document.querySelector('.workload-name').value = 'Payment Gateway';
      document.querySelector('.workload-criticality').value = 'tier1';
      document.querySelector('.workload-rto-value').value = '4';
      document.querySelector('.workload-rto-unit').value = 'hours';
      document.querySelector('.workload-rpo-value').value = '1';
      document.querySelector('.workload-rpo-unit').value = 'hours';

      document.getElementById('btn-ingestion-proceed').click();

      expect(callback).toHaveBeenCalledTimes(1);
      const mappedWorkloads = callback.mock.calls[0][0];
      expect(mappedWorkloads).toHaveLength(1);
      expect(mappedWorkloads[0].strategy).toBeDefined();
      expect(mappedWorkloads[0].strategyLabel).toBeDefined();
    });

    it('shows inline errors for invalid fields', () => {
      wizard.initWizard();
      document.getElementById('btn-context-proceed').click();

      // Fill in partial data (name only, missing criticality and values)
      document.querySelector('.workload-name').value = 'Test';
      document.querySelector('.workload-criticality').value = '';

      document.getElementById('btn-ingestion-proceed').click();

      expect(wizard.getCurrentStep()).toBe('ingestion');
      // Check that error messages are shown
      const errorMessages = document.querySelectorAll('.error-message');
      const hasError = Array.from(errorMessages).some(el => el.textContent !== '');
      expect(hasError).toBe(true);
    });
  });

  describe('getCurrentStep', () => {
    it('returns context initially', () => {
      wizard.initWizard();
      expect(wizard.getCurrentStep()).toBe('context');
    });

    it('returns ingestion after navigating forward', () => {
      wizard.initWizard();
      document.getElementById('btn-context-proceed').click();
      expect(wizard.getCurrentStep()).toBe('ingestion');
    });
  });

  describe('navigating back from dashboard', () => {
    it('navigates back from dashboard to ingestion', () => {
      wizard.initWizard();
      document.getElementById('btn-context-proceed').click();

      // Fill valid data and proceed
      document.querySelector('.workload-name').value = 'Service A';
      document.querySelector('.workload-criticality').value = 'tier2';
      document.querySelector('.workload-rto-value').value = '2';
      document.querySelector('.workload-rto-unit').value = 'hours';
      document.querySelector('.workload-rpo-value').value = '2';
      document.querySelector('.workload-rpo-unit').value = 'hours';

      document.getElementById('btn-ingestion-proceed').click();
      expect(wizard.getCurrentStep()).toBe('dashboard');

      document.getElementById('btn-dashboard-back').click();
      expect(wizard.getCurrentStep()).toBe('ingestion');
      expect(document.getElementById('step-ingestion').classList.contains('hidden')).toBe(false);
    });
  });
});
