# Resilience Architect: AWS DR Strategy Mapper

A secure, client-side Progressive Web App (PWA) that maps workloads to AWS Disaster Recovery strategies based on RTO/RPO inputs and business criticality.

## Features

- **Wizard-based flow**: Executive Context → Workload Ingestion → Strategy Dashboard
- **AWS DR Strategy Mapping**: Automatically assigns Backup & Restore, Pilot Light, Warm Standby, or Multi-site Active/Active based on RTO/RPO thresholds
- **Interactive Dashboard**: Pie chart (strategy distribution) + Quadrant chart (cost vs. criticality) powered by Chart.js
- **Tradeoff Analysis**: Pros/cons cards for each assigned strategy
- **PDF Export**: Branded report generation via html2pdf.js
- **Bilingual**: English and Spanish (toggle in header)
- **Dark/Light Theme**: "Digital Marble" dark theme by default
- **Offline Support**: Service Worker with cache-first strategy
- **Installable PWA**: Works on iOS and Android via browser install
- **Zero Backend**: 100% client-side, no data leaves the browser

## Quick Start

Serve the files via any HTTP server:

```bash
npx serve . -p 3000
```

Then open `http://localhost:3000` in your browser.

> **Note**: Opening `index.html` directly via `file://` won't work due to browser security restrictions on ES modules and fetch requests.

## Tech Stack

- Plain HTML/CSS/JavaScript (ES Modules, no build step)
- [Chart.js 4.x](https://www.chartjs.org/) — Visualizations
- [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) — PDF export
- CSS Custom Properties — Theming
- Service Worker — Offline support

## DR Strategy Mapping Thresholds

Based on [AWS Disaster Recovery documentation](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html):

| Strategy | RTO | RPO | Cost Level |
|----------|-----|-----|-----------|
| Backup & Restore | 24h+ | 24h+ | $ |
| Pilot Light | 1h–24h | 1h–24h | $$ |
| Warm Standby | 5min–1h | 1min–1h | $$$ |
| Multi-site Active/Active | <5min | <1min | $$$$ |

Criticality tier acts as a tiebreaker at boundary values.

## Security

- All data processed in-memory only
- sessionStorage used strictly for refresh protection (auto-cleared on export)
- Input validation and XSS prevention via HTML entity encoding
- No external API calls for data processing
- No localStorage, cookies, or IndexedDB

## License

MIT

## Author

Designed by [Allan Rodezno](https://arodezno.com/contact/) — Solutions Architect
