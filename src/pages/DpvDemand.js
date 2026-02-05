/**
 * DPV vs Demand — Distributed PV generation overlaid against
 * operational demand in the WEM (SWIS).
 *
 * Data source: distributed-pv_opdemand.csv
 */
import wemApi from '../api/WemApi.js';
import { normaliseDpv } from '../api/wemTransform.js';
import { wemDpvDemand } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { WEM_FRESHNESS } from '../api/config.js';
import { ChartController } from '../charts/ChartController.js';

function buildOption(rows) {
  const times = rows.map(r => r.time);

  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 70, right: 70, bottom: 50, top: 60 },
    xAxis: { type: 'category', data: times, axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: [
      { type: 'value', name: 'Demand (MW)', position: 'left', nameTextStyle: { color: '#3379bf' } },
      { type: 'value', name: 'DPV (MW)', position: 'right', nameTextStyle: { color: '#FFD565' } },
    ],
    series: [
      {
        name: 'Operational Demand', type: 'line', yAxisIndex: 0, symbol: 'none',
        data: rows.map(r => r.demand),
        lineStyle: { color: '#3379bf', width: 2 }, itemStyle: { color: '#3379bf' },
        areaStyle: { color: 'rgba(51,121,191,0.12)' },
      },
      {
        name: 'Distributed PV', type: 'line', yAxisIndex: 1, symbol: 'none',
        data: rows.map(r => r.dpv),
        lineStyle: { color: '#FFD565', width: 2 }, itemStyle: { color: '#FFD565' },
        areaStyle: { color: 'rgba(255,213,101,0.2)' },
      },
    ],
  };
}

function updateKpi(container, rows) {
  const kpiRow = container.querySelector('.kpi-row');
  if (!kpiRow || rows.length === 0) return;

  const latest = rows[rows.length - 1];
  const maxDpv = Math.max(...rows.map(r => r.dpv).filter(v => v != null));
  const minDemand = Math.min(...rows.map(r => r.demand).filter(v => v != null));

  kpiRow.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">Current Demand</span>
      <span class="kpi-value" style="color:#3379bf">${Math.round(latest.demand || 0).toLocaleString()} MW</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Current DPV</span>
      <span class="kpi-value" style="color:#E67E22">${Math.round(latest.dpv || 0).toLocaleString()} MW</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Peak DPV</span>
      <span class="kpi-value" style="color:#FFD565">${Math.round(maxDpv || 0).toLocaleString()} MW</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Min Demand</span>
      <span class="kpi-value" style="color:#5493d1">${Math.round(minDemand || 0).toLocaleString()} MW</span>
    </div>
  `;
}

const fetchDpv = (signal) => wemApi.getDpvDemand(signal);

export function renderDpvDemand(container, cleanupFns) {
  container.innerHTML = `
    <div class="page-header"><h2>DPV vs Demand (WEM)</h2></div>
    <div class="kpi-row"></div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));

  const render = () => {
    const state = wemDpvDemand.get();
    if (!state.data) return;

    const rows = normaliseDpv(state.data);
    if (rows.length === 0) return;

    const option = buildOption(rows);
    ctrl.setOption(option);
    updateKpi(container, rows);
  };

  const unsub = wemDpvDemand.listen(render);
  fetchIfStale(wemDpvDemand, fetchDpv, WEM_FRESHNESS);
  render();

  const unregPoll = registerPoll('wem:dpvDemand', wemDpvDemand, fetchDpv, WEM_FRESHNESS);

  cleanupFns.push(() => {
    unsub();
    unregPoll();
    ctrl.dispose();
  });
}
