/**
 * Theme Controller
 * Manages dark/light mode switching with sessionStorage persistence.
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

const STORAGE_KEY = 'resilience-architect-theme';
const VALID_THEMES = ['dark', 'light'];

let currentTheme = 'dark';

/**
 * Safely read from sessionStorage.
 * Returns null if sessionStorage is unavailable (e.g., private browsing).
 */
function readFromStorage() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Safely write to sessionStorage.
 * Fails silently if sessionStorage is unavailable.
 */
function writeToStorage(theme) {
  try {
    sessionStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // sessionStorage unavailable (private browsing) — continue without persistence
  }
}

/**
 * Apply the given theme by setting the data-theme attribute on <html>.
 * @param {string} theme - 'dark' or 'light'
 */
export function applyTheme(theme) {
  if (!VALID_THEMES.includes(theme)) {
    theme = 'dark';
  }
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  writeToStorage(theme);
}

/**
 * Initialize the theme controller.
 * Checks sessionStorage for a saved preference; defaults to 'dark' if none found.
 */
export function initTheme() {
  const saved = readFromStorage();
  const theme = VALID_THEMES.includes(saved) ? saved : 'dark';
  applyTheme(theme);
}

/**
 * Toggle between dark and light themes.
 */
export function toggleTheme() {
  const next = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

/**
 * Get the current active theme.
 * @returns {'dark' | 'light'}
 */
export function getTheme() {
  return currentTheme;
}
