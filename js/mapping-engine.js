/**
 * Mapping Engine — DR Strategy Assignment Logic
 *
 * Pure module: no side effects, no DOM access.
 * Assigns AWS DR strategies to workloads based on RTO/RPO values
 * and criticality tier.
 */

/**
 * Strategy metadata for tradeoff display and dashboard rendering.
 * @type {Record<string, {costLevel: number, rtoRange: string, rpoRange: string, pros: string[], cons: string[]}>}
 */
export const STRATEGY_INFO = {
  'backup-restore': {
    costLevel: 1,
    rtoRange: '24h+',
    rpoRange: '24h+',
    pros: ['strategy.br.pro1', 'strategy.br.pro2'],
    cons: ['strategy.br.con1', 'strategy.br.con2']
  },
  'pilot-light': {
    costLevel: 2,
    rtoRange: '1h–24h',
    rpoRange: '1h–24h',
    pros: ['strategy.pl.pro1', 'strategy.pl.pro2'],
    cons: ['strategy.pl.con1', 'strategy.pl.con2']
  },
  'warm-standby': {
    costLevel: 3,
    rtoRange: '5min–1h',
    rpoRange: '1min–1h',
    pros: ['strategy.ws.pro1', 'strategy.ws.pro2'],
    cons: ['strategy.ws.con1', 'strategy.ws.con2']
  },
  'multi-site-active-active': {
    costLevel: 4,
    rtoRange: 'Near-zero',
    rpoRange: 'Near-zero',
    pros: ['strategy.ms.pro1', 'strategy.ms.pro2'],
    cons: ['strategy.ms.con1', 'strategy.ms.con2']
  }
};

/**
 * Strategy ordering from least to most aggressive.
 * Index position determines aggressiveness level.
 */
const STRATEGY_ORDER = [
  'backup-restore',
  'pilot-light',
  'warm-standby',
  'multi-site-active-active'
];

/**
 * Converts a time value with unit to minutes.
 *
 * @param {number} value - Positive numeric value
 * @param {string} unit - One of 'seconds', 'minutes', 'hours', 'days'
 * @returns {number} Value normalized to minutes
 */
export function normalizeToMinutes(value, unit) {
  switch (unit) {
    case 'seconds':
      return value / 60;
    case 'minutes':
      return value;
    case 'hours':
      return value * 60;
    case 'days':
      return value * 1440;
    default:
      return value;
  }
}

/**
 * Determines the primary strategy based on RTO/RPO in minutes,
 * without considering criticality tier.
 *
 * @param {number} rtoMinutes - RTO normalized to minutes
 * @param {number} rpoMinutes - RPO normalized to minutes
 * @returns {string} Primary DRStrategy value
 */
function getPrimaryStrategy(rtoMinutes, rpoMinutes) {
  // Multi-site Active/Active: RTO < 5 AND RPO < 1
  if (rtoMinutes < 5 && rpoMinutes < 1) {
    return 'multi-site-active-active';
  }

  // Warm Standby: RTO 5–60 AND RPO 1–60
  if (rtoMinutes >= 5 && rtoMinutes <= 60 && rpoMinutes >= 1 && rpoMinutes <= 60) {
    return 'warm-standby';
  }

  // Pilot Light: RTO 60–1440 AND RPO 60–1440
  if (rtoMinutes >= 60 && rtoMinutes <= 1440 && rpoMinutes >= 60 && rpoMinutes <= 1440) {
    return 'pilot-light';
  }

  // Backup & Restore: RTO > 1440 AND RPO > 1440
  if (rtoMinutes > 1440 && rpoMinutes > 1440) {
    return 'backup-restore';
  }

  // Boundary/ambiguous cases — use the most aggressive strategy
  // that either RTO or RPO qualifies for individually
  return resolveAmbiguousMapping(rtoMinutes, rpoMinutes);
}

/**
 * Resolves ambiguous cases where RTO and RPO fall into different
 * strategy ranges. Uses the more aggressive of the two individual
 * classifications.
 *
 * @param {number} rtoMinutes - RTO normalized to minutes
 * @param {number} rpoMinutes - RPO normalized to minutes
 * @returns {string} DRStrategy value
 */
function resolveAmbiguousMapping(rtoMinutes, rpoMinutes) {
  const rtoStrategy = classifySingleMetric(rtoMinutes, 'rto');
  const rpoStrategy = classifySingleMetric(rpoMinutes, 'rpo');

  const rtoIndex = STRATEGY_ORDER.indexOf(rtoStrategy);
  const rpoIndex = STRATEGY_ORDER.indexOf(rpoStrategy);

  // Return the more aggressive (higher index) strategy
  return STRATEGY_ORDER[Math.max(rtoIndex, rpoIndex)];
}

/**
 * Classifies a single metric (RTO or RPO) into a strategy range.
 *
 * @param {number} minutes - Value in minutes
 * @param {string} metric - 'rto' or 'rpo'
 * @returns {string} DRStrategy value
 */
function classifySingleMetric(minutes, metric) {
  if (metric === 'rpo') {
    if (minutes < 1) return 'multi-site-active-active';
    if (minutes >= 1 && minutes <= 60) return 'warm-standby';
    if (minutes > 60 && minutes <= 1440) return 'pilot-light';
    return 'backup-restore';
  }

  // RTO thresholds
  if (minutes < 5) return 'multi-site-active-active';
  if (minutes >= 5 && minutes <= 60) return 'warm-standby';
  if (minutes > 60 && minutes <= 1440) return 'pilot-light';
  return 'backup-restore';
}

/**
 * Determines if a value sits on a boundary between two strategy ranges.
 * Returns the two adjacent strategies if on a boundary, or null otherwise.
 *
 * @param {number} rtoMinutes - RTO normalized to minutes
 * @param {number} rpoMinutes - RPO normalized to minutes
 * @returns {{lower: string, upper: string} | null} Adjacent strategies or null
 */
function detectBoundary(rtoMinutes, rpoMinutes) {
  // Boundary between Multi-site and Warm Standby
  // RTO = 5 (boundary between <5 and 5-60) or RPO = 1 (boundary between <1 and 1-60)
  if (rtoMinutes === 5 || rpoMinutes === 1) {
    return { lower: 'warm-standby', upper: 'multi-site-active-active' };
  }

  // Boundary between Warm Standby and Pilot Light
  // RTO = 60 (boundary between 5-60 and 60-1440) or RPO = 60 (boundary between 1-60 and 60-1440)
  if (rtoMinutes === 60 || rpoMinutes === 60) {
    return { lower: 'pilot-light', upper: 'warm-standby' };
  }

  // Boundary between Pilot Light and Backup & Restore
  // RTO = 1440 (boundary between 60-1440 and >1440) or RPO = 1440 (boundary between 60-1440 and >1440)
  if (rtoMinutes === 1440 || rpoMinutes === 1440) {
    return { lower: 'backup-restore', upper: 'pilot-light' };
  }

  return null;
}

/**
 * Applies criticality tier tiebreaker logic at boundaries.
 *
 * - Tier 1 (most critical): pushes toward more aggressive strategy
 * - Tier 2: stays with primary mapping
 * - Tier 3 (least critical): pushes toward more conservative strategy
 *
 * @param {string} primaryStrategy - Strategy from primary mapping
 * @param {string} criticality - 'tier1', 'tier2', or 'tier3'
 * @param {number} rtoMinutes - RTO normalized to minutes
 * @param {number} rpoMinutes - RPO normalized to minutes
 * @returns {string} Final DRStrategy value
 */
function applyTiebreaker(primaryStrategy, criticality, rtoMinutes, rpoMinutes) {
  if (criticality === 'tier2') {
    return primaryStrategy;
  }

  const boundary = detectBoundary(rtoMinutes, rpoMinutes);
  if (!boundary) {
    return primaryStrategy;
  }

  if (criticality === 'tier1') {
    // Push toward more aggressive (upper)
    return boundary.upper;
  }

  if (criticality === 'tier3') {
    // Push toward more conservative (lower)
    return boundary.lower;
  }

  return primaryStrategy;
}

/**
 * Assigns a DR strategy to a workload based on its RTO, RPO, and criticality tier.
 * Pure function — no side effects.
 *
 * @param {object} workload - Workload object with rto, rpo, and criticality
 * @param {object} workload.rto - { value: number, unit: string }
 * @param {object} workload.rpo - { value: number, unit: string }
 * @param {string} workload.criticality - 'tier1', 'tier2', or 'tier3'
 * @returns {string} One of: 'backup-restore', 'pilot-light', 'warm-standby', 'multi-site-active-active'
 */
export function assignStrategy(workload) {
  const rtoMinutes = normalizeToMinutes(workload.rto.value, workload.rto.unit);
  const rpoMinutes = normalizeToMinutes(workload.rpo.value, workload.rpo.unit);

  const primaryStrategy = getPrimaryStrategy(rtoMinutes, rpoMinutes);
  return applyTiebreaker(primaryStrategy, workload.criticality, rtoMinutes, rpoMinutes);
}

/**
 * Strategy display labels keyed by strategy ID.
 */
const STRATEGY_LABELS = {
  'backup-restore': 'Backup & Restore',
  'pilot-light': 'Pilot Light',
  'warm-standby': 'Warm Standby',
  'multi-site-active-active': 'Multi-site Active/Active'
};

/**
 * Maps an array of workloads, assigning a DR strategy to each.
 * Returns new array with strategy and normalized values attached.
 *
 * @param {object[]} workloads - Array of Workload objects
 * @returns {object[]} Array of MappedWorkload objects with strategy, strategyLabel, rtoMinutes, rpoMinutes
 */
export function mapAllWorkloads(workloads) {
  return workloads.map(workload => {
    const strategy = assignStrategy(workload);
    return {
      ...workload,
      strategy,
      strategyLabel: STRATEGY_LABELS[strategy],
      rtoMinutes: normalizeToMinutes(workload.rto.value, workload.rto.unit),
      rpoMinutes: normalizeToMinutes(workload.rpo.value, workload.rpo.unit)
    };
  });
}
