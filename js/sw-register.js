/**
 * Service Worker Registration Module
 * Registers the service worker for offline PWA support.
 * Handles registration failure gracefully — the app continues without offline support.
 */

/**
 * Registers the service worker if the browser supports it.
 * Logs success or failure to the console. Never throws or blocks the app.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service workers are not supported in this browser. Offline mode unavailable.');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((registration) => {
        console.log('[SW] Service worker registered successfully. Scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('[SW] Service worker registration failed:', error.message || error);
      });
  });
}
