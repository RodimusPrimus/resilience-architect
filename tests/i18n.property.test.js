// Feature: rto-rpo-calculator, Property 7: Translation key completeness and symmetry
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import en from '../i18n/en.json';
import es from '../i18n/es.json';

/**
 * **Validates: Requirements 5.1**
 *
 * Property 7: For any translation key that exists in EN, that same key exists
 * in ES with a non-empty string value, and vice versa. Both dictionaries have
 * identical key sets.
 */
describe('Property 7: Translation key completeness and symmetry', () => {
  const enKeys = Object.keys(en);
  const esKeys = Object.keys(es);

  it('EN and ES dictionaries have identical key sets', () => {
    expect(enKeys.sort()).toEqual(esKeys.sort());
  });

  it('every EN key exists in ES with a non-empty string value', () => {
    fc.assert(
      fc.property(fc.constantFrom(...enKeys), (key) => {
        expect(es).toHaveProperty(key);
        expect(typeof es[key]).toBe('string');
        expect(es[key].trim().length).toBeGreaterThan(0);
      }),
      { numRuns: enKeys.length }
    );
  });

  it('every ES key exists in EN with a non-empty string value', () => {
    fc.assert(
      fc.property(fc.constantFrom(...esKeys), (key) => {
        expect(en).toHaveProperty(key);
        expect(typeof en[key]).toBe('string');
        expect(en[key].trim().length).toBeGreaterThan(0);
      }),
      { numRuns: esKeys.length }
    );
  });

  it('all EN values are non-empty strings', () => {
    fc.assert(
      fc.property(fc.constantFrom(...enKeys), (key) => {
        expect(typeof en[key]).toBe('string');
        expect(en[key].trim().length).toBeGreaterThan(0);
      }),
      { numRuns: enKeys.length }
    );
  });

  it('all ES values are non-empty strings', () => {
    fc.assert(
      fc.property(fc.constantFrom(...esKeys), (key) => {
        expect(typeof es[key]).toBe('string');
        expect(es[key].trim().length).toBeGreaterThan(0);
      }),
      { numRuns: esKeys.length }
    );
  });
});
