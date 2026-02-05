/**
 * WA Reserves & Forecast — Spinning reserve, LFAS requirements,
 * and forecast vs actual generation in the WEM.
 *
 * Data source: pulse.csv (already fetched for other WEM pages)
 * Uses fields: RTD_TOTAL_SPINNING_RESERVE, LFAS_UP_REQUIREMENT_MW,
 *              FORECAST_EOI_MW, ACTUAL_TOTAL_GENERATION, FORECAST_NSG_MW, ACTUAL_NSG_MW
 */
import wemApi from '../api/WemApi.js';
import { wemPulse } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { WEM_FRESHNESS } from '../api/config.js';
import { ChartController } from '../charts/ChartController.js';

function getVal(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null) return row[k];
  }
  return null;
}

/** Normalise pulse rows into reserves + forecast data */
export function normaliseReserves(pulseRows) {
  if (!pulseRows || pulseRows.length === 0) return [];

  return pulseRows
    .filter(row => {
      const time = getVal(row, 'TRADING_DAY_INTERVAL', 'Trading_Interval', 'PERIOD');
      return time != null;
    })
    .map(row => ({
      time: getVal(row, 'TRADING_DAY_INTERVAL', 'Trading_Interval', 'PERIOD'),
      spinningReserve: getVal(row, 'RTD_TOTAL_SPINNING_RESERVE') ?? 0,
      lfasUp: getVal(row, 'LFAS_UP_REQUIREMENT_MW') ?? 0,
      forecastDemand: getVal(row, 'FORECAST_EOI_MW', 'FORECAST_MW') ?? null,
      actualGen: getVal(row, 'ACTUAL_TOTAL_GENERATION', 'TOTAL_GENERATION') ?? null,
      forecastNsg: getVal(row, 'FORECAST_NSG_MW') ?? null,
      actualNsg: getVal(row, 'ACTUAL_NSG_MW') ?? null,
      rtdGen: getVal(row, 'RTD_TOTAL_GENERATION') ?? null,
    }))
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

export function buildOption(rows) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, type: 'scroll', textStyle: { fontSize: 11 } },
    grid: { left: 70, right: 70, bottom: 50, top: 60 },
    xAxis: { type: 'time', axisLabel: { fontSize: 10 } },
    yAxis: [
      { type: 'value', name: 'MW', position: 'left', nameTextStyle: { color: '#333842' } },
      { type: 'value', name: 'MW (Reserve)', position: 'right', nameTextStyle: { color: '#5666bc' }, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'Forecast Demand',
        type: 'line',
        symbol: 'none',
        lineStyle: { color: '#3379bf', width: 2, type: 'dashed' },
        itemStyle: { color: '#3379bf' },
        data: rows.filter(r => r.forecastDemand != null).map(r => [r.time, r.forecastDemand]),
      },
      {
        name: 'Actual Generation',
        type: 'line',
        symbol: 'none',
        lineStyle: { color: '#34b9b3', width: 2 },
        itemStyle: { color: '#34b9b3' },
        data: rows.filter(r => r.actualGen != null).map(r => [r.time, r.actualGen]),
      },
      {
        name: 'RTD Generation',
        type: 'line',
        symbol: 'none',
        lineStyle: { color: '#467822', width: 1.5 },
        itemStyle: { color: '#467822' },
        data: rows.filter(r => r.rtdGen != null).map(r => [r.time, r.rtdGen]),
      },
      {
        name: 'LFAS Up Requirement',
        type: 'line',
        yAxisIndex: 1,
        symbol: 'none',
        lineStyle: { color: '#5666bc', width: 2 },
        itemStyle: { color: '#5666bc' },
        areaStyle: { color: 'rgba(86,102,188,0.15)' },
        data: rows.map(r => [r.time, r.lfasUp]),
      },
      {
        name: 'Spinning Reserve',
        type: 'line',
        yAxisIndex: 1,
        symbol: 'none',
        lineStyle: { color: '#d4254e', width: 2 },
        itemStyle: { color: '#d4254e' },
        data: rows.map(r => [r.time, r.spinningReserve]),
      },
    ],
  };
}

function updateKpi(container, rows) {
  const kpiRow = container.querySelector('.kpi-row');
  if (!kpiRow || rows.length === 0) return;

  const latest = rows[rows.length - 1];

  // Find latest row with actual gen
  const withActual = rows.filter(r => r.actualGen != null);
  const latestActual = withActual.length > 0 ? withActual[withActual.length - 1] : null;

  // Forecast accuracy: how close was forecast to actual?
  let accuracy = null;
  if (latestActual && latestActual.forecastDemand != null && latestActual.actualGen != null) {
    const err = Math.abs(latestActual.forecastDemand - latestActual.actualGen);
    accuracy = ((1 - err / latestActual.forecastDemand) * 100).toFixed(1);
  }

  kpiRow.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">LFAS Up Req</span>
      <span class="kpi-value" style="color:#5666bc">${Math.round(latest.lfasUp)} MW</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Spinning Reserve</span>
      <span class="kpi-value" style="color:#d4254e">${Math.round(latest.spinningReserve)} MW</span>
    </div>
    ${latestActual ? `<div class="kpi">
      <span class="kpi-label">Actual Gen</span>
      <span class="kpi-value" style="color:#34b9b3">${Math.round(latestActual.actualGen).toLocaleString()} MW</span>
    </div>` : ''}
    ${accuracy != null ? `<div class="kpi">
      <span class="kpi-label">Forecast Accuracy</span>
      <span class="kpi-value" style="color:#467822">${accuracy}%</span>
    </div>` : ''}
  `;
}

const fetchPulse = (signal) => wemApi.getPulse(signal);

export function renderWaReserves(container, cleanupFns) {
  container.innerHTML = `
    <div class="page-header"><h2>WA Reserves & Forecast</h2></div>
    <div class="kpi-row"></div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));

  const render = () => {
    const state = wemPulse.get();
    if (!state.data) return;

    const rows = normaliseReserves(state.data);
    if (rows.length === 0) return;

    const option = buildOption(rows);
    ctrl.setOption(option);
    updateKpi(container, rows);
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
