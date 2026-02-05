/**
 * WEM Energy Price — Energy price time series from WEM pulse.csv.
 *
 * Originally planned to show ESS services (Regulation, Contingency, RoCoF)
 * but those columns are not present in pulse.csv and the JSON endpoint
 * (EssentialServicesPricing) returns 404. Shows energy price only.
 *
 * Data source: pulse.csv (ENERGY_PRICE column)
 */
import wemApi from '../api/WemApi.js';
import { normalisePulse } from '../api/wemTransform.js';
import { essColors } from '../theme/colors.js';
import { wemPulse } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { WEM_FRESHNESS } from '../api/config.js';
import { ChartController } from '../charts/ChartController.js';

const SERIES_CONFIG = [
  { key: 'energy',    name: 'Energy Price',        color: essColors.energy },
  { key: 'regRaise',  name: 'Regulation Raise',    color: essColors.regRaise },
  { key: 'regLower',  name: 'Regulation Lower',    color: essColors.regLower },
  { key: 'contRaise', name: 'Contingency Raise',   color: essColors.contRaise },
  { key: 'contLower', name: 'Contingency Lower',   color: essColors.contLower },
  { key: 'rocof',     name: 'RoCoF',               color: essColors.rocof },
];

function buildOption(essPricing) {
  const times = essPricing.map(row => row.time);

  const series = SERIES_CONFIG
    .filter(cfg => essPricing.some(row => row[cfg.key] != null))
    .map(cfg => ({
      name: cfg.name,
      type: 'line',
      symbol: 'none',
      data: essPricing.map(row => row[cfg.key]),
      lineStyle: { color: cfg.color, width: cfg.key === 'energy' ? 2.5 : 1.5 },
      itemStyle: { color: cfg.color },
    }));

  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 70, right: 30, bottom: 50, top: 60 },
    xAxis: { type: 'category', data: times, axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', name: '$/MWh' },
    series,
  };
}

function updateKpi(container, essPricing) {
  const kpiRow = container.querySelector('.kpi-row');
  if (!kpiRow || essPricing.length === 0) return;

  const latest = essPricing[essPricing.length - 1];
  const fmt = (v) => v != null ? `$${Number(v).toFixed(2)}` : '--';

  kpiRow.innerHTML = SERIES_CONFIG
    .filter(cfg => latest[cfg.key] != null)
    .map(cfg => `
      <div class="kpi">
        <span class="kpi-label">${cfg.name}</span>
        <span class="kpi-value" style="color:${cfg.color}">${fmt(latest[cfg.key])}</span>
      </div>
    `).join('');
}

const fetchPulse = (signal) => wemApi.getPulse(signal);

export function renderEssPricing(container, cleanupFns) {
  container.innerHTML = `
    <div class="deprecation-banner">DUPLICATE — This page overlaps with Price &amp; Demand (WA). Flagged for removal.</div>
    <div class="page-header"><h2>WEM Energy Price</h2></div>
    <div class="kpi-row"></div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));

  const render = () => {
    const state = wemPulse.get();
    if (!state.data) return;

    const { essPricing } = normalisePulse(state.data);
    if (essPricing.length === 0) return;

    const option = buildOption(essPricing);
    ctrl.setOption(option);
    updateKpi(container, essPricing);
  };

  const unsub = wemPulse.listen(render);
  fetchIfStale(wemPulse, fetchPulse, WEM_FRESHNESS);
  render();

  const unregPoll = registerPoll('wem:pulse', wemPulse, fetchPulse, WEM_FRESHNESS);

  cleanupFns.push(() => {
    unsub();
    unregPoll();
    ctrl.dispose();
  });
}
