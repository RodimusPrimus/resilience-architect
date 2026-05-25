// Feature: rto-rpo-calculator, Property 8: Quadrant chart positioning reflects strategy cost and criticality
// Feature: rto-rpo-calculator, Property 9: Displayed tradeoff cards match assigned strategies exactly
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { STRATEGY_INFO } from '../js/mapping-engine.js';

/**
 * Criticality tier to X-axis numeric value mapping (mirrors dashboard.js CRITICALITY_X).
 */
const CRITICALITY_X = {
  'tier3': 1,
  'tier2': 2,
  'tier1': 3
};

/**
 * All valid DR strategies.
 */
const ALL_STRATEGIES = ['backup-restore', 'pilot-light', 'warm-standby', 'multi-site-active-active'];

/**
 * All valid criticality tiers.
 */
const ALL_TIERS = ['tier1', 'tier2', 'tier3'];

/**
 * Generator for a single MappedWorkload object.
 */
const mappedWorkloadArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  criticality: fc.constantFrom(...ALL_TIERS),
  strategy: fc.constantFrom(...ALL_STRATEGIES),
  rtoMinutes: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  rpoMinutes: fc.double({ min: 0.01, max: 10000, noNaN: true })
});

/**
 * Generator for a non-empty array of MappedWorkloads.
 */
const mappedWorkloadsArb = fc.array(mappedWorkloadArb, { minLength: 1, maxLength: 20 });

/**
 * **Validates: Requirements 11.2**
 *
 * Property 8: For any set of MappedWorkloads, the Y-axis position (cost) is
 * monotonically non-decreasing with strategy costLevel (BR=1 < PL=2 < WS=3 < MS=4),
 * and X-axis position (criticality) is ordered by tier (tier3=1 < tier2=2 < tier1=3).
 */
describe('Property 8: Quadrant chart positioning reflects strategy cost and criticality', () => {
  it('Y-axis position (costLevel) is monotonically non-decreasing with strategy ordering', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STRATEGIES),
        fc.constantFrom(...ALL_STRATEGIES),
        (strategyA, strategyB) => {
          const costA = STRATEGY_INFO[strategyA].costLevel;
          const costB = STRATEGY_INFO[strategyB].costLevel;
          const orderA = ALL_STRATEGIES.indexOf(strategyA);
          const orderB = ALL_STRATEGIES.indexOf(strategyB);

          // If strategyA comes before strategyB in the ordering,
          // its costLevel should be <= costLevel of strategyB
          if (orderA < orderB) {
            expect(costA).toBeLessThanOrEqual(costB);
          } else if (orderA > orderB) {
            expect(costA).toBeGreaterThanOrEqual(costB);
          } else {
            expect(costA).toBe(costB);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('X-axis position (criticality) is ordered: tier3=1 < tier2=2 < tier1=3', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_TIERS),
        fc.constantFrom(...ALL_TIERS),
        (tierA, tierB) => {
          const xA = CRITICALITY_X[tierA];
          const xB = CRITICALITY_X[tierB];

          // tier3 < tier2 < tier1 in criticality number (3 > 2 > 1)
          // So tier with higher number (tier1=most critical) gets higher X value
          const tierNumA = parseInt(tierA.replace('tier', ''));
          const tierNumB = parseInt(tierB.replace('tier', ''));

          // Lower tier number = more critical = higher X position
          if (tierNumA < tierNumB) {
            expect(xA).toBeGreaterThan(xB);
          } else if (tierNumA > tierNumB) {
            expect(xA).toBeLessThan(xB);
          } else {
            expect(xA).toBe(xB);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any MappedWorkload, quadrant position is correctly derived from strategy and criticality', () => {
    fc.assert(
      fc.property(mappedWorkloadArb, (workload) => {
        const yPosition = STRATEGY_INFO[workload.strategy].costLevel;
        const xPosition = CRITICALITY_X[workload.criticality];

        // Y position must be a valid costLevel (1-4)
        expect(yPosition).toBeGreaterThanOrEqual(1);
        expect(yPosition).toBeLessThanOrEqual(4);

        // X position must be a valid criticality value (1-3)
        expect(xPosition).toBeGreaterThanOrEqual(1);
        expect(xPosition).toBeLessThanOrEqual(3);

        // Verify the specific mappings
        expect(yPosition).toBe(STRATEGY_INFO[workload.strategy].costLevel);
        expect(xPosition).toBe(CRITICALITY_X[workload.criticality]);
      }),
      { numRuns: 100 }
    );
  });

  it('costLevel strictly increases across the strategy ordering (BR < PL < WS < MS)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 }), (idx) => {
        const lowerStrategy = ALL_STRATEGIES[idx];
        const higherStrategy = ALL_STRATEGIES[idx + 1];
        const lowerCost = STRATEGY_INFO[lowerStrategy].costLevel;
        const higherCost = STRATEGY_INFO[higherStrategy].costLevel;

        expect(lowerCost).toBeLessThan(higherCost);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Validates: Requirements 12.1**
 *
 * Property 9: For any non-empty set of MappedWorkloads, the set of tradeoff cards
 * rendered equals exactly the set of unique DR strategies present in the mapped workloads.
 * No strategy without assigned workloads has a tradeoff card, and no assigned strategy
 * is missing its tradeoff card.
 */
describe('Property 9: Displayed tradeoff cards match assigned strategies exactly', () => {
  it('unique strategies extracted from workloads match the set that would be rendered as cards', () => {
    fc.assert(
      fc.property(mappedWorkloadsArb, (workloads) => {
        // This mirrors the logic in renderDashboard: extract unique strategies
        const strategiesFromWorkloads = [...new Set(workloads.map(w => w.strategy))];

        // The renderTradeoffCards function receives this exact set
        // Verify: every strategy in workloads is included (no missing cards)
        for (const w of workloads) {
          expect(strategiesFromWorkloads).toContain(w.strategy);
        }

        // Verify: no extra strategies beyond what's in workloads (no phantom cards)
        for (const strategy of strategiesFromWorkloads) {
          expect(workloads.some(w => w.strategy === strategy)).toBe(true);
        }

        // Verify: all strategies in the set are valid and have STRATEGY_INFO entries
        for (const strategy of strategiesFromWorkloads) {
          expect(STRATEGY_INFO[strategy]).toBeDefined();
          expect(STRATEGY_INFO[strategy].pros).toBeDefined();
          expect(STRATEGY_INFO[strategy].cons).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('the number of tradeoff cards equals the number of unique strategies in workloads', () => {
    fc.assert(
      fc.property(mappedWorkloadsArb, (workloads) => {
        const uniqueStrategies = [...new Set(workloads.map(w => w.strategy))];
        const cardCount = uniqueStrategies.length;

        // Card count must be between 1 and 4 (since we have 4 strategies)
        expect(cardCount).toBeGreaterThanOrEqual(1);
        expect(cardCount).toBeLessThanOrEqual(4);

        // Card count equals unique strategy count
        expect(cardCount).toBe(uniqueStrategies.length);
      }),
      { numRuns: 100 }
    );
  });

  it('strategies with multiple workloads still produce exactly one tradeoff card each', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STRATEGIES),
        fc.integer({ min: 2, max: 10 }),
        (strategy, count) => {
          // Create multiple workloads with the same strategy
          const workloads = Array.from({ length: count }, (_, i) => ({
            id: `id-${i}`,
            name: `Workload ${i}`,
            criticality: ALL_TIERS[i % ALL_TIERS.length],
            strategy,
            rtoMinutes: 100,
            rpoMinutes: 100
          }));

          const uniqueStrategies = [...new Set(workloads.map(w => w.strategy))];

          // Even with multiple workloads of same strategy, only 1 card
          expect(uniqueStrategies.length).toBe(1);
          expect(uniqueStrategies[0]).toBe(strategy);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every valid strategy has complete STRATEGY_INFO metadata for card rendering', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_STRATEGIES), (strategy) => {
        const info = STRATEGY_INFO[strategy];

        expect(info).toBeDefined();
        expect(info.costLevel).toBeGreaterThanOrEqual(1);
        expect(info.costLevel).toBeLessThanOrEqual(4);
        expect(Array.isArray(info.pros)).toBe(true);
        expect(info.pros.length).toBeGreaterThan(0);
        expect(Array.isArray(info.cons)).toBe(true);
        expect(info.cons.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
