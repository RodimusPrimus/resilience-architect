/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initTheme, toggleTheme, getTheme, applyTheme } from '../js/theme.js';

describe('Theme Controller', () => {
  beforeEach(() => {
    // Reset DOM and sessionStorage before each test
    document.documentElement.removeAttribute('data-theme');
    sessionStorage.clear();
  });

  describe('initTheme', () => {
    it('defaults to dark theme when no saved preference', () => {
      initTheme();
      expect(getTheme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('restores saved theme from sessionStorage', () => {
      sessionStorage.setItem('resilience-architect-theme', 'light');
      initTheme();
      expect(getTheme()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('defaults to dark if sessionStorage has invalid value', () => {
      sessionStorage.setItem('resilience-architect-theme', 'invalid');
      initTheme();
      expect(getTheme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('switches from dark to light', () => {
      initTheme();
      toggleTheme();
      expect(getTheme()).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('switches from light back to dark', () => {
      initTheme();
      toggleTheme(); // dark → light
      toggleTheme(); // light → dark
      expect(getTheme()).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('persists toggled theme to sessionStorage', () => {
      initTheme();
      toggleTheme();
      expect(sessionStorage.getItem('resilience-architect-theme')).toBe('light');
    });
  });

  describe('getTheme', () => {
    it('returns current theme after init', () => {
      initTheme();
      expect(getTheme()).toBe('dark');
    });

    it('returns updated theme after toggle', () => {
      initTheme();
      toggleTheme();
      expect(getTheme()).toBe('light');
    });
  });

  describe('applyTheme', () => {
    it('applies dark theme', () => {
      applyTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(getTheme()).toBe('dark');
    });

    it('applies light theme', () => {
      applyTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(getTheme()).toBe('light');
    });

    it('falls back to dark for invalid theme value', () => {
      applyTheme('invalid');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(getTheme()).toBe('dark');
    });

    it('persists applied theme to sessionStorage', () => {
      applyTheme('light');
      expect(sessionStorage.getItem('resilience-architect-theme')).toBe('light');
    });
  });

  describe('sessionStorage unavailability', () => {
    it('handles sessionStorage being unavailable gracefully', () => {
      // Simulate sessionStorage throwing (private browsing)
      const originalGetItem = sessionStorage.getItem;
      const originalSetItem = sessionStorage.setItem;
      sessionStorage.getItem = () => { throw new Error('SecurityError'); };
      sessionStorage.setItem = () => { throw new Error('SecurityError'); };

      // Should not throw
      expect(() => initTheme()).not.toThrow();
      expect(getTheme()).toBe('dark');
      expect(() => toggleTheme()).not.toThrow();
      expect(getTheme()).toBe('light');

      // Restore
      sessionStorage.getItem = originalGetItem;
      sessionStorage.setItem = originalSetItem;
    });
  });
});
