import { describe, it, expect } from 'vitest';
import {
  escapeHTML,
  sanitizeString,
  sanitizeNumber,
  validateWorkload,
  validateAllWorkloads
} from '../js/sanitizer.js';

describe('escapeHTML', () => {
  it('encodes < > " \' & characters', () => {
    expect(escapeHTML('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('encodes single quotes', () => {
    expect(escapeHTML("it's")).toBe('it&#x27;s');
  });

  it('encodes ampersands', () => {
    expect(escapeHTML('a & b')).toBe('a &amp; b');
  });

  it('returns empty string for non-string input', () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(undefined)).toBe('');
    expect(escapeHTML(123)).toBe('');
  });

  it('passes through safe strings unchanged', () => {
    expect(escapeHTML('Hello World')).toBe('Hello World');
  });
});

describe('sanitizeString', () => {
  it('accepts valid strings within max length', () => {
    const result = sanitizeString('My Workload', 100);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('My Workload');
  });

  it('rejects null/undefined', () => {
    const result = sanitizeString(null, 100);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.required');
  });

  it('rejects non-string types', () => {
    const result = sanitizeString(123, 100);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.invalidType');
  });

  it('rejects empty strings', () => {
    const result = sanitizeString('   ', 100);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.required');
  });

  it('rejects strings exceeding max length', () => {
    const longStr = 'a'.repeat(101);
    const result = sanitizeString(longStr, 100);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.tooLong');
  });

  it('escapes HTML in the sanitized value', () => {
    const result = sanitizeString('<b>bold</b>', 100);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });
});

describe('sanitizeNumber', () => {
  it('accepts positive numbers', () => {
    const result = sanitizeNumber(42);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe(42);
  });

  it('accepts numeric strings', () => {
    const result = sanitizeNumber('3.14');
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toBe(3.14);
  });

  it('rejects zero when positive is required', () => {
    const result = sanitizeNumber(0, { positive: true });
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.mustBePositive');
  });

  it('rejects negative numbers', () => {
    const result = sanitizeNumber(-5);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.mustBePositive');
  });

  it('rejects NaN', () => {
    const result = sanitizeNumber(NaN);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.notANumber');
  });

  it('rejects Infinity', () => {
    const result = sanitizeNumber(Infinity);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.notFinite');
  });

  it('rejects non-numeric strings', () => {
    const result = sanitizeNumber('abc');
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.notANumber');
  });

  it('rejects null/undefined', () => {
    const result = sanitizeNumber(null);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.required');
  });

  it('rejects empty string', () => {
    const result = sanitizeNumber('');
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.field.required');
  });
});

describe('validateWorkload', () => {
  const validWorkload = {
    id: 'wl-1',
    name: 'Payment Service',
    criticality: 'tier1',
    rto: { value: 5, unit: 'minutes' },
    rpo: { value: 30, unit: 'seconds' }
  };

  it('accepts a valid workload', () => {
    const result = validateWorkload(validWorkload);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue.name).toBe('Payment Service');
    expect(result.sanitizedValue.criticality).toBe('tier1');
  });

  it('rejects null/undefined workload', () => {
    const result = validateWorkload(null);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].field).toBe('workload');
  });

  it('rejects workload with name > 100 characters', () => {
    const result = validateWorkload({ ...validWorkload, name: 'x'.repeat(101) });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'name')).toBe(true);
  });

  it('rejects workload with invalid criticality', () => {
    const result = validateWorkload({ ...validWorkload, criticality: 'tier4' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'criticality')).toBe(true);
  });

  it('rejects workload with non-positive RTO value', () => {
    const result = validateWorkload({ ...validWorkload, rto: { value: 0, unit: 'minutes' } });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'rto.value')).toBe(true);
  });

  it('rejects workload with invalid RPO unit', () => {
    const result = validateWorkload({ ...validWorkload, rpo: { value: 5, unit: 'weeks' } });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'rpo.unit')).toBe(true);
  });

  it('rejects workload with missing RTO', () => {
    const { rto, ...noRto } = validWorkload;
    const result = validateWorkload(noRto);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'rto')).toBe(true);
  });

  it('returns multiple errors for multiple invalid fields', () => {
    const result = validateWorkload({
      name: '',
      criticality: 'invalid',
      rto: { value: -1, unit: 'invalid' },
      rpo: { value: 0, unit: 'hours' }
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('validateAllWorkloads', () => {
  const validWorkload = {
    id: 'wl-1',
    name: 'Payment Service',
    criticality: 'tier1',
    rto: { value: 5, unit: 'minutes' },
    rpo: { value: 30, unit: 'seconds' }
  };

  it('accepts a valid array of workloads', () => {
    const result = validateAllWorkloads([validWorkload]);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedValue).toHaveLength(1);
  });

  it('rejects non-array input', () => {
    const result = validateAllWorkloads('not an array');
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.workloads.notArray');
  });

  it('rejects empty array', () => {
    const result = validateAllWorkloads([]);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].messageKey).toBe('error.workloads.empty');
  });

  it('reports errors with indexed field paths', () => {
    const result = validateAllWorkloads([{ name: '', criticality: 'tier1', rto: { value: 1, unit: 'hours' }, rpo: { value: 1, unit: 'hours' } }]);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].field).toMatch(/^workloads\[0\]\./);
  });
});
