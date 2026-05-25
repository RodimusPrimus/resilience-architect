/**
 * Unit tests for the dashboard renderer.
 * Tests the exported functions with a simulated DOM environment.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Set up a minimal DOM before importing the module
const dom = new JSDOM(`
  <div>
    <div id="pie-chart-container" class="chart-container">
      <canvas id="pie-chart"></canvas>
    </div>
    <div id="pie-chart-fallback" class="chart-fallback hidden"></div>
    <div id="quadrant-chart-container" class="chart-container">
      <canvas id="quadrant-chart"></canvas>
    </div>
    <div id="quadrant-chart-fallback" class="chart-fallback hidden"></div>
    <div id="tradeoff-cards" role="list"></div>
  </div>
`);

// Set up global DOM
global.document = dom.window.document;
global.window = dom.window;

// Mock the i18n t() function to return the key (or a readable label)
vi.mock('../js/i18n.js', () => ({
  t: (key) => {
    const map = {
      'strategy.backupRestore': 'Backup & Restore',
      'strategy.pilotLight': 'Pilot Light',
      'strategy.warmStandby': 'Warm Standby',
      'strategy.multiSiteActiveActive': 'Multi-site Active/Active',
      'dashboard.tradeoff.pros': 'Pros',
      'dashboard.tradeoff.cons': 'Cons',
      'dashboard.pieChart.title': 'Strategy Distribution',
      'strategy.br.pro1': 'Lowest infrastructure cost',
      'strategy.br.pro2': 'Simplest to implement and manage',
      'strategy.br.con1': 'Highest potential data loss',
      'strategy.br.con2': 'Longest recovery time',
      'strategy.pl.pro1': 'Cost-effective with core services running',
      'strategy.pl.pro2': 'Faster recovery than Backup & Restore',
      'strategy.pl.con1': 'Compute resources scaled down',
      'strategy.pl.con2': 'Moderate RTO',
      'strategy.ws.pro1': 'Minutes-level recovery time',
      'strategy.ws.pro2': 'Fully functional environment always running',
      'strategy.ws.con1': 'Higher ongoing infrastructure cost',
      'strategy.ws.con2': 'Scaled-down environment may need scaling',
      'strategy.ms.pro1': 'Near-zero RTO and RPO',
      'strategy.ms.pro2': 'No failover delay',
      'strategy.ms.con1': 'Most expensive',
      'strategy.ms.con2': 'Complex licensing'
    };
    return map[key] || key;
  }
}));

// Import after mocks are set up
const { renderDashboard, renderPieChart, renderQuadrantChart, renderTradeoffCards, updateChartsTheme } = await import('../js/dashboard.js');

describe('dashboard.js', () => {
  const sampleWorkloads = [
    { id: '1', name: 'Payment Gateway', criticality: 'tier1', strategy: 'multi-site-active-active', strategyLabel: 'Multi-site Active/Active', rtoMinutes: 2, rpoMinutes: 0.5 },
    { id: '2', name: 'Web App', criticality: 'tier2', strategy: 'warm-standby', strategyLabel: 'Warm Standby', rtoMinutes: 30, rpoMinutes: 15 },
    { id: '3', name: 'Email Server', criticality: 'tier2', strategy: 'pilot-light', strategyLabel: 'Pilot Light', rtoMinutes: 240, rpoMinutes: 120 },
    { id: '4', name: 'Archive', criticality: 'tier3', strategy: 'backup-restore', strategyLabel: 'Backup & Restore', rtoMinutes: 2880, rpoMinutes: 2880 },
    { id: '5', name: 'CRM', criticality: 'tier2', strategy: 'warm-standby', strategyLabel: 'Warm Standby', rtoMinutes: 20, rpoMinutes: 10 }
  ];

  beforeEach(() => {
    // Reset DOM elements
    document.getElementById('pie-chart-fallback').innerHTML = '';
    document.getElementById('pie-chart-fallback').classList.add('hidden');
    document.getElementById('quadrant-chart-fallback').innerHTML = '';
    document.getElementById('quadrant-chart-fallback').classList.add('hidden');
    document.getElementById('tradeoff-cards').innerHTML = '';
    // Ensure Chart.js is NOT available (test fallback behavior)
    delete global.window.Chart;
  });

  describe('renderPieChart (fallback mode)', () => {
    it('renders a fallback table when Chart.js is unavailable', () => {
      renderPieChart(sampleWorkloads);

      const fallback = document.getElementById('pie-chart-fallback');
      expect(fallback.classList.contains('hidden')).toBe(false);
      // Note: textContent is used for strategy labels via t(), but & is escaped in table cells
      expect(fallback.textContent).toContain('Backup');
      expect(fallback.textContent).toContain('Pilot Light');
      expect(fallback.textContent).toContain('Warm Standby');
      expect(fallback.textContent).toContain('Multi-site Active/Active');
    });

    it('shows correct workload counts in fallback table', () => {
      renderPieChart(sampleWorkloads);

      const fallback = document.getElementById('pie-chart-fallback');
      // Warm Standby has 2 workloads
      expect(fallback.innerHTML).toContain('Web App, CRM');
    });

    it('returns null when Chart.js is unavailable', () => {
      const result = renderPieChart(sampleWorkloads);
      expect(result).toBeNull();
    });
  });

  describe('renderQuadrantChart (fallback mode)', () => {
    it('renders a fallback table when Chart.js is unavailable', () => {
      renderQuadrantChart(sampleWorkloads);

      const fallback = document.getElementById('quadrant-chart-fallback');
      expect(fallback.classList.contains('hidden')).toBe(false);
      expect(fallback.innerHTML).toContain('Payment Gateway');
      expect(fallback.innerHTML).toContain('Web App');
      expect(fallback.innerHTML).toContain('Archive');
    });

    it('shows strategy and criticality in fallback table', () => {
      renderQuadrantChart(sampleWorkloads);

      const fallback = document.getElementById('quadrant-chart-fallback');
      expect(fallback.innerHTML).toContain('tier1');
      expect(fallback.innerHTML).toContain('tier2');
      expect(fallback.innerHTML).toContain('tier3');
    });

    it('returns null when Chart.js is unavailable', () => {
      const result = renderQuadrantChart(sampleWorkloads);
      expect(result).toBeNull();
    });
  });

  describe('renderTradeoffCards', () => {
    it('renders cards only for strategies with assigned workloads', () => {
      const strategies = ['backup-restore', 'warm-standby'];
      renderTradeoffCards(strategies);

      const container = document.getElementById('tradeoff-cards');
      const cards = container.querySelectorAll('.tradeoff-card');
      expect(cards.length).toBe(2);
    });

    it('renders pros and cons for each strategy card', () => {
      renderTradeoffCards(['backup-restore']);

      const container = document.getElementById('tradeoff-cards');
      const card = container.querySelector('.tradeoff-card');
      expect(card).not.toBeNull();

      const prosList = card.querySelector('.pros');
      expect(prosList).not.toBeNull();
      expect(prosList.children.length).toBe(2);

      const consList = card.querySelector('.cons');
      expect(consList).not.toBeNull();
      expect(consList.children.length).toBe(2);
    });

    it('renders all four strategy cards when all are present', () => {
      const allStrategies = ['backup-restore', 'pilot-light', 'warm-standby', 'multi-site-active-active'];
      renderTradeoffCards(allStrategies);

      const container = document.getElementById('tradeoff-cards');
      const cards = container.querySelectorAll('.tradeoff-card');
      expect(cards.length).toBe(4);
    });

    it('renders no cards for empty strategies array', () => {
      renderTradeoffCards([]);

      const container = document.getElementById('tradeoff-cards');
      const cards = container.querySelectorAll('.tradeoff-card');
      expect(cards.length).toBe(0);
    });

    it('includes strategy name in card title', () => {
      renderTradeoffCards(['multi-site-active-active']);

      const container = document.getElementById('tradeoff-cards');
      const title = container.querySelector('h4');
      expect(title.textContent).toBe('Multi-site Active/Active');
    });
  });

  describe('renderDashboard', () => {
    it('orchestrates rendering of all dashboard components', () => {
      renderDashboard({
        workloads: sampleWorkloads,
        locale: 'en',
        theme: 'dark'
      });

      // Fallback tables should be rendered (no Chart.js)
      const pieFallback = document.getElementById('pie-chart-fallback');
      expect(pieFallback.classList.contains('hidden')).toBe(false);

      const quadrantFallback = document.getElementById('quadrant-chart-fallback');
      expect(quadrantFallback.classList.contains('hidden')).toBe(false);

      // Tradeoff cards should be rendered
      const container = document.getElementById('tradeoff-cards');
      const cards = container.querySelectorAll('.tradeoff-card');
      expect(cards.length).toBe(4); // All 4 strategies present in sample
    });
  });

  describe('updateChartsTheme', () => {
    it('does not throw when no charts are initialized', () => {
      expect(() => updateChartsTheme('light')).not.toThrow();
      expect(() => updateChartsTheme('dark')).not.toThrow();
    });
  });

  describe('XSS protection in fallback tables', () => {
    it('escapes HTML in workload names for fallback tables', () => {
      const maliciousWorkloads = [
        { id: '1', name: '<script>alert("xss")</script>', criticality: 'tier1', strategy: 'backup-restore', strategyLabel: 'Backup & Restore', rtoMinutes: 2880, rpoMinutes: 2880 }
      ];

      renderPieChart(maliciousWorkloads);

      const fallback = document.getElementById('pie-chart-fallback');
      expect(fallback.innerHTML).not.toContain('<script>');
      expect(fallback.innerHTML).toContain('&lt;script&gt;');
    });
  });
});
