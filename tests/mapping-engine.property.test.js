/**
 * Property-based tests for the mapping engine.
 * Uses fast-check to verify universal properties across all valid inputs.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  normalizeToMinutes,
  assignStrategy,
  mapAllWorkloads,
  STRATEGY_INFO
} from '../js/mapping-engine.js';

// Valid domain constants
const VALID_UNITS = ['seconds', 'minutes', 'hours', 'days'];
const VALID_STRATEGIES = ['backup-restore', 'pilot-light', 'warm-standby', 'multi-site-active-active'];
const VALID_CRITICALITIES = ['tier1', 'tier2', 'tier3'];

// Strategy ordering from least to most aggressive
const STRATEGY_ORDER = ['backup-restore', 'pilot-light', 'warm-standby', 'multi-site-active-active'];

function strategyIndex(strategy) {
  return STRATEGY_ORDER.indexOf(strategy);
}

// --- Generators ---

/** Generates a random valid TimeUnit */
const timeUnitArb = fc.constantFrom(...VALID_UNITS);

/** Generates a random positive number suitable for time values */
const positiveNumberArb = fc.double({ min: 0.001, max: 100000, noNaN: true, noDefaultInfinity: true });

/** Generates a random valid CriticalityTier */
const criticalityArb = fc.constantFrom(...VALID_CRITICALITIES);

/** Generates a random valid TimeValue (positive number + unit) */
const timeValueArb = fc.record({
  value: positiveNumberArb,
  unit: timeUnitArb
});

/** Generates a random valid Workload object */
const workloadArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  criticality: criticalityArb,
  rto: timeValueArb,
  rpo: timeValueArb
});

// Feature: rto-rpo-calculator, Property 1: Time normalization round-trip consistency
describe('Property 1: Time normalization round-trip consistency', () => {
  /**
   * **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**
   *
   * For any valid TimeValue (positive number with unit), normalizeToMinutes produces
   * consistent results for semantically equivalent values.
   */
  it('normalizeToMinutes produces consistent results for semantically equivalent values', () => {
    fc.assert(
      fc.property(positiveNumberArb, (value) => {
        // value hours should equal value*60 minutes
        const hoursAsMinutes = normalizeToMinutes(value, 'hours');
        const minutesDirect = normalizeToMinutes(value * 60, 'minutes');
        expect(hoursAsMinutes).toBeCloseTo(minutesDirect, 5);

        // value days should equal value*24 hours
        const daysAsMinutes = normalizeToMinutes(value, 'days');
        const hoursEquiv = normalizeToMinutes(value * 24, 'hours');
        expect(daysAsMinutes).toBeCloseTo(hoursEquiv, 5);

        // value minutes should equal value*60 seconds
        const minutesAsMinutes = normalizeToMinutes(value, 'minutes');
        const secondsEquiv = normalizeToMinutes(value * 60, 'seconds');
        expect(minutesAsMinutes).toBeCloseTo(secondsEquiv, 5);

        // 1 day = 24 hours = 1440 minutes = 86400 seconds (cross-unit consistency)
        const oneDayMin = normalizeToMinutes(value, 'days');
        const asSecondsMin = normalizeToMinutes(value * 86400, 'seconds');
        expect(oneDayMin).toBeCloseTo(asSecondsMin, 5);
      }),
      { numRuns: 100 }
    );
  });

  it('normalizeToMinutes always returns a positive number for positive inputs', () => {
    fc.assert(
      fc.property(positiveNumberArb, timeUnitArb, (value, unit) => {
        const result = normalizeToMinutes(value, unit);
        expect(result).toBeGreaterThan(0);
        expect(typeof result).toBe('number');
        expect(Number.isFinite(result)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: rto-rpo-calculator, Property 2: Mapping engine is a total function
describe('Property 2: Mapping engine is a total function over valid workloads', () => {
  /**
   * **Validates: Requirements 9.1**
   *
   * For any valid Workload, assignStrategy returns exactly one value from
   * {backup-restore, pilot-light, warm-standby, multi-site-active-active},
   * never throws or returns undefined.
   */
  it('assignStrategy always returns exactly one valid strategy for any valid workload', () => {
    fc.assert(
      fc.property(workloadArb, (workload) => {
        const result = assignStrategy(workload);

        // Must not be undefined or null
        expect(result).toBeDefined();
        expect(result).not.toBeNull();

        // Must be exactly one of the four valid strategies
        expect(VALID_STRATEGIES).toContain(result);

        // Must be a string
        expect(typeof result).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  it('assignStrategy never throws for any valid workload', () => {
    fc.assert(
      fc.property(workloadArb, (workload) => {
        // Should not throw
        expect(() => assignStrategy(workload)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: rto-rpo-calculator, Property 3: Mapping engine range correctness
describe('Property 3: Mapping engine range correctness', () => {
  /**
   * **Validates: Requirements 9.2, 9.3, 9.4, 9.5**
   *
   * For values clearly within each strategy's range, the correct strategy is assigned.
   */

  it('assigns Backup & Restore for RTO > 1440 and RPO > 1440 minutes', () => {
    // Generate values clearly above 1440 minutes (24h)
    const aboveDayArb = fc.double({ min: 1441, max: 100000, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(aboveDayArb, aboveDayArb, criticalityArb, (rtoMin, rpoMin, crit) => {
        const workload = {
          id: 'test',
          name: 'Test',
          criticality: crit,
          rto: { value: rtoMin, unit: 'minutes' },
          rpo: { value: rpoMin, unit: 'minutes' }
        };
        const result = assignStrategy(workload);
        expect(result).toBe('backup-restore');
      }),
      { numRuns: 100 }
    );
  });

  it('assigns Pilot Light for RTO 60–1440 and RPO 60–1440 minutes (non-boundary, tier2)', () => {
    // Generate values strictly within pilot-light range, avoiding boundaries
    const pilotLightArb = fc.double({ min: 61, max: 1439, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(pilotLightArb, pilotLightArb, (rtoMin, rpoMin) => {
        const workload = {
          id: 'test',
          name: 'Test',
          criticality: 'tier2',
          rto: { value: rtoMin, unit: 'minutes' },
          rpo: { value: rpoMin, unit: 'minutes' }
        };
        const result = assignStrategy(workload);
        expect(result).toBe('pilot-light');
      }),
      { numRuns: 100 }
    );
  });

  it('assigns Warm Standby for RTO 5–60 and RPO 1–60 minutes (non-boundary, tier2)', () => {
    // Generate values strictly within warm-standby range, avoiding boundaries
    const warmStandbyRtoArb = fc.double({ min: 6, max: 59, noNaN: true, noDefaultInfinity: true });
    const warmStandbyRpoArb = fc.double({ min: 2, max: 59, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(warmStandbyRtoArb, warmStandbyRpoArb, (rtoMin, rpoMin) => {
        const workload = {
          id: 'test',
          name: 'Test',
          criticality: 'tier2',
          rto: { value: rtoMin, unit: 'minutes' },
          rpo: { value: rpoMin, unit: 'minutes' }
        };
        const result = assignStrategy(workload);
        expect(result).toBe('warm-standby');
      }),
      { numRuns: 100 }
    );
  });

  it('assigns Multi-site Active/Active for RTO < 5 and RPO < 1 minutes', () => {
    // Generate values clearly in multi-site range
    const multiSiteRtoArb = fc.double({ min: 0.001, max: 4.99, noNaN: true, noDefaultInfinity: true });
    const multiSiteRpoArb = fc.double({ min: 0.001, max: 0.99, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(multiSiteRtoArb, multiSiteRpoArb, criticalityArb, (rtoMin, rpoMin, crit) => {
        const workload = {
          id: 'test',
          name: 'Test',
          criticality: crit,
          rto: { value: rtoMin, unit: 'minutes' },
          rpo: { value: rpoMin, unit: 'minutes' }
        };
        const result = assignStrategy(workload);
        expect(result).toBe('multi-site-active-active');
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: rto-rpo-calculator, Property 4: Criticality tier monotonicity at boundaries
describe('Property 4: Criticality tier monotonicity at boundaries', () => {
  /**
   * **Validates: Requirements 9.6**
   *
   * At boundary values, changing criticality from Tier 3 to Tier 1 results in
   * equal or more aggressive strategy.
   * Strategy ordering: Backup & Restore < Pilot Light < Warm Standby < Multi-site Active/Active
   */

  // Boundary values where tiebreaker logic applies
  const boundaryConfigs = [
    // RTO=5 boundary (between multi-site and warm-standby)
    { rto: { value: 5, unit: 'minutes' }, rpo: { value: 0.5, unit: 'minutes' } },
    // RPO=1 boundary (between multi-site and warm-standby)
    { rto: { value: 3, unit: 'minutes' }, rpo: { value: 1, unit: 'minutes' } },
    // RTO=60 boundary (between warm-standby and pilot-light)
    { rto: { value: 60, unit: 'minutes' }, rpo: { value: 30, unit: 'minutes' } },
    // RPO=60 boundary (between warm-standby and pilot-light)
    { rto: { value: 30, unit: 'minutes' }, rpo: { value: 60, unit: 'minutes' } },
    // RTO=1440 boundary (between pilot-light and backup-restore)
    { rto: { value: 1440, unit: 'minutes' }, rpo: { value: 1440, unit: 'minutes' } },
    // RPO=1440 boundary (between pilot-light and backup-restore)
    { rto: { value: 720, unit: 'minutes' }, rpo: { value: 1440, unit: 'minutes' } },
    // RTO=1 hour = 60 minutes boundary
    { rto: { value: 1, unit: 'hours' }, rpo: { value: 60, unit: 'minutes' } },
    // RTO=1 day = 1440 minutes boundary
    { rto: { value: 1, unit: 'days' }, rpo: { value: 1, unit: 'days' } },
  ];

  const boundaryArb = fc.constantFrom(...boundaryConfigs);

  it('Tier 1 results in equal or more aggressive strategy than Tier 3 at boundaries', () => {
    fc.assert(
      fc.property(boundaryArb, (boundary) => {
        const workloadTier1 = {
          id: 'test',
          name: 'Test',
          criticality: 'tier1',
          rto: boundary.rto,
          rpo: boundary.rpo
        };

        const workloadTier3 = {
          id: 'test',
          name: 'Test',
          criticality: 'tier3',
          rto: boundary.rto,
          rpo: boundary.rpo
        };

        const strategyTier1 = assignStrategy(workloadTier1);
        const strategyTier3 = assignStrategy(workloadTier3);

        // Tier 1 should be equal or more aggressive (higher index) than Tier 3
        expect(strategyIndex(strategyTier1)).toBeGreaterThanOrEqual(strategyIndex(strategyTier3));
      }),
      { numRuns: 100 }
    );
  });

  it('Tier 2 results in equal or more aggressive strategy than Tier 3 at boundaries', () => {
    fc.assert(
      fc.property(boundaryArb, (boundary) => {
        const workloadTier2 = {
          id: 'test',
          name: 'Test',
          criticality: 'tier2',
          rto: boundary.rto,
          rpo: boundary.rpo
        };

        const workloadTier3 = {
          id: 'test',
          name: 'Test',
          criticality: 'tier3',
          rto: boundary.rto,
          rpo: boundary.rpo
        };

        const strategyTier2 = assignStrategy(workloadTier2);
        const strategyTier3 = assignStrategy(workloadTier3);

        // Tier 2 should be equal or more aggressive than Tier 3
        expect(strategyIndex(strategyTier2)).toBeGreaterThanOrEqual(strategyIndex(strategyTier3));
      }),
      { numRuns: 100 }
    );
  });

  it('Tier 1 results in equal or more aggressive strategy than Tier 2 at boundaries', () => {
    fc.assert(
      fc.property(boundaryArb, (boundary) => {
        const workloadTier1 = {
          id: 'test',
          name: 'Test',
          criticality: 'tier1',
          rto: boundary.rto,
          rpo: boundary.rpo
        };

        const workloadTier2 = {
          id: 'test',
          name: 'Test',
          criticality: 'tier2',
          rto: boundary.rto,
          rpo: boundary.rpo
        };

        const strategyTier1 = assignStrategy(workloadTier1);
        const strategyTier2 = assignStrategy(workloadTier2);

        // Tier 1 should be equal or more aggressive than Tier 2
        expect(strategyIndex(strategyTier1)).toBeGreaterThanOrEqual(strategyIndex(strategyTier2));
      }),
      { numRuns: 100 }
    );
  });
});
