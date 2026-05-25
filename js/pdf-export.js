/**
 * PDF Export — html2pdf.js wrapper for branded report generation.
 *
 * Captures the dashboard DOM content and generates a downloadable PDF report
 * with branding, proper formatting, and page breaks. Clears session data
 * after successful export.
 *
 * Requires html2pdf.js loaded via CDN (available as window.html2pdf).
 */

import { clearSession } from './session-guard.js';
import { t } from './i18n.js';

/**
 * Checks if html2pdf.js is available (loaded via CDN).
 * @returns {boolean}
 */
function isHtml2PdfAvailable() {
  return typeof window !== 'undefined' && typeof window.html2pdf !== 'undefined';
}

/**
 * Checks PDF library availability and disables the export button if unavailable.
 * Should be called on page load to provide early feedback if CDN failed.
 */
export function checkPDFAvailability() {
  const btn = document.getElementById('btn-export-pdf');
  if (!btn) return;

  if (!isHtml2PdfAvailable()) {
    btn.disabled = true;
    btn.setAttribute('title', t('export.unavailable') || 'PDF export requires html2pdf.js library. Please check your internet connection.');
    btn.classList.add('btn-disabled');
  }
}

/**
 * Converts canvas elements in a container to static <img> elements
 * so that html2pdf can capture the chart content.
 * @param {HTMLElement} container - The cloned container with canvas elements
 * @param {HTMLElement} sourceContainer - The original container with rendered canvases
 */
function convertCanvasesToImages(container, sourceContainer) {
  const sourceCanvases = sourceContainer.querySelectorAll('canvas');
  const clonedCanvases = container.querySelectorAll('canvas');

  sourceCanvases.forEach((sourceCanvas, index) => {
    const clonedCanvas = clonedCanvases[index];
    if (!clonedCanvas || !sourceCanvas) return;

    try {
      const dataUrl = sourceCanvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.width = '100%';
      img.style.maxWidth = sourceCanvas.offsetWidth + 'px';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.margin = '0 auto';
      clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
    } catch (e) {
      // Canvas tainted or unavailable — leave as-is
      console.warn('PDF Export: Could not convert canvas to image', e);
    }
  });
}

/**
 * Exports the dashboard content as a branded PDF report.
 *
 * @param {object} options - Export options
 * @param {string} options.title - Report title (branding)
 * @param {string} options.locale - Current locale ('en' or 'es')
 * @param {string} options.theme - Current theme ('dark' or 'light')
 * @returns {Promise<void>}
 */
export async function exportDashboardToPDF(options) {
  const { title, locale, theme } = options;

  // Verify html2pdf.js is available
  if (!isHtml2PdfAvailable()) {
    checkPDFAvailability();
    return;
  }

  const dashboardContent = document.querySelector('#step-dashboard .step-content');
  if (!dashboardContent) {
    return;
  }

  // Create a wrapper element for PDF generation with branding header
  const pdfContainer = document.createElement('div');
  pdfContainer.className = 'pdf-export-container';
  pdfContainer.setAttribute('data-theme', theme);

  // Apply styling for PDF readability — explicit word-spacing to prevent collapsed spaces
  pdfContainer.style.cssText = `
    font-family: Inter, system-ui, -apple-system, sans-serif;
    padding: 20px;
    background-color: ${theme === 'dark' ? '#1a1a2e' : '#ffffff'};
    color: ${theme === 'dark' ? '#f0f0f0' : '#1e293b'};
    word-spacing: normal;
    letter-spacing: normal;
    white-space: normal;
    line-height: 1.5;
    width: 794px;
  `;

  // Add branded header
  const header = document.createElement('div');
  header.style.cssText = `
    text-align: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid ${theme === 'dark' ? '#3b82f6' : '#2563eb'};
    word-spacing: normal;
  `;

  const brandTitle = document.createElement('h1');
  brandTitle.textContent = title;
  brandTitle.style.cssText = `
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 8px 0;
    color: ${theme === 'dark' ? '#60a5fa' : '#2563eb'};
    word-spacing: normal;
    letter-spacing: normal;
  `;
  header.appendChild(brandTitle);

  const subtitle = document.createElement('p');
  subtitle.textContent = t('export.subtitle') || 'Disaster Recovery Strategy Report';
  subtitle.style.cssText = `
    font-size: 14px;
    margin: 0;
    opacity: 0.8;
    word-spacing: normal;
  `;
  header.appendChild(subtitle);

  const dateStr = new Date().toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const dateLine = document.createElement('p');
  dateLine.textContent = dateStr;
  dateLine.style.cssText = `
    font-size: 12px;
    margin: 8px 0 0 0;
    opacity: 0.6;
    word-spacing: normal;
  `;
  header.appendChild(dateLine);

  pdfContainer.appendChild(header);

  // Clone dashboard content to avoid modifying the live DOM
  const contentClone = dashboardContent.cloneNode(true);

  // Convert canvas charts to static images (cloneNode doesn't copy canvas pixels)
  convertCanvasesToImages(contentClone, dashboardContent);

  // Remove action buttons from the cloned content (they shouldn't appear in PDF)
  const actionButtons = contentClone.querySelectorAll('.step-actions');
  for (const el of actionButtons) {
    el.remove();
  }

  // Remove hidden fallback elements
  const hiddenFallbacks = contentClone.querySelectorAll('.hidden');
  for (const el of hiddenFallbacks) {
    el.remove();
  }

  // Ensure proper spacing on all text elements in the clone
  const allTextElements = contentClone.querySelectorAll('h2, h3, h4, p, li, td, th, span, label');
  for (const el of allTextElements) {
    el.style.wordSpacing = 'normal';
    el.style.letterSpacing = 'normal';
    el.style.whiteSpace = 'normal';
  }

  // Add page break hints for proper PDF formatting
  const dashboardCards = contentClone.querySelectorAll('.dashboard-card');
  for (const card of dashboardCards) {
    card.style.pageBreakInside = 'avoid';
    card.style.marginBottom = '16px';
  }

  pdfContainer.appendChild(contentClone);

  // Add footer to PDF
  const footer = document.createElement('div');
  footer.style.cssText = `
    text-align: center;
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid ${theme === 'dark' ? '#2a3a5e' : '#cbd5e1'};
    font-size: 11px;
    opacity: 0.7;
    word-spacing: normal;
  `;
  footer.textContent = t('footer.attribution') || 'Designed by Allan Rodezno - Solutions Architect';
  pdfContainer.appendChild(footer);

  // Temporarily append to body for html2pdf to capture
  document.body.appendChild(pdfContainer);

  // Configure html2pdf options
  const pdfOptions = {
    margin: [10, 10, 10, 10],
    filename: `DR-Strategy-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'png', quality: 1 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: theme === 'dark' ? '#1a1a2e' : '#ffffff',
      letterRendering: true,
      logging: false
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    },
    pagebreak: {
      mode: ['avoid-all', 'css', 'legacy'],
      before: '.page-break-before',
      after: '.page-break-after',
      avoid: '.dashboard-card'
    }
  };

  try {
    await window.html2pdf().set(pdfOptions).from(pdfContainer).save();

    // Clear session after successful export
    clearSession();
  } finally {
    // Clean up the temporary container
    if (pdfContainer.parentNode) {
      document.body.removeChild(pdfContainer);
    }
  }
}
