/**
 * i18n Module — Client-side translation engine using JSON dictionaries.
 * Supports English (en) and Spanish (es) with optional string interpolation.
 */

/** @type {Record<string, Record<string, string>>} */
const translations = {};

/** @type {string} */
let currentLocale = 'en';

/** @type {boolean} */
let initialized = false;

/**
 * Loads a translation JSON file for the given locale.
 * Tries multiple path strategies to work on both file:// and http:// protocols.
 * @param {string} locale - The locale code to load (e.g., 'en', 'es')
 * @returns {Promise<Record<string, string>>} The loaded translations
 */
async function loadTranslationFile(locale) {
  // Try relative path first (works when served via HTTP)
  const paths = [
    `./i18n/${locale}.json`,
    `i18n/${locale}.json`
  ];

  // Also try constructing from import.meta.url if available
  try {
    const basePath = new URL('.', import.meta.url).href.replace(/js\/$/, '');
    paths.unshift(`${basePath}i18n/${locale}.json`);
  } catch {
    // import.meta.url resolution failed — continue with relative paths
  }

  for (const url of paths) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // This path didn't work, try next
      continue;
    }
  }

  throw new Error(`Failed to load translations for locale: ${locale}`);
}

/**
 * Initializes the i18n module by loading translation files.
 * Defaults to 'en' if no locale is specified.
 * @param {string} [defaultLocale='en'] - The default locale to use
 * @returns {Promise<void>}
 */
export async function initI18n(defaultLocale = 'en') {
  currentLocale = defaultLocale;

  try {
    const [en, es] = await Promise.all([
      loadTranslationFile('en'),
      loadTranslationFile('es')
    ]);
    translations['en'] = en;
    translations['es'] = es;
  } catch (error) {
    // Fallback: if loading fails, use empty objects so the app doesn't crash
    console.warn('i18n: Failed to load translation files, falling back to keys.', error);
    if (!translations['en']) translations['en'] = {};
    if (!translations['es']) translations['es'] = {};
  }

  initialized = true;
  translatePage();
}

/**
 * Switches the active locale and re-renders all translated elements.
 * @param {string} locale - The locale to switch to ('en' or 'es')
 */
export function setLocale(locale) {
  if (locale !== 'en' && locale !== 'es') {
    console.warn(`i18n: Unsupported locale "${locale}", defaulting to "en".`);
    locale = 'en';
  }
  currentLocale = locale;
  if (initialized) {
    translatePage();
  }
}

/**
 * Returns the currently active locale.
 * @returns {string} The current locale code
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Returns the translated string for the given key with optional interpolation.
 * Interpolation replaces `{paramName}` placeholders with provided values.
 * @param {string} key - The translation key (dot-notation, e.g., 'form.workloadName')
 * @param {Record<string, string>} [params] - Optional interpolation parameters
 * @returns {string} The translated string, or the key itself if not found
 */
export function t(key, params) {
  const dict = translations[currentLocale] || translations['en'] || {};
  let value = dict[key];

  if (value === undefined || value === null) {
    // Fallback to English if key not found in current locale
    const fallback = translations['en'] || {};
    value = fallback[key];
  }

  if (value === undefined || value === null) {
    // Return the key itself as last resort
    return key;
  }

  // Interpolate parameters: replace {paramName} with provided values
  if (params && typeof params === 'object') {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramValue);
    }
  }

  return value;
}

/**
 * Updates all elements with [data-i18n], [data-i18n-placeholder], and
 * [data-i18n-aria] attributes with the current locale's translated strings.
 */
export function translatePage() {
  // Update textContent for elements with data-i18n
  const i18nElements = document.querySelectorAll('[data-i18n]');
  for (const el of i18nElements) {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  }

  // Update placeholder for elements with data-i18n-placeholder
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  for (const el of placeholderElements) {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.setAttribute('placeholder', t(key));
    }
  }

  // Update aria-label for elements with data-i18n-aria
  const ariaElements = document.querySelectorAll('[data-i18n-aria]');
  for (const el of ariaElements) {
    const key = el.getAttribute('data-i18n-aria');
    if (key) {
      el.setAttribute('aria-label', t(key));
    }
  }
}
