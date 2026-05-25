import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  escapeHTML,
  validateWorkload
} from '../js/sanitizer.js';

// Feature: rto-rpo-calculator, Property 5: Input sanitizer rejects all invalid workloads with descriptive errors
// **Validates: Requirements 4.1, 4.3, 4.4, 4.5**
describe('Property 5: Input sanitizer rejects invalid workloads', () => {
  const VALID_CRITICALITY_TIERS = ['tier1', 'tier2', 'tier3'];
  const VALID_TIME_UNITS = ['seconds', 'minutes', 'hours', 'days'];

  it('rejects workloads with name exceeding 100 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101, maxLength: 300 }),
        fc.constantFrom(...VALID_CRITICALITY_TIERS),
        fc.double({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.constantFrom(...VALID_TIME_UNITS),
        fc.double({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.constantFrom(...VALID_TIME_UNITS),
        (longName, criticality, rtoValue, rtoUnit, rpoValue, rpoUnit) => {
          const workload = {
            name: longName,
            criticality,
            rto: { value: rtoValue, unit: rtoUnit },
            rpo: { value: rpoValue, unit: rpoUnit }
          };
          const result = validateWorkload(workload);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          for (const error of result.errors) {
            expect(error.field).toBeTruthy();
            expect(error.messageKey).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects workloads with non-positive RTO values (zero, negative)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom(...VALID_CRITICALITY_TIERS),
        fc.oneof(
          fc.constant(0),
          fc.double({ min: -10000, max: -0.001, noNaN: true, noDefaultInfinity: true })
        ),
        fc.constantFrom(...VALID_TIME_UNITS),
        fc.double({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.constantFrom(...VALID_TIME_UNITS),
        (name, criticality, badRtoValue, rtoUnit, rpoValue, rpoUnit) => {
          const workload = {
            name,
            criticality,
            rto: { value: badRtoValue, unit: rtoUnit },
            rpo: { value: rpoValue, unit: rpoUnit }
          };
          const result = validateWorkload(workload);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          for (const error of result.errors) {
            expect(error.field).toBeTruthy();
            expect(error.messageKey).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects workloads with non-positive RPO values (zero, negative)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom(...VALID_CRITICALITY_TIERS),
        fc.double({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.constantFrom(...VALID_TIME_UNITS),
        fc.oneof(
          fc.constant(0),
          fc.double({ min: -10000, max: -0.001, noNaN: true, noDefaultInfinity: true })
        ),
        fc.constantFrom(...VALID_TIME_UNITS),
        (name, criticality, rtoValue, rtoUnit, badRpoValue, rpoUnit) => {
          const workload = {
            name,
            criticality,
            rto: { value: rtoValue, unit: rtoUnit },
            rpo: { value: badRpoValue, unit: rpoUnit }
          };
          const result = validateWorkload(workload);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          for (const error of result.errors) {
            expect(error.field).toBeTruthy();
            expect(error.messageKey).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects workloads with NaN or Infinity RTO/RPO values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom(...VALID_CRITICALITY_TIERS),
        fc.constantFrom(NaN, Infinity, -Infinity),
        fc.constantFrom(...VALID_TIME_UNITS),
        fc.constantFrom(...VALID_TIME_UNITS),
        (name, criticality, badValue, rtoUnit, rpoUnit) => {
          const workload = {
            name,
            criticality,
            rto: { value: badValue, unit: rtoUnit },
            rpo: { value: 10, unit: rpoUnit }
          };
          const result = validateWorkload(workload);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          for (const error of result.errors) {
            expect(error.field).toBeTruthy();
            expect(error.messageKey).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects workloads with non-numeric RTO/RPO values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom(...VALID_CRITICALITY_TIERS),
        fc.oneof(
          fc.string({ minLength: 1 }).filter(s => isNaN(Number(s))),
          fc.constant(undefined),
          fc.constant(null)
        ),
        fc.constantFrom(...VALID_TIME_UNITS),
        fc.constantFrom(...VALID_TIME_UNITS),
        (name, criticality, badValue, rtoUnit, rpoUnit) => {
          const workload = {
            name,
            criticality,
            rto: { value: badValue, unit: rtoUnit },
            rpo: { value: 10, unit: rpoUnit }
          };
          const result = validateWorkload(workload);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          for (const error of result.errors) {
            expect(error.field).toBeTruthy();
            expect(error.messageKey).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects workloads with missing required fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('name', 'criticality', 'rto', 'rpo'),
        (missingField) => {
          const validWorkload = {
            name: 'Test Workload',
            criticality: 'tier1',
            rto: { value: 10, unit: 'minutes' },
            rpo: { value: 5, unit: 'minutes' }
          };
          delete validWorkload[missingField];
          const result = validateWorkload(validWorkload);
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          for (const error of result.errors) {
            expect(error.field).toBeTruthy();
            expect(error.messageKey).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: rto-rpo-calculator, Property 6: HTML escaping prevents script injection
// **Validates: Requirements 4.2**
describe('Property 6: HTML escaping prevents script injection', () => {
  it('escapeHTML output never contains unescaped <, >, ", \', or & characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (input) => {
          const escaped = escapeHTML(input);
          // After escaping, the output should not contain raw dangerous characters
          // except as part of valid HTML entities (e.g., &amp; &lt; &gt; &quot; &#x27;)
          // Remove all valid HTML entities, then check no raw dangerous chars remain
          const withoutEntities = escaped
            .replace(/&amp;/g, '')
            .replace(/&lt;/g, '')
            .replace(/&gt;/g, '')
            .replace(/&quot;/g, '')
            .replace(/&#x27;/g, '');
          expect(withoutEntities).not.toMatch(/[<>"'&]/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('escapeHTML neutralizes script tags in random strings', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ maxLength: 50 }),
          fc.constantFrom(
            '<script>alert("xss")</script>',
            '<img onerror="alert(1)" src=x>',
            '<div onclick="steal()">',
            '<svg onload="evil()">',
            '<iframe src="javascript:alert(1)">',
            '<a href="javascript:void(0)">click</a>'
          ),
          fc.string({ maxLength: 50 })
        ),
        ([prefix, injection, suffix]) => {
          const input = prefix + injection + suffix;
          const escaped = escapeHTML(input);
          // The escaped output must not contain any unescaped < or > that could form tags
          const withoutEntities = escaped
            .replace(/&amp;/g, '')
            .replace(/&lt;/g, '')
            .replace(/&gt;/g, '')
            .replace(/&quot;/g, '')
            .replace(/&#x27;/g, '');
          expect(withoutEntities).not.toMatch(/[<>"'&]/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('escapeHTML neutralizes event handler attributes in random strings', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 30 }),
        fc.constantFrom(
          'onclick="alert(1)"',
          'onerror="steal()"',
          'onload="evil()"',
          'onmouseover="hack()"',
          'onfocus="inject()"'
        ),
        fc.string({ maxLength: 30 }),
        (prefix, handler, suffix) => {
          const input = `<div ${handler}>${prefix}${suffix}</div>`;
          const escaped = escapeHTML(input);
          const withoutEntities = escaped
            .replace(/&amp;/g, '')
            .replace(/&lt;/g, '')
            .replace(/&gt;/g, '')
            .replace(/&quot;/g, '')
            .replace(/&#x27;/g, '');
          expect(withoutEntities).not.toMatch(/[<>"'&]/);
        }
      ),
      { numRuns: 100 }
    );
  });
});
