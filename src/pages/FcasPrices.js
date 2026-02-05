/**
 * NEM FCAS Prices — Frequency Control Ancillary Services pricing
 * across all NEM regions.
 *
 * Visualized as a heatmap: regions on Y-axis, FCAS services on X-axis,
 * color intensity represents price.
 *
 * Data source: elecSummary.prices (already fetched for Dispatch Overview)
 * Shows current snapshot of all 10 FCAS service prices per region.
 */
import nemApi from '../api/NemApi.js';
import { NEM_REGIONS, NEM_FRESHNESS } from '../api/config.js';
import { nemElecSummary } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { ChartController } from '../charts/ChartController.js';

const FCAS_SERVICES = [
  { key: 'raise1SecRrp',   label: 'Raise 1s' },
  { key: 'raise6SecRrp',   label: 'Raise 6s' },
  { key: 'raise60SecRrp',  label: 'Raise 60s' },
  { key: 'raise5MinRrp',   label: 'Raise 5m' },
  { key: 'raiseRegRrp',    label: 'Raise Reg' },
  { key: 'lower1SecRrp',   label: 'Lower 1s' },
  { key: 'lower6SecRrp',   label: 'Lower 6s' },
  { key: 'lower60SecRrp',  label: 'Lower 60s' },
  { key: 'lower5MinRrp',   label: 'Lower 5m' },
  { key: 'lowerRegRrp',    label: 'Lower Reg' },
];

export function buildOption(prices) {
  // Y-axis: regions (short labels)
  const regionLabels = prices.map(p => {
    const region = NEM_REGIONS.find(r => r.value === p.regionId);
    return region?.label || p.regionId.replace('1', '');
  });

  // X-axis: FCAS services
  const serviceLabels = FCAS_SERVICES.map(s => s.label);

  // Build heatmap data: [xIndex, yIndex, value]
  const data = [];
  let maxPrice = 0;
  for (let yIdx = 0; yIdx < prices.length; yIdx++) {
    const p = prices[yIdx];
    for (let xIdx = 0; xIdx < FCAS_SERVICES.length; xIdx++) {
      const value = p[FCAS_SERVICES[xIdx].key] ?? 0;
      data.push([xIdx, yIdx, value]);
      if (value > maxPrice) maxPrice = value;
    }
  }

  return {
    tooltip: {
      position: 'top',
      formatter: (params) => {
        const region = regionLabels[params.value[1]];
        const service = serviceLabels[params.value[0]];
        const price = params.value[2];
        return `<b>${region}</b> — ${service}<br/>$${Number(price).toFixed(2)}/MWh`;
      },
    },
    grid: { left: 80, right: 80, bottom: 80, top: 40 },
    xAxis: {
      type: 'category',
      data: serviceLabels,
      splitArea: { show: true },
      axisLabel: { rotate: 45, fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: regionLabels,
      splitArea: { show: true },
      axisLabel: { fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max: Math.max(maxPrice, 10),
      calculable: true,
      orient: 'vertical',
      right: 10,
      top: 'center',
      inRange: {
        color: ['#f7fbff', '#deebf7', '#9ecae1', '#3182bd', '#08519c'],
      },
      formatter: (val) => `$${val.toFixed(0)}`,
    },
    series: [{
      name: 'FCAS Price',
      type: 'heatmap',
      data,
      label: {
        show: true,
        formatter: (params) => {
          const v = params.value[2];
          return v >= 1 ? `$${v.toFixed(0)}` : v > 0 ? `$${v.toFixed(2)}` : '';
        },
        fontSize: 10,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    }],
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

  // Total FCAS cost (sum of all services across all regions)
  let totalFcas = 0;
  for (const p of prices) {
    for (const s of FCAS_SERVICES) {
      totalFcas += p[s.key] ?? 0;
    }
  }
  const avgFcas = totalFcas / (prices.length * FCAS_SERVICES.length);

  kpiRow.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">Avg Energy Price</span>
      <span class="kpi-value" style="color:#d4254e">$${avgRrp.toFixed(2)}/MWh</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Avg FCAS Price</span>
      <span class="kpi-value" style="color:#08519c">$${avgFcas.toFixed(2)}/MWh</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Highest FCAS</span>
      <span class="kpi-value" style="color:#3182bd">$${maxPrice.toFixed(2)}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Peak Service</span>
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
