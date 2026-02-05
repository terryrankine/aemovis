/**
 * WEM Outages — stacked bar chart of planned/forced/consequential outages
 * over time, plus a donut showing current breakdown.
 *
 * Data source: pulse.csv (TOTAL_OUTAGE_MW, PLANNED_OUTAGE_MW,
 *              FORCED_OUTAGE_MW, CONS_OUTAGE_MW columns)
 */
import wemApi from '../api/WemApi.js';
import { normalisePulse } from '../api/wemTransform.js';
import { outageColors } from '../theme/colors.js';
import { wemPulse } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { WEM_FRESHNESS } from '../api/config.js';
import { ChartController } from '../charts/ChartController.js';

function buildBarOption(outages) {
  const times = outages.map(o => o.time);

  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 60, right: 30, bottom: 50, top: 50 },
    xAxis: { type: 'category', data: times, axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', name: 'MW' },
    series: [
      {
        name: 'Planned', type: 'bar', stack: 'outages',
        data: outages.map(o => o.planned),
        itemStyle: { color: outageColors.planned },
      },
      {
        name: 'Forced', type: 'bar', stack: 'outages',
        data: outages.map(o => o.forced),
        itemStyle: { color: outageColors.forced },
      },
      {
        name: 'Consequential', type: 'bar', stack: 'outages',
        data: outages.map(o => o.consequential),
        itemStyle: { color: outageColors.consequential },
      },
    ],
  };
}

function buildDonutOption(latest) {
  if (!latest) return null;
  const total = (latest.planned || 0) + (latest.forced || 0) + (latest.consequential || 0);

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} MW ({d}%)' },
    legend: { bottom: 10 },
    title: {
      text: `${Math.round(total).toLocaleString()} MW`,
      subtext: 'Total Outages',
      left: 'center', top: 'center',
      textStyle: { fontSize: 20, fontWeight: 700, color: '#333842' },
      subtextStyle: { fontSize: 11, color: '#545d6e' },
    },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['50%', '45%'],
      label: { formatter: '{b}\n{d}%', fontSize: 11 },
      data: [
        { name: 'Planned', value: Math.round(latest.planned || 0), itemStyle: { color: outageColors.planned } },
        { name: 'Forced', value: Math.round(latest.forced || 0), itemStyle: { color: outageColors.forced } },
        { name: 'Consequential', value: Math.round(latest.consequential || 0), itemStyle: { color: outageColors.consequential } },
      ],
    }],
  };
}

const fetchPulse = (signal) => wemApi.getPulse(signal);

export function renderWemOutages(container, cleanupFns) {
  container.innerHTML = `
    <div class="page-header"><h2>WEM Outages</h2></div>
    <div class="outage-grid">
      <div class="chart-box" id="outage-bar"></div>
      <div class="chart-box" id="outage-donut"></div>
    </div>
  `;

  const barCtrl = new ChartController(container.querySelector('#outage-bar'));
  const donutCtrl = new ChartController(container.querySelector('#outage-donut'));

  const render = () => {
    const state = wemPulse.get();
    if (!state.data) return;

    const { outages } = normalisePulse(state.data);
    if (outages.length === 0) return;

    // Check if any outage values are non-zero
    const hasOutages = outages.some(o => o.planned > 0 || o.forced > 0 || o.consequential > 0);

    if (!hasOutages) {
      const barEl = container.querySelector('#outage-bar');
      const donutEl = container.querySelector('#outage-donut');
      if (barEl) barEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6b778c;font-size:1.1rem;">No outages currently reported in WEM</div>';
      if (donutEl) donutEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;color:#6b778c;"><div style="font-size:2rem;font-weight:700;color:#467822;">0 MW</div><div style="font-size:0.9rem;margin-top:0.25rem;">Total Outages</div></div>';
      return;
    }

    const barOption = buildBarOption(outages);
    barCtrl.setOption(barOption);

    const donutOption = buildDonutOption(outages[outages.length - 1]);
    if (donutOption) donutCtrl.setOption(donutOption);
  };

  const unsub = wemPulse.listen(render);
  fetchIfStale(wemPulse, fetchPulse, WEM_FRESHNESS);
  render();

  const unregPoll = registerPoll('wem:pulse', wemPulse, fetchPulse, WEM_FRESHNESS);

  cleanupFns.push(() => {
    unsub();
    unregPoll();
    barCtrl.dispose();
    donutCtrl.dispose();
  });
}
