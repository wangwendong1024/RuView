// Global data-source banner.
//
// The per-tab banner in SensingTab was correct and still invisible where it
// mattered: a reader on Dashboard or Live Demo never saw it, so a screen full
// of client-invented sensing frames was indistinguishable from measurement.
// This bar is fixed to the viewport and present on every tab, so the provenance
// of what is on screen is never more than a glance away.
//
// It shows nothing at all while data is live. An always-on badge becomes
// wallpaper; appearing only when the reading is not trustworthy keeps it
// meaningful.

import { sensingService } from '../services/sensing.service.js';
import { openApiAccess } from './connection-status.js';
import { i18n } from './i18n.js';

const STYLE_ID = 'ruview-data-source-banner-style';
const BAR_ID = 'ruview-data-source-banner';

const CONFIG = {
  // 'live' is intentionally absent: no banner is shown for trustworthy data.
  'server-simulated': {
    key: 'banner.serverSimulated',
    bg: '#7c3a00',
    fg: '#ffd9a0',
  },
  reconnecting: {
    key: 'banner.reconnecting',
    bg: '#33302a',
    fg: '#e8dcc0',
  },
  unreachable: {
    key: 'banner.unreachable',
    bg: '#5c1010',
    fg: '#ffc9c9',
  },
  simulated: {
    key: 'banner.clientSimulated',
    bg: '#6b0f6b',
    fg: '#ffc9ff',
  },
  // #2099: the server refused the stream. Clicking the bar opens API Access.
  'auth-required': {
    key: 'banner.tokenRequired',
    bg: '#5c1010',
    fg: '#ffc9c9',
  },
};

const CSS = `
#${BAR_ID} {
  position: sticky;
  top: 0;
  z-index: 100000;
  display: none;
  padding: 7px 14px;
  font: 600 13px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.04em;
  text-align: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.45);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
#${BAR_ID}.is-visible { display: block; }
/* Simulated data is the dangerous case — it looks real. Make the bar move so
   it cannot be mistaken for a static decoration. */
#${BAR_ID}.is-simulated { animation: ruview-dsb-pulse 1.6s ease-in-out infinite; }
@keyframes ruview-dsb-pulse { 50% { filter: brightness(1.45); } }
@media (prefers-reduced-motion: reduce) {
  #${BAR_ID}.is-simulated { animation: none; }
}
`;

export class DataSourceBanner {
  constructor() {
    this._bar = null;
    this._unsubscribe = null;
  }

  init() {
    if (typeof document === 'undefined') return;

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    this._bar = document.getElementById(BAR_ID);
    if (!this._bar) {
      this._bar = document.createElement('div');
      this._bar.id = BAR_ID;
      this._bar.setAttribute('role', 'status');
      // Announce changes, but don't interrupt: the reader is mid-task and the
      // message describes context, not an error to act on right now.
      this._bar.setAttribute('aria-live', 'polite');
      document.body.prepend(this._bar);
      this._bar.addEventListener('click', (e) => {
        if (sensingService.dataSource !== 'auth-required') return;
        // QuickSettings closes on any outside click; this click must not count.
        e.stopPropagation();
        openApiAccess(sensingService.authRequired);
      });
    }

    // dataSource changes are published on the state-listener channel.
    this._unsubscribe = sensingService.onStateChange(() => this.render());
    this._localeUnsub = i18n.onLocaleChange(() => this.render());
    this.render();
  }

  render() {
    if (!this._bar) return;
    const cfg = CONFIG[sensingService.dataSource];

    if (!cfg) {
      this._bar.classList.remove('is-visible', 'is-simulated');
      return;
    }

    const tokenRejected = sensingService.dataSource === 'auth-required'
      && sensingService.authRequired === 'rejected';
    this._bar.textContent = i18n.t(tokenRejected ? 'banner.tokenRejected' : cfg.key);
    this._bar.style.cursor = sensingService.dataSource === 'auth-required' ? 'pointer' : '';
    this._bar.style.background = cfg.bg;
    this._bar.style.color = cfg.fg;
    this._bar.classList.add('is-visible');
    this._bar.classList.toggle('is-simulated', sensingService.dataSource === 'simulated');
  }

  dispose() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this._localeUnsub?.();
    if (this._bar && this._bar.parentNode) {
      this._bar.parentNode.removeChild(this._bar);
    }
    this._bar = null;
  }
}

export const dataSourceBanner = new DataSourceBanner();
