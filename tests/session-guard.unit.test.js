import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveToSession,
  loadFromSession,
  clearSession,
  hasSessionData
} from '../js/session-guard.js';

/**
 * Mock sessionStorage for Node.js test environment.
 */
function createMockSessionStorage() {
  const store = new Map();
  return {
    getItem: vi.fn((key) => store.get(key) ?? null),
    setItem: vi.fn((key, value) => store.set(key, value)),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    get length() { return store.size; },
    key: vi.fn((i) => [...store.keys()][i] ?? null),
    _store: store,
  };
}

describe('session-guard', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockSessionStorage();
    globalThis.sessionStorage = mockStorage;
  });

  afterEach(() => {
    delete globalThis.sessionStorage;
  });

  describe('saveToSession', () => {
    it('saves workloads to sessionStorage under the correct key', () => {
      const workloads = [{ id: 'wl-1', name: 'API Gateway' }];
      saveToSession(workloads);

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'resilience-architect-session',
        expect.any(String)
      );

      const stored = JSON.parse(mockStorage._store.get('resilience-architect-session'));
      expect(stored.workloads).toEqual(workloads);
      expect(stored.version).toBe(1);
      expect(stored.timestamp).toBeTypeOf('number');
    });

    it('includes optional metadata (currentStep, locale)', () => {
      saveToSession([], { currentStep: 'ingestion', locale: 'es' });

      const stored = JSON.parse(mockStorage._store.get('resilience-architect-session'));
      expect(stored.currentStep).toBe('ingestion');
      expect(stored.locale).toBe('es');
    });

    it('defaults currentStep to context and locale to en', () => {
      saveToSession([]);

      const stored = JSON.parse(mockStorage._store.get('resilience-architect-session'));
      expect(stored.currentStep).toBe('context');
      expect(stored.locale).toBe('en');
    });

    it('handles null workloads by saving empty array', () => {
      saveToSession(null);

      const stored = JSON.parse(mockStorage._store.get('resilience-architect-session'));
      expect(stored.workloads).toEqual([]);
    });

    it('retries on QuotaExceededError after clearing stale data', () => {
      let callCount = 0;
      mockStorage.setItem = vi.fn((key, value) => {
        callCount++;
        if (callCount === 1) {
          // First call during availability check succeeds
          mockStorage._store.set(key, value);
        } else if (callCount === 2) {
          // Second call (actual save) throws quota error
          const error = new DOMException('Quota exceeded', 'QuotaExceededError');
          throw error;
        } else {
          // Third call (retry) succeeds
          mockStorage._store.set(key, value);
        }
      });

      saveToSession([{ id: 'wl-1', name: 'DB' }]);

      expect(mockStorage.removeItem).toHaveBeenCalledWith('resilience-architect-session');
    });
  });

  describe('loadFromSession', () => {
    it('returns workloads array when valid data exists', () => {
      const workloads = [{ id: 'wl-1', name: 'API' }];
      mockStorage._store.set('resilience-architect-session', JSON.stringify({
        version: 1,
        workloads,
        currentStep: 'ingestion',
        locale: 'en',
        timestamp: Date.now(),
      }));

      const result = loadFromSession();
      expect(result).toEqual(workloads);
    });

    it('returns null when no data exists', () => {
      expect(loadFromSession()).toBeNull();
    });

    it('returns null when stored data is invalid JSON', () => {
      mockStorage._store.set('resilience-architect-session', 'not-json{{{');
      expect(loadFromSession()).toBeNull();
    });

    it('returns null when stored data has no workloads array', () => {
      mockStorage._store.set('resilience-architect-session', JSON.stringify({ version: 1 }));
      expect(loadFromSession()).toBeNull();
    });

    it('returns null when stored data is not an object', () => {
      mockStorage._store.set('resilience-architect-session', JSON.stringify('string'));
      expect(loadFromSession()).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('removes the session key from sessionStorage', () => {
      mockStorage._store.set('resilience-architect-session', 'data');
      clearSession();
      expect(mockStorage.removeItem).toHaveBeenCalledWith('resilience-architect-session');
    });
  });

  describe('hasSessionData', () => {
    it('returns true when session data exists', () => {
      mockStorage._store.set('resilience-architect-session', '{}');
      expect(hasSessionData()).toBe(true);
    });

    it('returns false when no session data exists', () => {
      expect(hasSessionData()).toBe(false);
    });
  });

  describe('sessionStorage unavailability (private browsing)', () => {
    beforeEach(() => {
      // Simulate private browsing where sessionStorage throws on access
      globalThis.sessionStorage = {
        getItem: () => { throw new DOMException('Access denied'); },
        setItem: () => { throw new DOMException('Access denied'); },
        removeItem: () => { throw new DOMException('Access denied'); },
        clear: () => { throw new DOMException('Access denied'); },
      };
    });

    it('saveToSession does not throw', () => {
      expect(() => saveToSession([{ id: 'wl-1', name: 'Test' }])).not.toThrow();
    });

    it('loadFromSession returns null', () => {
      expect(loadFromSession()).toBeNull();
    });

    it('clearSession does not throw', () => {
      expect(() => clearSession()).not.toThrow();
    });

    it('hasSessionData returns false', () => {
      expect(hasSessionData()).toBe(false);
    });
  });
});
