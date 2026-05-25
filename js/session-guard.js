/**
 * Session Guard — sessionStorage refresh protection
 *
 * Prevents data loss on accidental page refresh by persisting workload data
 * in sessionStorage. Never uses localStorage, cookies, or IndexedDB.
 *
 * Storage key: 'resilience-architect-session'
 * Data format: { version: 1, workloads: [...], currentStep, locale, timestamp }
 */

const SESSION_KEY = 'resilience-architect-session';
const SCHEMA_VERSION = 1;

/**
 * Checks whether sessionStorage is available.
 * Returns false in private browsing modes or when storage is disabled.
 * @returns {boolean}
 */
function isSessionStorageAvailable() {
  try {
    const testKey = '__session_guard_test__';
    sessionStorage.setItem(testKey, '1');
    sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves workloads to sessionStorage under the app session key.
 * Handles QuotaExceededError by clearing stale data and retrying once.
 * Silently fails if sessionStorage is unavailable (private browsing).
 *
 * @param {Array} workloads - Array of workload objects to persist
 * @param {object} [options] - Optional metadata
 * @param {string} [options.currentStep] - Current wizard step ('context'|'ingestion'|'dashboard')
 * @param {string} [options.locale] - Current locale ('en'|'es')
 */
export function saveToSession(workloads, options = {}) {
  if (!isSessionStorageAvailable()) {
    return;
  }

  const data = {
    version: SCHEMA_VERSION,
    workloads: workloads || [],
    currentStep: options.currentStep || 'context',
    locale: options.locale || 'en',
    timestamp: Date.now(),
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (error) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      // Clear stale data and retry once
      try {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      } catch {
        // Retry failed — silently give up
      }
    }
    // Other errors — silently fail
  }
}

/**
 * Retrieves saved workloads from sessionStorage.
 * Returns null if no data exists, parsing fails, or sessionStorage is unavailable.
 *
 * @returns {Array|null} Array of workload objects or null
 */
export function loadFromSession() {
  if (!isSessionStorageAvailable()) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === null) {
      return null;
    }

    const data = JSON.parse(raw);

    if (!data || typeof data !== 'object' || !Array.isArray(data.workloads)) {
      return null;
    }

    return data.workloads;
  } catch {
    return null;
  }
}

/**
 * Removes all app data from sessionStorage.
 * Silently fails if sessionStorage is unavailable.
 */
export function clearSession() {
  if (!isSessionStorageAvailable()) {
    return;
  }

  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Checks if session data exists in sessionStorage.
 * Returns false if sessionStorage is unavailable or data doesn't exist.
 *
 * @returns {boolean}
 */
export function hasSessionData() {
  if (!isSessionStorageAvailable()) {
    return false;
  }

  try {
    return sessionStorage.getItem(SESSION_KEY) !== null;
  } catch {
    return false;
  }
}
