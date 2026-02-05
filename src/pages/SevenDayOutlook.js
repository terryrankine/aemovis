import nemApi from '../api/NemApi.js';
import { NEM_REGIONS, NEM_FRESHNESS } from '../api/config.js';
import { regionColors } from '../theme/colors.js';
import { nemSevenDayOutlook } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { ChartController } from '../charts/ChartController.js';
import { escHtml } from '../utils/escHtml.js';

function buildChartOption(pivot) {
  const dates = Object.keys(pivot).sort();

  const series = NEM_REGIONS.map(r => ({
    name: r.label,
    type: 'bar',
    data: dates.map(d => {
      const val = pivot[d]?.[r.value]?.['Scheduled Demand'];
      return val ? parseInt(val) : null;
    }),
    itemStyle: { color: regionColors[r.value] },
  }));

  // Capacity lines
  NEM_REGIONS.forEach(r => {
    series.push({
      name: `${r.label} Capacity`,
      type: 'line',
      symbol: 'circle', symbolSize: 6,
      data: dates.map(d => {
        const val = pivot[d]?.[r.value]?.['Scheduled Capacity'];
        return val ? parseInt(val) : null;
      }),
      lineStyle: { color: regionColors[r.value], type: 'dashed', width: 1.5 },
      itemStyle: { color: regionColors[r.value] },
    });
  });

  return {
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', top: 0 },
    grid: { left: 60, right: 20, bottom: 50, top: 60 },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', name: 'MW' },
    series,
  };
}

function buildTable(pivot) {
  const dates = Object.keys(pivot).sort();
  const dataTypes = ['Scheduled Demand', 'Scheduled Capacity', 'Scheduled Reserve', 'Net Interchange', 'Trading Interval'];

  let html = '<table class="outlook-table"><thead><tr><th>Region</th><th>Metric</th>';
  for (const d of dates) html += `<th>${escHtml(d)}</th>`;
  html += '</tr></thead><tbody>';

  for (const r of NEM_REGIONS) {
    for (const dt of dataTypes) {
      html += `<tr><td>${escHtml(r.label)}</td><td>${escHtml(dt)}</td>`;
      for (const d of dates) {
        const val = pivot[d]?.[r.value]?.[dt] ?? '\u2014';
        html += `<td>${escHtml(val)}</td>`;
      }
      html += '</tr>';
    }
  }

  html += '</tbody></table>';
  return html;
}

export function renderSevenDayOutlook(container, cleanupFns) {
  container.innerHTML = `
    <div class="page-header"><h2>7-Day Outlook</h2></div>
    <div class="chart-box"></div>
    <div class="table-box" style="margin-top:1.5rem;overflow-x:auto;"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));

  const render = () => {
    const nemState = nemSevenDayOutlook.get();
    if (!nemState.data) return;

    const pivot = nemState.data.pivot;
    const option = buildChartOption(pivot);
    ctrl.setOption(option);
    const tableBox = container.querySelector('.table-box');
    if (tableBox) tableBox.innerHTML = buildTable(pivot);
  };

  const unsubNem = nemSevenDayOutlook.listen(render);
  fetchIfStale(nemSevenDayOutlook, (s) => nemApi.getSevenDayOutlook(s), NEM_FRESHNESS);
  render();

  const unregPoll = registerPoll('nem:sevenDayOutlook', nemSevenDayOutlook, (s) => nemApi.getSevenDayOutlook(s), NEM_FRESHNESS);

  cleanupFns.push(() => {
    unsubNem();
    unregPoll();
    ctrl.dispose();
  });
}
