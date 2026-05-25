/**
 * Wizard Controller Module
 * Manages step navigation, workload form handling, and validation.
 *
 * Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { validateAllWorkloads } from './sanitizer.js';
import { mapAllWorkloads } from './mapping-engine.js';

const STEPS = ['context', 'ingestion', 'dashboard'];

let currentStep = 'context';
let workloadCounter = 1;
let onDashboardReady = null;

/**
 * Returns the current wizard step name.
 * @returns {'context' | 'ingestion' | 'dashboard'}
 */
export function getCurrentStep() {
  return currentStep;
}

/**
 * Registers a callback that fires when the user proceeds to the dashboard.
 * The callback receives the array of MappedWorkload objects.
 * @param {function} callback - Function receiving mapped workloads array
 */
export function onDashboard(callback) {
  onDashboardReady = callback;
}

/**
 * Initializes the wizard: shows the context step, hides others,
 * and wires up all navigation and form buttons.
 */
export function initWizard() {
  currentStep = 'context';
  workloadCounter = 1;

  // Show initial step
  showStep('context');

  // Navigation buttons
  const btnContextProceed = document.getElementById('btn-context-proceed');
  const btnIngestionProceed = document.getElementById('btn-ingestion-proceed');
  const btnIngestionBack = document.getElementById('btn-ingestion-back');
  const btnDashboardBack = document.getElementById('btn-dashboard-back');

  if (btnContextProceed) {
    btnContextProceed.addEventListener('click', () => navigateToStep('ingestion'));
  }
  if (btnIngestionProceed) {
    btnIngestionProceed.addEventListener('click', () => handleIngestionProceed());
  }
  if (btnIngestionBack) {
    btnIngestionBack.addEventListener('click', () => navigateToStep('context'));
  }
  if (btnDashboardBack) {
    btnDashboardBack.addEventListener('click', () => navigateToStep('ingestion'));
  }

  // Add workload button
  const btnAddWorkload = document.getElementById('btn-add-workload');
  if (btnAddWorkload) {
    btnAddWorkload.addEventListener('click', addWorkloadEntry);
  }

  // Remove workload buttons (delegate from workload-list)
  const workloadList = document.getElementById('workload-list');
  if (workloadList) {
    workloadList.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.btn-remove-workload');
      if (removeBtn) {
        removeWorkloadEntry(removeBtn);
      }
    });
  }

  // Clear inline errors on input
  if (workloadList) {
    workloadList.addEventListener('input', (e) => {
      const formGroup = e.target.closest('.form-group');
      if (formGroup) {
        clearFieldError(formGroup);
      }
    });
    workloadList.addEventListener('change', (e) => {
      const formGroup = e.target.closest('.form-group');
      if (formGroup) {
        clearFieldError(formGroup);
      }
    });
  }
}

/**
 * Navigates to the specified step. Validates before advancing forward.
 * @param {'context' | 'ingestion' | 'dashboard'} step
 */
export function navigateToStep(step) {
  if (!STEPS.includes(step)) return;

  const currentIndex = STEPS.indexOf(currentStep);
  const targetIndex = STEPS.indexOf(step);

  // Going backward is always allowed
  if (targetIndex < currentIndex) {
    currentStep = step;
    showStep(step);
    updateStepIndicators(step);
    return;
  }

  // Going forward from context to ingestion — no validation needed
  if (currentStep === 'context' && step === 'ingestion') {
    currentStep = step;
    showStep(step);
    updateStepIndicators(step);
    return;
  }

  // Going forward from ingestion to dashboard — validate
  if (currentStep === 'ingestion' && step === 'dashboard') {
    handleIngestionProceed();
    return;
  }

  // Direct navigation (e.g., from context to dashboard) — not allowed
}

/**
 * Shows the specified step section and hides all others.
 * @param {string} step
 */
function showStep(step) {
  for (const s of STEPS) {
    const section = document.getElementById(`step-${s}`);
    if (section) {
      if (s === step) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    }
  }
}

/**
 * Updates the step indicator classes (active, complete).
 * @param {string} activeStep
 */
function updateStepIndicators(activeStep) {
  const indicators = document.querySelectorAll('.step-indicator');
  const activeIndex = STEPS.indexOf(activeStep);

  indicators.forEach((indicator) => {
    const indicatorStep = indicator.getAttribute('data-step');
    const indicatorIndex = STEPS.indexOf(indicatorStep);

    indicator.classList.remove('active', 'complete');

    if (indicatorIndex === activeIndex) {
      indicator.classList.add('active');
    } else if (indicatorIndex < activeIndex) {
      indicator.classList.add('complete');
    }
  });
}

/**
 * Handles the proceed action from the ingestion step.
 * Collects workloads, validates, maps strategies, and navigates to dashboard.
 */
function handleIngestionProceed() {
  clearAllErrors();

  const workloads = collectWorkloads();

  // Check at least one workload exists
  if (workloads.length === 0) {
    showIngestionError();
    return;
  }

  hideIngestionError();

  // Validate all workloads
  const validationResult = validateAllWorkloads(workloads);

  if (!validationResult.isValid) {
    displayValidationErrors(validationResult.errors);
    return;
  }

  // Map strategies
  const mappedWorkloads = mapAllWorkloads(validationResult.sanitizedValue);

  // Navigate to dashboard
  currentStep = 'dashboard';
  showStep('dashboard');
  updateStepIndicators('dashboard');

  // Notify callback
  if (typeof onDashboardReady === 'function') {
    onDashboardReady(mappedWorkloads);
  }
}

/**
 * Collects workload data from all form entries.
 * @returns {Array<object>} Array of raw workload objects
 */
function collectWorkloads() {
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

    const name = nameInput ? nameInput.value : '';
    const criticality = criticalitySelect ? criticalitySelect.value : '';
    const rtoValue = rtoValueInput ? rtoValueInput.value : '';
    const rtoUnit = rtoUnitSelect ? rtoUnitSelect.value : 'hours';
    const rpoValue = rpoValueInput ? rpoValueInput.value : '';
    const rpoUnit = rpoUnitSelect ? rpoUnitSelect.value : 'hours';

    workloads.push({
      id: `wl-${id}`,
      name,
      criticality,
      rto: { value: rtoValue === '' ? '' : Number(rtoValue), unit: rtoUnit },
      rpo: { value: rpoValue === '' ? '' : Number(rpoValue), unit: rpoUnit }
    });
  });

  return workloads;
}

/**
 * Displays validation errors inline on the corresponding form fields.
 * @param {Array<{field: string, messageKey: string}>} errors
 */
function displayValidationErrors(errors) {
  for (const error of errors) {
    // Parse field path like "workloads[0].name" or "workloads[1].rto.value"
    const match = error.field.match(/^workloads\[(\d+)\]\.(.+)$/);
    if (!match) continue;

    const index = parseInt(match[1], 10);
    const fieldPath = match[2];

    const entries = document.querySelectorAll('.workload-entry');
    if (index >= entries.length) continue;

    const entry = entries[index];
    const formGroup = findFormGroupForField(entry, fieldPath);

    if (formGroup) {
      showFieldError(formGroup, getErrorMessage(error.messageKey));
    }
  }
}

/**
 * Finds the form-group element corresponding to a field path within a workload entry.
 * @param {Element} entry - The workload fieldset element
 * @param {string} fieldPath - e.g., 'name', 'criticality', 'rto.value', 'rpo.value'
 * @returns {Element|null}
 */
function findFormGroupForField(entry, fieldPath) {
  let selector;

  switch (fieldPath) {
    case 'name':
      selector = '.workload-name';
      break;
    case 'criticality':
      selector = '.workload-criticality';
      break;
    case 'rto':
    case 'rto.value':
    case 'rto.unit':
      selector = '.workload-rto-value';
      break;
    case 'rpo':
    case 'rpo.value':
    case 'rpo.unit':
      selector = '.workload-rpo-value';
      break;
    default:
      return null;
  }

  const field = entry.querySelector(selector);
  return field ? field.closest('.form-group') : null;
}

/**
 * Shows an inline error message on a form group.
 * @param {Element} formGroup
 * @param {string} message
 */
function showFieldError(formGroup, message) {
  formGroup.classList.add('has-error');
  const errorSpan = formGroup.querySelector('.error-message');
  if (errorSpan) {
    errorSpan.textContent = message;
  }
  // Mark the input as invalid for styling
  const input = formGroup.querySelector('input, select');
  if (input) {
    input.setAttribute('aria-invalid', 'true');
  }
}

/**
 * Clears the inline error on a form group.
 * @param {Element} formGroup
 */
function clearFieldError(formGroup) {
  formGroup.classList.remove('has-error');
  const errorSpan = formGroup.querySelector('.error-message');
  if (errorSpan) {
    errorSpan.textContent = '';
  }
  const input = formGroup.querySelector('input, select');
  if (input) {
    input.removeAttribute('aria-invalid');
  }
}

/**
 * Clears all inline errors across all workload entries.
 */
function clearAllErrors() {
  const formGroups = document.querySelectorAll('.workload-entry .form-group');
  formGroups.forEach((fg) => clearFieldError(fg));
  hideIngestionError();
}

/**
 * Shows the "at least one workload" error banner.
 */
function showIngestionError() {
  const errorEl = document.getElementById('ingestion-error');
  if (errorEl) {
    errorEl.classList.remove('hidden');
  }
}

/**
 * Hides the "at least one workload" error banner.
 */
function hideIngestionError() {
  const errorEl = document.getElementById('ingestion-error');
  if (errorEl) {
    errorEl.classList.add('hidden');
  }
}

/**
 * Adds a new workload entry to the form by cloning the first entry.
 */
function addWorkloadEntry() {
  const workloadList = document.getElementById('workload-list');
  if (!workloadList) return;

  workloadCounter++;
  const id = workloadCounter;

  const firstEntry = workloadList.querySelector('.workload-entry');
  if (!firstEntry) return;

  const newEntry = firstEntry.cloneNode(true);

  // Update IDs and attributes
  newEntry.setAttribute('data-workload-id', id);

  // Update legend number
  const numberSpan = newEntry.querySelector('.workload-number');
  if (numberSpan) {
    numberSpan.textContent = id;
  }

  // Clear and update form fields
  const nameInput = newEntry.querySelector('.workload-name');
  if (nameInput) {
    nameInput.id = `workload-name-${id}`;
    nameInput.value = '';
  }

  const criticalitySelect = newEntry.querySelector('.workload-criticality');
  if (criticalitySelect) {
    criticalitySelect.id = `workload-criticality-${id}`;
    criticalitySelect.selectedIndex = 0;
  }

  const rtoValueInput = newEntry.querySelector('.workload-rto-value');
  if (rtoValueInput) {
    rtoValueInput.id = `workload-rto-value-${id}`;
    rtoValueInput.value = '';
  }

  const rtoUnitSelect = newEntry.querySelector('.workload-rto-unit');
  if (rtoUnitSelect) {
    rtoUnitSelect.id = `workload-rto-unit-${id}`;
    rtoUnitSelect.value = 'hours';
  }

  const rpoValueInput = newEntry.querySelector('.workload-rpo-value');
  if (rpoValueInput) {
    rpoValueInput.id = `workload-rpo-value-${id}`;
    rpoValueInput.value = '';
  }

  const rpoUnitSelect = newEntry.querySelector('.workload-rpo-unit');
  if (rpoUnitSelect) {
    rpoUnitSelect.id = `workload-rpo-unit-${id}`;
    rpoUnitSelect.value = 'hours';
  }

  // Update labels' for attributes
  const labels = newEntry.querySelectorAll('label');
  labels.forEach((label) => {
    const forAttr = label.getAttribute('for');
    if (forAttr) {
      label.setAttribute('for', forAttr.replace(/-\d+$/, `-${id}`));
    }
  });

  // Update remove button aria-label
  const removeBtn = newEntry.querySelector('.btn-remove-workload');
  if (removeBtn) {
    removeBtn.setAttribute('aria-label', `Remove workload ${id}`);
  }

  // Clear any error states
  const formGroups = newEntry.querySelectorAll('.form-group');
  formGroups.forEach((fg) => clearFieldError(fg));

  workloadList.appendChild(newEntry);

  // Focus the new name input for accessibility
  const newNameInput = newEntry.querySelector('.workload-name');
  if (newNameInput) {
    newNameInput.focus();
  }
}

/**
 * Removes a workload entry from the form.
 * Prevents removing the last entry.
 * @param {Element} removeBtn - The remove button that was clicked
 */
function removeWorkloadEntry(removeBtn) {
  const workloadList = document.getElementById('workload-list');
  if (!workloadList) return;

  const entries = workloadList.querySelectorAll('.workload-entry');

  // Don't remove if it's the only entry
  if (entries.length <= 1) return;

  const entry = removeBtn.closest('.workload-entry');
  if (entry) {
    entry.remove();
    renumberWorkloads();
  }
}

/**
 * Renumbers all workload entries after a removal.
 */
function renumberWorkloads() {
  const entries = document.querySelectorAll('.workload-entry');
  entries.forEach((entry, index) => {
    const num = index + 1;
    const numberSpan = entry.querySelector('.workload-number');
    if (numberSpan) {
      numberSpan.textContent = num;
    }
  });
}

/**
 * Returns a user-friendly error message for a given message key.
 * Falls back to a generic message if key is unknown.
 * @param {string} messageKey
 * @returns {string}
 */
function getErrorMessage(messageKey) {
  const messages = {
    'error.field.required': 'This field is required.',
    'error.field.invalidType': 'Invalid input type.',
    'error.field.tooLong': 'Input exceeds maximum length (100 characters).',
    'error.field.notANumber': 'Please enter a valid number.',
    'error.field.notFinite': 'Please enter a finite number.',
    'error.field.mustBePositive': 'Value must be greater than zero.',
    'error.criticality.invalid': 'Please select a valid criticality tier.',
    'error.timeUnit.invalid': 'Please select a valid time unit.',
    'error.workload.invalid': 'Invalid workload data.',
    'error.workloads.notArray': 'Invalid workload list.',
    'error.workloads.empty': 'Please add at least one workload.'
  };

  return messages[messageKey] || 'Invalid input.';
}
