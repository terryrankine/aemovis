/**
 * WA Dispatch — Stacked area chart showing WA generation by fuel type
 * over 2 days (96 x 30-min intervals) with price line overlay.
 *
 * Data sources:
 *   - facility-intervals-last96.csv (joined with facility-meta-fuelmix.csv)
 *   - pulse.csv price overlay from wemPulse atom
 */
import wemApi from '../api/WemApi.js';
import { buildDispatchStack } from '../api/wemTransform.js';
import { normalisePulse } from '../api/wemTransform.js';
import { wemIntervals96, wemFacilityMeta, wemPulse } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { WEM_FRESHNESS, STATIC_FRESHNESS, FUEL_ORDER } from '../api/config.js';
import { fuel as fuelColors } from '../theme/colors.js';
import { ChartController } from '../charts/ChartController.js';

/**
 * Build ECharts option for the stacked area + price overlay.
 * Exported for testing.
 */
export function buildOption(stack, priceSeries) {
  const { periods, seriesByFuel } = stack;

  // Order fuels: FUEL_ORDER first, then alphabetical extras, 'Other' last
  const fuels = Object.keys(seriesByFuel);
  const ordered = FUEL_ORDER.filter(f => fuels.includes(f));
  const extra = fuels.filter(f => !ordered.includes(f) && f !== 'Other').sort();
  if (fuels.includes('Other')) extra.push('Other');
  const fuelOrder = [...ordered, ...extra];

  const series = fuelOrder.map(fuel => ({
    name: fuel,
    type: 'line',
    stack: 'generation',
    areaStyle: { opacity: 0.85 },
    symbol: 'none',
    lineStyle: { width: 0.5 },
    emphasis: { focus: 'series' },
    data: periods.map((p, i) => [p, seriesByFuel[fuel][i]]),
    itemStyle: { color: fuelColors[fuel] || '#6b778c' },
  }));

  // Price overlay on secondary y-axis
  if (priceSeries && priceSeries.length > 0) {
    series.push({
      name: 'Price',
      type: 'line',
      yAxisIndex: 1,
      symbol: 'none',
      lineStyle: { color: '#d4254e', width: 2 },
      itemStyle: { color: '#d4254e' },
      data: priceSeries.map(p => [p.settlementDate, p.rrp]),
      z: 10,
    });
  }

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      type: 'scroll',
      top: 0,
      textStyle: { fontSize: 11 },
    },
    grid: { left: 70, right: 70, bottom: 50, top: 60 },
    xAxis: {
      type: 'time',
      axisLabel: { fontSize: 10 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'MW',
        position: 'left',
        nameTextStyle: { color: '#333842' },
        axisLabel: { formatter: '{value}' },
      },
      {
        type: 'value',
        name: '$/MWh',
        position: 'right',
        nameTextStyle: { color: '#d4254e' },
        splitLine: { show: false },
        axisLabel: { formatter: '${value}' },
      },
    ],
    series,
  };
}

function updateKpi(container, stack, priceSeries) {
  const kpiRow = container.querySelector('.kpi-row');
  if (!kpiRow) return;

  const { totalByPeriod } = stack;
  if (totalByPeriod.length === 0) {
    kpiRow.innerHTML = '';
    return;
  }

  const currentGen = Math.round(totalByPeriod[totalByPeriod.length - 1]);
  const peakGen = Math.round(Math.max(...totalByPeriod));

  // Current price from pulse data (latest with a price)
  let currentPrice = null;
  if (priceSeries && priceSeries.length > 0) {
    const withPrice = priceSeries.filter(p => p.rrp != null);
    if (withPrice.length > 0) {
      currentPrice = withPrice[withPrice.length - 1].rrp;
    }
  }

  const priceHtml = currentPrice != null
    ? `<div class="kpi">
        <span class="kpi-label">Current Price</span>
        <span class="kpi-value" style="color:#d4254e">$${Number(currentPrice).toFixed(2)}/MWh</span>
      </div>`
    : '';

  kpiRow.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">Current Generation</span>
      <span class="kpi-value" style="color:#34b9b3">${currentGen.toLocaleString()} MW</span>
    </div>
    ${priceHtml}
    <div class="kpi">
      <span class="kpi-label">Peak Generation (2d)</span>
      <span class="kpi-value" style="color:#3379bf">${peakGen.toLocaleString()} MW</span>
    </div>
  `;
}

const fetchIntervals96 = (signal) => wemApi.getIntervals96(signal);
const fetchFacilityMeta = (signal) => wemApi.getFacilityMeta(signal);
const fetchPulse = (signal) => wemApi.getPulse(signal);

export function renderWaDispatch(container, cleanupFns) {
  container.innerHTML = `
    <div class="page-header"><h2>WA Dispatch</h2></div>
    <div class="kpi-row"></div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));

  const render = () => {
    const intState = wemIntervals96.get();
    const metaState = wemFacilityMeta.get();
    if (!intState.data || !metaState.data) return;

    const stack = buildDispatchStack(intState.data, metaState.data);
    if (stack.periods.length === 0) return;

    // Price overlay is optional — render chart even without it
    const pulseState = wemPulse.get();
    let priceSeries = null;
    if (pulseState.data) {
      const pulse = normalisePulse(pulseState.data);
      priceSeries = pulse.timeSeries;
    }

    const option = buildOption(stack, priceSeries);
    ctrl.setOption(option);
    updateKpi(container, stack, priceSeries);
  };

  const unsubInt = wemIntervals96.listen(render);
  const unsubMeta = wemFacilityMeta.listen(render);
  const unsubPulse = wemPulse.listen(render);

  fetchIfStale(wemIntervals96, fetchIntervals96, WEM_FRESHNESS);
  fetchIfStale(wemFacilityMeta, fetchFacilityMeta, STATIC_FRESHNESS);
  fetchIfStale(wemPulse, fetchPulse, WEM_FRESHNESS);
  render();

  const unregInt = registerPoll('wem:intervals96', wemIntervals96, fetchIntervals96, WEM_FRESHNESS);
  const unregMeta = registerPoll('wem:facilityMeta', wemFacilityMeta, fetchFacilityMeta, STATIC_FRESHNESS);
  const unregPulse = registerPoll('wem:pulse', wemPulse, fetchPulse, WEM_FRESHNESS);

  cleanupFns.push(() => {
    unsubInt();
    unsubMeta();
    unsubPulse();
    unregInt();
    unregMeta();
    unregPulse();
    ctrl.dispose();
  });
}
