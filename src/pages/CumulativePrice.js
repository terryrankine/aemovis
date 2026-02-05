import nemApi from '../api/NemApi.js';
import { NEM_REGIONS, NEM_FRESHNESS } from '../api/config.js';
import { regionColors } from '../theme/colors.js';
import { nemCumulativePrice, nemMarketPriceLimits } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { ChartController } from '../charts/ChartController.js';

function buildOption(items, limits) {
  const threshold = limits?.CumulativePriceThreshold ?? 1823600;

  const byRegion = {};
  for (const row of items) {
    const r = row.r;
    byRegion[r] ??= [];
    byRegion[r].push([row.dt, row.cp]);
  }

  const series = Object.entries(byRegion).map(([regionId, points]) => ({
    name: NEM_REGIONS.find(r => r.value === regionId)?.label ?? regionId,
    type: 'line',
    symbol: 'none',
    data: points,
    lineStyle: { width: 2, color: regionColors[regionId] },
    itemStyle: { color: regionColors[regionId] },
  }));

  series.push({
    name: 'CPT', type: 'line', data: [],
    markLine: {
      silent: true,
      data: [{ yAxis: threshold }],
      lineStyle: { color: '#d4254e', type: 'dashed', width: 2 },
      label: { formatter: `CPT $${threshold.toLocaleString()}`, position: 'insideEndTop', color: '#d4254e' },
    },
  });

  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 90, right: 30, bottom: 50, top: 50 },
    xAxis: { type: 'time', axisLabel: { formatter: '{dd} {MMM}\n{HH}:{mm}' } },
    yAxis: { type: 'value', name: 'Cumulative Price ($)', axisLabel: { formatter: (v) => `$${(v / 1000).toFixed(0)}k` } },
    series,
  };
}

export function renderCumulativePrice(container, cleanupFns) {
  container.innerHTML = `
    <div class="page-header"><h2>Cumulative Price</h2></div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));

  const render = () => {
    const cpState = nemCumulativePrice.get();
    const limitsState = nemMarketPriceLimits.get();
    if (cpState.data) {
      const option = buildOption(cpState.data.items, limitsState.data);
      ctrl.setOption(option);
    }
  };

  const unsubCp = nemCumulativePrice.listen(render);
  const unsubLimits = nemMarketPriceLimits.listen(render);
  fetchIfStale(nemCumulativePrice, (s) => nemApi.getCumulativePrice(s), NEM_FRESHNESS);
  fetchIfStale(nemMarketPriceLimits, (s) => nemApi.getMarketPriceLimits(s), NEM_FRESHNESS);
  render();

  const unregCp = registerPoll('nem:cumulativePrice', nemCumulativePrice, (s) => nemApi.getCumulativePrice(s), NEM_FRESHNESS);
  const unregLimits = registerPoll('nem:marketPriceLimits', nemMarketPriceLimits, (s) => nemApi.getMarketPriceLimits(s), NEM_FRESHNESS);

  cleanupFns.push(() => {
    unsubCp();
    unsubLimits();
    unregCp();
    unregLimits();
    ctrl.dispose();
  });
}
