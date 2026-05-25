/**
 * Input Sanitizer Module
 * Validates and sanitizes all user inputs before processing.
 * Pure module — no DOM access.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

const VALID_TIME_UNITS = ['seconds', 'minutes', 'hours', 'days'];
const VALID_CRITICALITY_TIERS = ['tier1', 'tier2', 'tier3'];
const MAX_WORKLOAD_NAME_LENGTH = 100;

/**
 * Encodes HTML special characters to prevent XSS.
 * Encodes: < > " ' &
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validates and sanitizes a string input.
 * @param {*} input - The input to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {{ isValid: boolean, errors: Array<{field: string, messageKey: string}>, sanitizedValue?: string }}
 */
export function sanitizeString(input, maxLength) {
  const errors = [];

  if (input === null || input === undefined) {
    errors.push({ field: 'string', messageKey: 'error.field.required' });
    return { isValid: false, errors };
  }

  if (typeof input !== 'string') {
    errors.push({ field: 'string', messageKey: 'error.field.invalidType' });
    return { isValid: false, errors };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    errors.push({ field: 'string', messageKey: 'error.field.required' });
    return { isValid: false, errors };
  }

  if (trimmed.length > maxLength) {
    errors.push({ field: 'string', messageKey: 'error.field.tooLong' });
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], sanitizedValue: escapeHTML(trimmed) };
}

/**
 * Validates a numeric input. Rejects zero, negative, NaN, and Infinity.
 * @param {*} input - The input to validate
 * @param {{ positive?: boolean }} options - Validation options
 * @returns {{ isValid: boolean, errors: Array<{field: string, messageKey: string}>, sanitizedValue?: number }}
 */
export function sanitizeNumber(input, options = {}) {
  const { positive = true } = options;
  const errors = [];

  if (input === null || input === undefined) {
    errors.push({ field: 'number', messageKey: 'error.field.required' });
    return { isValid: false, errors };
  }

  const num = typeof input === 'number' ? input : Number(input);

  if (typeof input === 'string' && input.trim() === '') {
    errors.push({ field: 'number', messageKey: 'error.field.required' });
    return { isValid: false, errors };
  }

  if (Number.isNaN(num)) {
    errors.push({ field: 'number', messageKey: 'error.field.notANumber' });
    return { isValid: false, errors };
  }

  if (!Number.isFinite(num)) {
    errors.push({ field: 'number', messageKey: 'error.field.notFinite' });
    return { isValid: false, errors };
  }

  if (positive && num <= 0) {
    errors.push({ field: 'number', messageKey: 'error.field.mustBePositive' });
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], sanitizedValue: num };
}

/**
 * Validates all fields of a workload object.
 * @param {*} workload - The workload object to validate
 * @returns {{ isValid: boolean, errors: Array<{field: string, messageKey: string}>, sanitizedValue?: object }}
 */
export function validateWorkload(workload) {
  const errors = [];

  if (!workload || typeof workload !== 'object') {
    errors.push({ field: 'workload', messageKey: 'error.workload.invalid' });
    return { isValid: false, errors };
  }

  // Validate name
  const nameResult = sanitizeString(workload.name, MAX_WORKLOAD_NAME_LENGTH);
  if (!nameResult.isValid) {
    for (const err of nameResult.errors) {
      errors.push({ field: 'name', messageKey: err.messageKey });
    }
  }

  // Validate criticality
  if (!workload.criticality) {
    errors.push({ field: 'criticality', messageKey: 'error.field.required' });
  } else if (!VALID_CRITICALITY_TIERS.includes(workload.criticality)) {
    errors.push({ field: 'criticality', messageKey: 'error.criticality.invalid' });
  }

  // Validate RTO
  const rtoErrors = validateTimeValue(workload.rto, 'rto');
  errors.push(...rtoErrors);

  // Validate RPO
  const rpoErrors = validateTimeValue(workload.rpo, 'rpo');
  errors.push(...rpoErrors);

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitizedValue: {
      id: workload.id || generateId(),
      name: nameResult.sanitizedValue,
      criticality: workload.criticality,
      rto: { value: workload.rto.value, unit: workload.rto.unit },
      rpo: { value: workload.rpo.value, unit: workload.rpo.unit }
    }
  };
}

/**
 * Validates an array of workloads.
 * @param {*} workloads - The array of workloads to validate
 * @returns {{ isValid: boolean, errors: Array<{field: string, messageKey: string}>, sanitizedValue?: Array }}
 */
export function validateAllWorkloads(workloads) {
  const errors = [];

  if (!Array.isArray(workloads)) {
    errors.push({ field: 'workloads', messageKey: 'error.workloads.notArray' });
    return { isValid: false, errors };
  }

  if (workloads.length === 0) {
    errors.push({ field: 'workloads', messageKey: 'error.workloads.empty' });
    return { isValid: false, errors };
  }

  const sanitizedWorkloads = [];

  for (let i = 0; i < workloads.length; i++) {
    const result = validateWorkload(workloads[i]);
    if (!result.isValid) {
      for (const err of result.errors) {
        errors.push({
          field: `workloads[${i}].${err.field}`,
          messageKey: err.messageKey
        });
      }
    } else {
      sanitizedWorkloads.push(result.sanitizedValue);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], sanitizedValue: sanitizedWorkloads };
}

/**
 * Validates a time value object (used for RTO/RPO).
 * @param {*} timeValue - The time value to validate
 * @param {string} fieldPrefix - The field name prefix ('rto' or 'rpo')
 * @returns {Array<{field: string, messageKey: string}>}
 */
function validateTimeValue(timeValue, fieldPrefix) {
  const errors = [];

  if (!timeValue || typeof timeValue !== 'object') {
    errors.push({ field: fieldPrefix, messageKey: 'error.field.required' });
    return errors;
  }

  // Validate numeric value
  const numResult = sanitizeNumber(timeValue.value, { positive: true });
  if (!numResult.isValid) {
    for (const err of numResult.errors) {
      errors.push({ field: `${fieldPrefix}.value`, messageKey: err.messageKey });
    }
  }

  // Validate time unit
  if (!timeValue.unit) {
    errors.push({ field: `${fieldPrefix}.unit`, messageKey: 'error.field.required' });
  } else if (!VALID_TIME_UNITS.includes(timeValue.unit)) {
    errors.push({ field: `${fieldPrefix}.unit`, messageKey: 'error.timeUnit.invalid' });
  }

  return errors;
}

/**
 * Generates a simple unique ID.
 * @returns {string}
 */
function generateId() {
  return `wl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
