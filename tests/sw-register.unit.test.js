import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sw-register', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('window', {
      addEventListener: vi.fn((event, callback) => {
        if (event === 'load') {
          callback();
        }
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should export registerServiceWorker as a function', async () => {
    vi.stubGlobal('navigator', {});
    const module = await import('../js/sw-register.js');
    expect(typeof module.registerServiceWorker).toBe('function');
  });

  it('should log warning when serviceWorker is not supported', async () => {
    vi.stubGlobal('navigator', {});
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { registerServiceWorker } = await import('../js/sw-register.js');
    registerServiceWorker();

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('not supported')
    );
  });

  it('should not throw when serviceWorker is not supported', async () => {
    vi.stubGlobal('navigator', {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { registerServiceWorker } = await import('../js/sw-register.js');
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it('should attempt registration when serviceWorker is supported', async () => {
    const mockRegistration = { scope: 'http://localhost/' };
    const registerMock = vi.fn().mockResolvedValue(mockRegistration);

    vi.stubGlobal('navigator', {
      serviceWorker: { register: registerMock },
    });

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { registerServiceWorker } = await import('../js/sw-register.js');
    registerServiceWorker();

    // Wait for the promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(registerMock).toHaveBeenCalledWith('./service-worker.js');
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('registered successfully'),
      expect.any(String)
    );
  });

  it('should log warning and not throw when registration fails', async () => {
    const registerMock = vi.fn().mockRejectedValue(new Error('Network error'));

    vi.stubGlobal('navigator', {
      serviceWorker: { register: registerMock },
    });

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { registerServiceWorker } = await import('../js/sw-register.js');
    expect(() => registerServiceWorker()).not.toThrow();

    // Wait for the promise to reject
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('registration failed'),
      expect.any(String)
    );
  });
});
