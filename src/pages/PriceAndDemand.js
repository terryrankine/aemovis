import nemApi from '../api/NemApi.js';
import wemApi from '../api/WemApi.js';
import { ALL_REGIONS, TIMESCALES, NEM_FRESHNESS, WEM_FRESHNESS } from '../api/config.js';
import { regionColors } from '../theme/colors.js';
import { nemPriceAndDemand30, nemPriceAndDemand5, nemMarketPriceLimits, wemPulse } from '../store/atoms.js';
import { normalisePulse } from '../api/wemTransform.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { ChartController } from '../charts/ChartController.js';

function buildOption(items, region, limits) {
  const regionData = items.filter(d => d.regionId === region);
  const actuals    = regionData.filter(d => d.periodType === 'ACTUAL');
  const forecasts  = regionData.filter(d => d.periodType !== 'ACTUAL');
  const apc = limits?.AdministeredPriceCap ?? 600;

  const hasForecastPrice = forecasts.some(d => d.rrp != null);
  const hasForecastDemand = forecasts.some(d => d.totalDemand != null);

  const legendData = ['Price (actual)'];
  if (hasForecastPrice) legendData.push('Price (forecast)');
  legendData.push('Demand (actual)');
  if (hasForecastDemand) legendData.push('Demand (forecast)');

  const series = [
    {
      name: 'Price (actual)', type: 'line', yAxisIndex: 0, symbol: 'none',
      data: actuals.map(d => [d.settlementDate, d.rrp]),
      lineStyle: { color: '#d4254e', width: 2 }, itemStyle: { color: '#d4254e' },
    },
    {
      name: 'Demand (actual)', type: 'line', yAxisIndex: 1, symbol: 'none',
      data: actuals.map(d => [d.settlementDate, d.totalDemand]),
      lineStyle: { color: '#3379bf', width: 2 }, itemStyle: { color: '#3379bf' },
      areaStyle: { color: 'rgba(51,121,191,0.15)' },
    },
  ];

  if (hasForecastPrice) {
    series.push({
      name: 'Price (forecast)', type: 'line', yAxisIndex: 0, symbol: 'none',
      data: forecasts.map(d => [d.settlementDate, d.rrp]),
      lineStyle: { color: '#d4254e', width: 2, type: 'dashed' }, itemStyle: { color: '#d4254e' },
    });
  }

  if (hasForecastDemand) {
    series.push({
      name: 'Demand (forecast)', type: 'line', yAxisIndex: 1, symbol: 'none',
      data: forecasts.map(d => [d.settlementDate, d.totalDemand]),
      lineStyle: { color: '#3379bf', width: 2, type: 'dashed' }, itemStyle: { color: '#3379bf' },
      areaStyle: { color: 'rgba(51,121,191,0.08)' },
    });
  }

  // APC line (NEM only)
  if (limits) {
    series.push({
      name: 'APC', type: 'line', data: [],
      markLine: {
        silent: true,
        data: [{ yAxis: apc }],
        lineStyle: { color: '#6b778c', type: 'dotted' },
        label: { formatter: `APC $${apc}`, position: 'insideEndTop' },
      },
    });
  }

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: legendData, top: 0 },
    grid: { left: 70, right: 70, bottom: 50, top: 60 },
    xAxis: { type: 'time', axisLabel: { formatter: '{dd} {MMM}\n{HH}:{mm}' } },
    yAxis: [
      { type: 'value', name: '$/MWh', position: 'left',  nameTextStyle: { color: '#d4254e' } },
      { type: 'value', name: 'MW',    position: 'right', nameTextStyle: { color: '#3379bf' } },
    ],
    series,
    _kpi: {
      price: actuals.at(-1)?.rrp, demand: actuals.at(-1)?.totalDemand,
      forecastPrice: hasForecastPrice ? forecasts[0]?.rrp : null,
      forecastDemand: hasForecastDemand ? forecasts[0]?.totalDemand : null,
      apcActive: (actuals.at(-1)?.apcFlag ?? 0) !== 0,
      isWem: region === 'WA1',
    },
  };
}

/** Compare mode: overlay multiple regions on one chart */
function buildOptionCompare(allItems, regions, limits) {
  const series = [];
  const legendData = [];

  for (const regionId of regions) {
    const regionData = allItems.filter(d => d.regionId === regionId);
    const actuals = regionData.filter(d => d.periodType === 'ACTUAL');
    const forecasts = regionData.filter(d => d.periodType !== 'ACTUAL');
    const color = regionColors[regionId] || '#6b778c';
    const label = ALL_REGIONS.find(r => r.value === regionId)?.label ?? regionId;

    legendData.push(`${label} Price`, `${label} Demand`);
    series.push({
      name: `${label} Price`, type: 'line', yAxisIndex: 0, symbol: 'none',
      data: actuals.map(d => [d.settlementDate, d.rrp]),
      lineStyle: { color, width: 2 }, itemStyle: { color },
    });
    series.push({
      name: `${label} Demand`, type: 'line', yAxisIndex: 1, symbol: 'none',
      data: actuals.map(d => [d.settlementDate, d.totalDemand]),
      lineStyle: { color, width: 1, type: 'dashed' }, itemStyle: { color },
    });

    const hasFP = forecasts.some(d => d.rrp != null);
    const hasFD = forecasts.some(d => d.totalDemand != null);
    if (hasFP) {
      legendData.push(`${label} Price (f)`);
      series.push({
        name: `${label} Price (f)`, type: 'line', yAxisIndex: 0, symbol: 'none',
        data: forecasts.map(d => [d.settlementDate, d.rrp]),
        lineStyle: { color, width: 1, type: 'dotted' }, itemStyle: { color },
      });
    }
    if (hasFD) {
      legendData.push(`${label} Demand (f)`);
      series.push({
        name: `${label} Demand (f)`, type: 'line', yAxisIndex: 1, symbol: 'none',
        data: forecasts.map(d => [d.settlementDate, d.totalDemand]),
        lineStyle: { color, width: 1, type: 'dotted' }, itemStyle: { color },
      });
    }
  }

  // APC line if NEM regions included
  const apc = limits?.AdministeredPriceCap ?? 600;
  if (limits && regions.some(r => r !== 'WA1')) {
    series.push({
      name: 'APC', type: 'line', data: [],
      markLine: {
        silent: true,
        data: [{ yAxis: apc }],
        lineStyle: { color: '#6b778c', type: 'dotted' },
        label: { formatter: `APC $${apc}`, position: 'insideEndTop' },
      },
    });
  }

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: legendData, top: 0 },
    grid: { left: 70, right: 70, bottom: 50, top: 60 },
    xAxis: { type: 'time', axisLabel: { formatter: '{dd} {MMM}\n{HH}:{mm}' } },
    yAxis: [
      { type: 'value', name: '$/MWh', position: 'left' },
      { type: 'value', name: 'MW', position: 'right' },
    ],
    series,
  };
}

function updateKpi(container, kpi) {
  const kpiRow = container.querySelector('.kpi-row');
  if (!kpiRow || !kpi) return;
  const fmtPrice = (v) => v != null ? `$${Number(v).toFixed(2)}` : 'N/A';
  const fmtDemand = (v) => v != null ? Number(v).toLocaleString() : 'N/A';

  let html = `
    <div class="kpi"><span class="kpi-label">Spot Price ($/MWh)</span><span class="kpi-value" style="color:#d4254e">${fmtPrice(kpi.price)}</span></div>
    <div class="kpi"><span class="kpi-label">Demand (MW)</span><span class="kpi-value" style="color:#3379bf">${fmtDemand(kpi.demand)}</span></div>
  `;

  if (kpi.forecastPrice != null) {
    html += `<div class="kpi"><span class="kpi-label">Forecast Price</span><span class="kpi-value" style="color:#dd4e70">${fmtPrice(kpi.forecastPrice)}</span></div>`;
  }
  if (kpi.forecastDemand != null) {
    html += `<div class="kpi"><span class="kpi-label">Forecast Demand</span><span class="kpi-value" style="color:#5493d1">${fmtDemand(kpi.forecastDemand)}</span></div>`;
  }
  if (!kpi.isWem) {
    html += `<div class="kpi"><span class="kpi-label">APC Status</span><span class="kpi-value">${kpi.apcActive ? 'ACTIVE' : 'INACTIVE'}</span></div>`;
  }

  kpiRow.innerHTML = html;

  // Info banner for WEM
  let banner = container.querySelector('.info-banner');
  if (kpi.isWem) {
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'info-banner';
      banner.textContent = 'WEM provides ~4 days of actual data. Forecast prices are not available for WA.';
      kpiRow.insertAdjacentElement('afterend', banner);
    }
  } else if (banner) {
    banner.remove();
  }
}

function getAtomForTimescale(ts) {
  return ts === '5MIN' ? nemPriceAndDemand5 : nemPriceAndDemand30;
}

function makeFetchFn(ts) {
  return (signal) => nemApi.getPriceAndDemand(ts, signal);
}

const isWem = (region) => region === 'WA1';

// Exported for unit testing
export { buildOptionCompare as _buildOptionCompare };

export function renderPriceAndDemand(container, cleanupFns) {
  let region = ALL_REGIONS[0].value;
  let timescale = TIMESCALES[0].value;
  let comparing = false;
  let selectedRegions = new Set();

  container.innerHTML = `
    <div class="page-header">
      <h2>Price and Demand</h2>
      <div class="region-tabs">${ALL_REGIONS.map(r => `<button class="region-btn ${r.value === region ? 'active' : ''}" data-region="${r.value}">${r.label}</button>`).join('')}<button class="compare-btn">Compare</button></div>
      <div class="controls">
        <select id="timescale-select">${TIMESCALES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}</select>
      </div>
    </div>
    <div class="kpi-row"></div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));
  const tsSelect = container.querySelector('#timescale-select');
  const compareBtn = container.querySelector('.compare-btn');

  const updateButtons = () => {
    container.querySelectorAll('.region-btn').forEach(b => {
      b.classList.toggle('active', comparing
        ? selectedRegions.has(b.dataset.region)
        : b.dataset.region === region);
    });
    const showTs = comparing
      ? [...selectedRegions].some(r => !isWem(r))
      : !isWem(region);
    tsSelect.style.display = showTs ? '' : 'none';
  };

  const render = () => {
    if (comparing) {
      const regions = [...selectedRegions];
      const nemAtom = getAtomForTimescale(timescale);
      const nemState = nemAtom.get();
      const wemState = wemPulse.get();
      const limitsState = nemMarketPriceLimits.get();

      let allItems = [];
      if (nemState.data) allItems.push(...nemState.data.items);
      if (wemState.data) {
        const { timeSeries } = normalisePulse(wemState.data);
        allItems.push(...timeSeries);
      }

      if (allItems.length) {
        const option = buildOptionCompare(allItems, regions, limitsState.data);
        ctrl.setOption(option);
      }

      // Hide single-region KPIs in compare mode
      container.querySelector('.kpi-row').innerHTML = '';

      // Info banner if WA is among selected
      let banner = container.querySelector('.info-banner');
      if (selectedRegions.has('WA1')) {
        if (!banner) {
          banner = document.createElement('div');
          banner.className = 'info-banner';
          banner.textContent = 'WEM provides ~4 days of actual data. Forecast prices are not available for WA.';
          container.querySelector('.kpi-row').insertAdjacentElement('afterend', banner);
        }
      } else if (banner) {
        banner.remove();
      }
    } else {
      if (isWem(region)) {
        const wemState = wemPulse.get();
        if (wemState.data) {
          const { timeSeries } = normalisePulse(wemState.data);
          const option = buildOption(timeSeries, 'WA1', null);
          ctrl.setOption(option);
          updateKpi(container, option._kpi);
        }
      } else {
        const atom = getAtomForTimescale(timescale);
        const state = atom.get();
        const limitsState = nemMarketPriceLimits.get();
        if (state.data) {
          const option = buildOption(state.data.items, region, limitsState.data);
          ctrl.setOption(option);
          updateKpi(container, option._kpi);
        }
      }
    }
  };

  // Subscribe to all relevant atoms
  const unsub30 = nemPriceAndDemand30.listen(render);
  const unsub5 = nemPriceAndDemand5.listen(render);
  const unsubLimits = nemMarketPriceLimits.listen(render);
  const unsubWem = wemPulse.listen(render);

  // Initial fetches (skipped if data is still fresh from another tab)
  fetchIfStale(nemMarketPriceLimits, (s) => nemApi.getMarketPriceLimits(s), NEM_FRESHNESS);
  fetchIfStale(getAtomForTimescale(timescale), makeFetchFn(timescale), NEM_FRESHNESS);
  fetchIfStale(wemPulse, (s) => wemApi.getPulse(s), WEM_FRESHNESS);
  render();

  // Register for polling
  const unregPoll30 = registerPoll('nem:priceAndDemand:30', nemPriceAndDemand30, makeFetchFn('30MIN'), NEM_FRESHNESS);
  const unregPoll5 = registerPoll('nem:priceAndDemand:5', nemPriceAndDemand5, makeFetchFn('5MIN'), NEM_FRESHNESS);
  const unregPollLimits = registerPoll('nem:marketPriceLimits', nemMarketPriceLimits, (s) => nemApi.getMarketPriceLimits(s), NEM_FRESHNESS);
  const unregPollWem = registerPoll('wem:pulse', wemPulse, (s) => wemApi.getPulse(s), WEM_FRESHNESS);

  // Region buttons
  container.querySelectorAll('.region-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.region;
      if (comparing) {
        if (selectedRegions.has(r)) {
          if (selectedRegions.size > 1) selectedRegions.delete(r);
        } else {
          selectedRegions.add(r);
        }
      } else {
        region = r;
        ctrl.dispose();
        ctrl._el = container.querySelector('.chart-box');
        ctrl._chart = null;
      }
      updateButtons();
      render();
    });
  });

  // Compare toggle
  compareBtn.addEventListener('click', () => {
    comparing = !comparing;
    compareBtn.classList.toggle('active', comparing);
    compareBtn.textContent = comparing ? 'Exit Compare' : 'Compare';
    if (comparing) {
      selectedRegions = new Set([region]);
    } else {
      region = selectedRegions.values().next().value;
      selectedRegions.clear();
    }
    ctrl.dispose();
    ctrl._el = container.querySelector('.chart-box');
    ctrl._chart = null;
    updateButtons();
    render();
  });

  // Timescale select
  tsSelect.addEventListener('change', e => {
    timescale = e.target.value;
    fetchIfStale(getAtomForTimescale(timescale), makeFetchFn(timescale), NEM_FRESHNESS);
    render();
  });

  cleanupFns.push(() => {
    unsub30();
    unsub5();
    unsubLimits();
    unsubWem();
    unregPoll30();
    unregPoll5();
    unregPollLimits();
    unregPollWem();
    ctrl.dispose();
  });
}
