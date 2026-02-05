/**
 * NEM Net Interchange — Import/export flows and generation breakdown
 * across NEM regions over time.
 *
 * Data source: priceAndDemand (already fetched for Price & Demand page)
 * Shows netInterchange, scheduledGeneration, semiScheduledGeneration per region.
 */
import nemApi from '../api/NemApi.js';
import { NEM_REGIONS, NEM_FRESHNESS } from '../api/config.js';
import { regionColors } from '../theme/colors.js';
import { nemPriceAndDemand30 } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { ChartController } from '../charts/ChartController.js';

export function buildOption(items, selectedRegions) {
  const filtered = items.filter(d =>
    selectedRegions.includes(d.regionId) && d.periodType === 'ACTUAL'
  );

  // Group by time, then region
  const timeSet = [...new Set(filtered.map(d => d.settlementDate))].sort();

  const series = [];
  for (const regionId of selectedRegions) {
    const regionLabel = NEM_REGIONS.find(r => r.value === regionId)?.label || regionId;
    const regionData = filtered.filter(d => d.regionId === regionId);
    const byTime = new Map(regionData.map(d => [d.settlementDate, d]));

    series.push({
      name: `${regionLabel} Net Interchange`,
      type: 'bar',
      stack: regionId,
      data: timeSet.map(t => [t, byTime.get(t)?.netInterchange ?? 0]),
      itemStyle: { color: regionColors[regionId] || '#6b778c' },
    });
  }

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: v => `${Number(v).toFixed(0)} MW`,
    },
    legend: { top: 0, type: 'scroll', textStyle: { fontSize: 11 } },
    grid: { left: 70, right: 30, bottom: 50, top: 60 },
    xAxis: {
      type: 'time',
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: 'MW',
      nameTextStyle: { color: '#333842' },
      axisLabel: { formatter: '{value}' },
    },
    visualMap: {
      show: false,
      pieces: [
        { lte: 0, color: '#d4254e' },  // importing = red
        { gt: 0, color: '#467822' },   // exporting = green
      ],
      dimension: 1,
      seriesIndex: series.map((_, i) => i),
    },
    series,
  };
}

/** Build gen breakdown option — scheduled vs semi-scheduled stacked area */
export function buildGenOption(items, selectedRegions) {
  const filtered = items.filter(d =>
    selectedRegions.includes(d.regionId) && d.periodType === 'ACTUAL'
  );

  const timeSet = [...new Set(filtered.map(d => d.settlementDate))].sort();
  const series = [];

  for (const regionId of selectedRegions) {
    const regionLabel = NEM_REGIONS.find(r => r.value === regionId)?.label || regionId;
    const regionData = filtered.filter(d => d.regionId === regionId);
    const byTime = new Map(regionData.map(d => [d.settlementDate, d]));

    series.push({
      name: `${regionLabel} Scheduled`,
      type: 'line',
      stack: `gen-${regionId}`,
      areaStyle: { opacity: 0.6 },
      symbol: 'none',
      lineStyle: { width: 0.5 },
      data: timeSet.map(t => [t, byTime.get(t)?.scheduledGeneration ?? 0]),
      itemStyle: { color: regionColors[regionId] || '#6b778c' },
    });

    series.push({
      name: `${regionLabel} Semi-scheduled`,
      type: 'line',
      stack: `gen-${regionId}`,
      areaStyle: { opacity: 0.4 },
      symbol: 'none',
      lineStyle: { width: 0.5, type: 'dashed' },
      data: timeSet.map(t => [t, byTime.get(t)?.semiScheduledGeneration ?? 0]),
      itemStyle: { color: regionColors[regionId] || '#6b778c', opacity: 0.7 },
    });
  }

  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: v => `${Number(v).toFixed(0)} MW`,
    },
    legend: { top: 0, type: 'scroll', textStyle: { fontSize: 11 } },
    grid: { left: 70, right: 30, bottom: 50, top: 60 },
    xAxis: { type: 'time', axisLabel: { fontSize: 10 } },
    yAxis: {
      type: 'value',
      name: 'MW',
      nameTextStyle: { color: '#333842' },
    },
    series,
  };
}

function updateKpi(container, items) {
  const kpiRow = container.querySelector('.kpi-row');
  if (!kpiRow || !items || items.length === 0) return;

  // Latest actual data per region
  const actuals = items.filter(d => d.periodType === 'ACTUAL');
  if (actuals.length === 0) return;

  const latestTime = actuals.reduce((max, d) => d.settlementDate > max ? d.settlementDate : max, '');
  const latest = actuals.filter(d => d.settlementDate === latestTime);

  const totalInterchange = latest.reduce((s, d) => s + (d.netInterchange || 0), 0);
  const totalScheduled = latest.reduce((s, d) => s + (d.scheduledGeneration || 0), 0);
  const totalSemiSched = latest.reduce((s, d) => s + (d.semiScheduledGeneration || 0), 0);

  kpiRow.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">Scheduled Gen</span>
      <span class="kpi-value" style="color:#333842">${Math.round(totalScheduled).toLocaleString()} MW</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Semi-scheduled Gen</span>
      <span class="kpi-value" style="color:#467822">${Math.round(totalSemiSched).toLocaleString()} MW</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Semi-sched %</span>
      <span class="kpi-value" style="color:#3379bf">${((totalSemiSched / (totalScheduled + totalSemiSched)) * 100).toFixed(1)}%</span>
    </div>
  `;
}

const fetchPriceAndDemand = (signal) => nemApi.getPriceAndDemand('30MIN', signal);

export function renderNetInterchange(container, cleanupFns) {
  let selectedRegions = NEM_REGIONS.map(r => r.value);
  let showGen = false;

  container.innerHTML = `
    <div class="page-header">
      <h2>Net Interchange (NEM)</h2>
      <div class="region-tabs">
        ${NEM_REGIONS.map(r => `<button class="region-btn active" data-region="${r.value}">${r.label}</button>`).join('')}
        <button class="compare-btn">Gen Breakdown</button>
      </div>
    </div>
    <div class="kpi-row"></div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));
  const genBtn = container.querySelector('.compare-btn');

  const render = () => {
    const state = nemPriceAndDemand30.get();
    if (!state.data || !state.data.items) return;

    const items = state.data.items;
    const option = showGen
      ? buildGenOption(items, selectedRegions)
      : buildOption(items, selectedRegions);
    ctrl.setOption(option);
    updateKpi(container, items);
  };

  container.querySelectorAll('.region-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.region;
      if (selectedRegions.includes(r)) {
        if (selectedRegions.length > 1) {
          selectedRegions = selectedRegions.filter(x => x !== r);
          btn.classList.remove('active');
        }
      } else {
        selectedRegions.push(r);
        btn.classList.add('active');
      }
      render();
    });
  });

  genBtn.addEventListener('click', () => {
    showGen = !showGen;
    genBtn.classList.toggle('active', showGen);
    genBtn.textContent = showGen ? 'Net Interchange' : 'Gen Breakdown';
    render();
  });

  const unsub = nemPriceAndDemand30.listen(render);
  fetchIfStale(nemPriceAndDemand30, fetchPriceAndDemand, NEM_FRESHNESS);
  render();

  const unregPoll = registerPoll('nem:priceAndDemand:30', nemPriceAndDemand30, fetchPriceAndDemand, NEM_FRESHNESS);

  cleanupFns.push(() => {
    unsub();
    unregPoll();
    ctrl.dispose();
  });
}
