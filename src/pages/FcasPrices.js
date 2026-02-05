/**
 * NEM FCAS Prices — Frequency Control Ancillary Services pricing
 * across all NEM regions.
 *
 * Data source: elecSummary.prices (already fetched for Dispatch Overview)
 * Shows current snapshot of all 10 FCAS service prices per region.
 */
import nemApi from '../api/NemApi.js';
import { NEM_REGIONS, NEM_FRESHNESS } from '../api/config.js';
import { regionColors } from '../theme/colors.js';
import { nemElecSummary } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { ChartController } from '../charts/ChartController.js';

const FCAS_SERVICES = [
  { key: 'raiseRegRrp',    label: 'Raise Reg' },
  { key: 'lowerRegRrp',    label: 'Lower Reg' },
  { key: 'raise6SecRrp',   label: 'Raise 6s' },
  { key: 'lower6SecRrp',   label: 'Lower 6s' },
  { key: 'raise60SecRrp',  label: 'Raise 60s' },
  { key: 'lower60SecRrp',  label: 'Lower 60s' },
  { key: 'raise5MinRrp',   label: 'Raise 5m' },
  { key: 'lower5MinRrp',   label: 'Lower 5m' },
  { key: 'raise1SecRrp',   label: 'Raise 1s' },
  { key: 'lower1SecRrp',   label: 'Lower 1s' },
];

export function buildOption(prices) {
  const regions = prices.map(p => p.regionId);
  const categories = FCAS_SERVICES.map(s => s.label);

  const series = prices.map(p => {
    const regionLabel = NEM_REGIONS.find(r => r.value === p.regionId)?.label || p.regionId;
    return {
      name: regionLabel,
      type: 'bar',
      data: FCAS_SERVICES.map(s => p[s.key] ?? 0),
      itemStyle: { color: regionColors[p.regionId] || '#6b778c' },
    };
  });

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: v => `$${Number(v).toFixed(2)}/MWh`,
    },
    legend: { top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 70, right: 30, bottom: 60, top: 60 },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { rotate: 30, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: '$/MWh',
      nameTextStyle: { color: '#333842' },
      axisLabel: { formatter: '${value}' },
    },
    series,
  };
}

function updateKpi(container, prices) {
  const kpiRow = container.querySelector('.kpi-row');
  if (!kpiRow || !prices || prices.length === 0) return;

  // Find highest FCAS price across all regions and services
  let maxPrice = 0;
  let maxService = '';
  let maxRegion = '';
  for (const p of prices) {
    for (const s of FCAS_SERVICES) {
      const v = p[s.key] ?? 0;
      if (v > maxPrice) {
        maxPrice = v;
        maxService = s.label;
        maxRegion = NEM_REGIONS.find(r => r.value === p.regionId)?.label || p.regionId;
      }
    }
  }

  // Average energy price
  const avgRrp = prices.reduce((sum, p) => sum + (p.rrp || 0), 0) / prices.length;

  kpiRow.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">Avg Energy Price</span>
      <span class="kpi-value" style="color:#d4254e">$${avgRrp.toFixed(2)}/MWh</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Highest FCAS</span>
      <span class="kpi-value" style="color:#3379bf">$${maxPrice.toFixed(2)}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Service</span>
      <span class="kpi-value" style="color:#6C3078">${maxService} (${maxRegion})</span>
    </div>
  `;
}

const fetchElecSummary = (signal) => nemApi.getElecSummary(signal);

export function renderFcasPrices(container, cleanupFns) {
  container.innerHTML = `
    <div class="page-header"><h2>FCAS Prices (NEM)</h2></div>
    <div class="kpi-row"></div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));

  const render = () => {
    const state = nemElecSummary.get();
    if (!state.data || !state.data.prices) return;

    const prices = state.data.prices;
    if (prices.length === 0) return;

    const option = buildOption(prices);
    ctrl.setOption(option);
    updateKpi(container, prices);
  };

  const unsub = nemElecSummary.listen(render);
  fetchIfStale(nemElecSummary, fetchElecSummary, NEM_FRESHNESS);
  render();

  const unregPoll = registerPoll('nem:elecSummary', nemElecSummary, fetchElecSummary, NEM_FRESHNESS);

  cleanupFns.push(() => {
    unsub();
    unregPoll();
    ctrl.dispose();
  });
}
