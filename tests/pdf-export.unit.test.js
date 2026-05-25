/**
 * Unit tests for the PDF export module.
 * Tests the exported functions with a simulated DOM environment.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Set up a minimal DOM before importing the module
const dom = new JSDOM(`
  <body>
    <section id="step-dashboard" class="wizard-step">
      <div class="step-content">
        <h2 id="dashboard-heading">DR Strategy Dashboard</h2>
        <div class="dashboard-grid">
          <div class="dashboard-card">Chart content</div>
          <div class="dashboard-card">Quadrant content</div>
          <div class="dashboard-card dashboard-card-full">Tradeoff content</div>
        </div>
        <div class="step-actions">
          <button id="btn-dashboard-back">Back</button>
          <button id="btn-export-pdf">Export PDF Report</button>
        </div>
      </div>
    </section>
  </body>
`);

// Set up global DOM
global.document = dom.window.document;
global.window = dom.window;

// Mock session-guard module
vi.mock('../js/session-guard.js', () => ({
  clearSession: vi.fn(),
}));

// Mock i18n module
vi.mock('../js/i18n.js', () => ({
  t: vi.fn((key) => {
    const translations = {
      'export.subtitle': 'Disaster Recovery Strategy Report',
      'export.unavailable': 'PDF export requires html2pdf.js library. Please check your internet connection.',
      'footer.attribution': 'Designed by Allan Rodezno - Solutions Architect',
    };
    return translations[key] || key;
  }),
}));

// Import after mocks and DOM are set up
const { exportDashboardToPDF, checkPDFAvailability } = await import('../js/pdf-export.js');
const { clearSession } = await import('../js/session-guard.js');

describe('pdf-export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the export button state
    const btn = document.getElementById('btn-export-pdf');
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('title');
      btn.classList.remove('btn-disabled');
    }
  });

  afterEach(() => {
    delete global.window.html2pdf;
    // Clean up any temporary containers left behind
    const containers = document.querySelectorAll('.pdf-export-container');
    for (const c of containers) {
      c.remove();
    }
  });

  describe('checkPDFAvailability', () => {
    it('disables export button when html2pdf is not available', () => {
      delete global.window.html2pdf;

      checkPDFAvailability();

      const btn = document.getElementById('btn-export-pdf');
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('title')).toBe(
        'PDF export requires html2pdf.js library. Please check your internet connection.'
      );
      expect(btn.classList.contains('btn-disabled')).toBe(true);
    });

    it('does not disable export button when html2pdf is available', () => {
      global.window.html2pdf = vi.fn();

      checkPDFAvailability();

      const btn = document.getElementById('btn-export-pdf');
      expect(btn.disabled).toBe(false);
    });
  });

  describe('exportDashboardToPDF', () => {
    it('does nothing when html2pdf is not available', async () => {
      delete global.window.html2pdf;

      await exportDashboardToPDF({
        title: 'Resilience Architect: AWS DR Strategy Mapper',
        locale: 'en',
        theme: 'dark',
      });

      expect(clearSession).not.toHaveBeenCalled();
    });

    it('generates PDF with correct options and calls clearSession on success', async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockFrom = vi.fn(() => ({ save: mockSave }));
      const mockSet = vi.fn(() => ({ from: mockFrom }));
      global.window.html2pdf = vi.fn(() => ({ set: mockSet }));

      await exportDashboardToPDF({
        title: 'Resilience Architect: AWS DR Strategy Mapper',
        locale: 'en',
        theme: 'dark',
      });

      // Verify html2pdf was called
      expect(global.window.html2pdf).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        margin: [10, 10, 10, 10],
        filename: expect.stringContaining('DR-Strategy-Report-'),
        image: { type: 'png', quality: 1 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }));

      // Verify clearSession was called after successful export
      expect(clearSession).toHaveBeenCalled();
    });

    it('includes branding title in the PDF container', async () => {
      let capturedElement = null;
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockFrom = vi.fn((el) => {
        capturedElement = el;
        return { save: mockSave };
      });
      const mockSet = vi.fn(() => ({ from: mockFrom }));
      global.window.html2pdf = vi.fn(() => ({ set: mockSet }));

      await exportDashboardToPDF({
        title: 'Resilience Architect: AWS DR Strategy Mapper',
        locale: 'en',
        theme: 'dark',
      });

      // The captured element should contain the branding title
      expect(capturedElement).not.toBeNull();
      const h1 = capturedElement.querySelector('h1');
      expect(h1.textContent).toBe('Resilience Architect: AWS DR Strategy Mapper');
    });

    it('removes step-actions from cloned content', async () => {
      let capturedElement = null;
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockFrom = vi.fn((el) => {
        capturedElement = el;
        return { save: mockSave };
      });
      const mockSet = vi.fn(() => ({ from: mockFrom }));
      global.window.html2pdf = vi.fn(() => ({ set: mockSet }));

      await exportDashboardToPDF({
        title: 'Resilience Architect: AWS DR Strategy Mapper',
        locale: 'en',
        theme: 'dark',
      });

      // The captured element should NOT contain step-actions
      const actions = capturedElement.querySelector('.step-actions');
      expect(actions).toBeNull();
    });

    it('cleans up temporary container from DOM after export', async () => {
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockFrom = vi.fn(() => ({ save: mockSave }));
      const mockSet = vi.fn(() => ({ from: mockFrom }));
      global.window.html2pdf = vi.fn(() => ({ set: mockSet }));

      await exportDashboardToPDF({
        title: 'Resilience Architect: AWS DR Strategy Mapper',
        locale: 'en',
        theme: 'dark',
      });

      // Temporary container should be removed
      const container = document.querySelector('.pdf-export-container');
      expect(container).toBeNull();
    });

    it('cleans up temporary container even when html2pdf throws', async () => {
      const mockSave = vi.fn().mockRejectedValue(new Error('PDF generation failed'));
      const mockFrom = vi.fn(() => ({ save: mockSave }));
      const mockSet = vi.fn(() => ({ from: mockFrom }));
      global.window.html2pdf = vi.fn(() => ({ set: mockSet }));

      await expect(
        exportDashboardToPDF({
          title: 'Resilience Architect: AWS DR Strategy Mapper',
          locale: 'en',
          theme: 'dark',
        })
      ).rejects.toThrow('PDF generation failed');

      // Temporary container should still be removed
      const container = document.querySelector('.pdf-export-container');
      expect(container).toBeNull();

      // clearSession should NOT be called on failure
      expect(clearSession).not.toHaveBeenCalled();
    });

    it('applies light theme styling when theme is light', async () => {
      let capturedElement = null;
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockFrom = vi.fn((el) => {
        capturedElement = el;
        return { save: mockSave };
      });
      const mockSet = vi.fn(() => ({ from: mockFrom }));
      global.window.html2pdf = vi.fn(() => ({ set: mockSet }));

      await exportDashboardToPDF({
        title: 'Resilience Architect: AWS DR Strategy Mapper',
        locale: 'en',
        theme: 'light',
      });

      expect(capturedElement.getAttribute('data-theme')).toBe('light');
    });

    it('uses locale for date formatting in the report', async () => {
      let capturedElement = null;
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockFrom = vi.fn((el) => {
        capturedElement = el;
        return { save: mockSave };
      });
      const mockSet = vi.fn(() => ({ from: mockFrom }));
      global.window.html2pdf = vi.fn(() => ({ set: mockSet }));

      await exportDashboardToPDF({
        title: 'Resilience Architect: AWS DR Strategy Mapper',
        locale: 'es',
        theme: 'dark',
      });

      // The date should be formatted — just verify it exists in the container
      const allText = capturedElement.textContent;
      // Should contain the current year
      expect(allText).toContain(new Date().getFullYear().toString());
    });

    it('includes footer attribution in the PDF', async () => {
      let capturedElement = null;
      const mockSave = vi.fn().mockResolvedValue(undefined);
      const mockFrom = vi.fn((el) => {
        capturedElement = el;
        return { save: mockSave };
      });
      const mockSet = vi.fn(() => ({ from: mockFrom }));
      global.window.html2pdf = vi.fn(() => ({ set: mockSet }));

      await exportDashboardToPDF({
        title: 'Resilience Architect: AWS DR Strategy Mapper',
        locale: 'en',
        theme: 'dark',
      });

      const allText = capturedElement.textContent;
      expect(allText).toContain('Designed by Allan Rodezno - Solutions Architect');
    });
  });
});
