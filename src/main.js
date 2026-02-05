import * as echarts from 'echarts';
import aemoTheme from './theme/echarts-theme.js';
import { startPoller, stopPoller } from './store/poller.js';
import { abortAll } from './store/actions.js';
import './style.css';

// Register custom theme once
echarts.registerTheme('aemo', aemoTheme);

// ── Page modules ─────────────────────────────────────────────────────
import { renderDispatchOverview }     from './pages/DispatchOverview.js';
import { renderPriceAndDemand }       from './pages/PriceAndDemand.js';
import { renderCumulativePrice }      from './pages/CumulativePrice.js';
import { renderFuelMix }              from './pages/FuelMix.js';
import { renderAveragePrice }         from './pages/AveragePrice.js';
import { renderSevenDayOutlook }      from './pages/SevenDayOutlook.js';
import { renderRenewablePenetration } from './pages/RenewablePenetration.js';
import { renderWemOutages }           from './pages/WemOutages.js';
import { renderEssPricing }           from './pages/EssPricing.js';
import { renderDpvDemand }            from './pages/DpvDemand.js';
import { renderWaDispatch }          from './pages/WaDispatch.js';
import { renderFcasPrices }          from './pages/FcasPrices.js';
import { renderNetInterchange }      from './pages/NetInterchange.js';
import { renderWaReserves }          from './pages/WaReserves.js';
import { renderWaGenMap }            from './pages/WaGenMap.js';

const PAGES = [
  { id: 'dispatch',   label: 'Dispatch Overview',     render: renderDispatchOverview },
  { id: 'price',      label: 'Price and Demand',      render: renderPriceAndDemand },
  { id: 'cumulative', label: 'Cumulative Price',      render: renderCumulativePrice },
  { id: 'fuelmix',    label: 'Fuel Mix',              render: renderFuelMix },
  { id: 'renewable',  label: 'Renewable Penetration', render: renderRenewablePenetration },
  { id: 'avgprice',   label: 'Average Price',         render: renderAveragePrice },
  { id: 'outlook',    label: '7-Day Outlook',         render: renderSevenDayOutlook },
  { id: 'fcas',       label: 'FCAS Prices',           render: renderFcasPrices },
  { id: 'interchange',label: 'Net Interchange',       render: renderNetInterchange },
  { id: 'outages',    label: 'WEM Outages',           render: renderWemOutages },
  { id: 'ess',        label: 'WEM Energy Price',      render: renderEssPricing },
  { id: 'dpv',        label: 'DPV vs Demand',         render: renderDpvDemand },
  { id: 'wadispatch', label: 'WA Dispatch',           render: renderWaDispatch },
  { id: 'wareserves', label: 'WA Reserves',           render: renderWaReserves },
  { id: 'wamap',      label: 'WA Gen Map',            render: renderWaGenMap },
];

let cleanupFns = [];

function cleanup() {
  for (const fn of cleanupFns) { try { fn(); } catch {} }
  cleanupFns = [];
}

function navigate(pageId) {
  cleanup();
  const page = PAGES.find(p => p.id === pageId) || PAGES[0];
  window.location.hash = page.id;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page.id);
  });

  const container = document.getElementById('page');
  container.innerHTML = '';
  page.render(container, cleanupFns);
}

function buildTabs() {
  const nav = document.getElementById('tabs');
  for (const p of PAGES) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.page = p.id;
    btn.textContent = p.label;
    btn.addEventListener('click', () => navigate(p.id));
    nav.appendChild(btn);
  }
}

// ── Init ─────────────────────────────────────────────────────────────
buildTabs();
startPoller();

const initialPage = window.location.hash.replace('#', '') || PAGES[0].id;
navigate(initialPage);

window.addEventListener('hashchange', () => {
  const id = window.location.hash.replace('#', '');
  if (id) navigate(id);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  cleanup();
  stopPoller();
  abortAll();
});
