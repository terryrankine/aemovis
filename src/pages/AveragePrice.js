import nemApi from '../api/NemApi.js';
import wemApi from '../api/WemApi.js';
import { ALL_REGIONS, NEM_FRESHNESS, WEM_FRESHNESS } from '../api/config.js';
import { regionColors } from '../theme/colors.js';
import { getDailyPriceAtom, wemPulse } from '../store/atoms.js';
import { dailyAveragePrices } from '../api/wemTransform.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { ChartController } from '../charts/ChartController.js';

function buildOption(items, waItems) {
  const allItems = [...items, ...waItems];
  const dates = [...new Set(allItems.map(d => d.settlementDate.split('T')[0]))].sort();

  const series = ALL_REGIONS.map(r => {
    const regionItems = allItems.filter(d => d.regionId === r.value);
    return {
      name: r.label,
      type: 'bar',
      data: dates.map(date => {
        const row = regionItems.find(d => d.settlementDate.startsWith(date));
        return row ? parseFloat(row.avgRrp) : null;
      }),
      itemStyle: { color: regionColors[r.value] },
    };
  });

  const dateLabels = dates.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  });

  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 60, right: 20, bottom: 60, top: 50 },
    xAxis: { type: 'category', data: dateLabels, axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: '$/MWh' },
    series,
  };
}

export function renderAveragePrice(container, cleanupFns) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  container.innerHTML = `
    <div class="page-header">
      <h2>Average Price</h2>
      <div class="controls">
        <select id="year-select">
          ${[year, year - 1, year - 2].map(y => `<option value="${y}">${y}</option>`).join('')}
        </select>
        <select id="month-select">
          ${months.map((m, i) => `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));

  const render = () => {
    const atom = getDailyPriceAtom(year, month);
    const state = atom.get();
    if (!state.data) return;

    // WA daily averages from pulse.csv (only ~4 days, so only shows for current month)
    const wemState = wemPulse.get();
    const waItems = wemState.data ? dailyAveragePrices(wemState.data) : [];

    // Filter WA items to selected year/month
    const mm = String(month).padStart(2, '0');
    const prefix = `${year}-${mm}`;
    const waFiltered = waItems.filter(d => d.settlementDate.startsWith(prefix));

    // Only show WA for dates that NEM also has data for (avoids WA appearing
    // to extend beyond NEM — pulse.csv is only ~4 days of recent data)
    const nemDates = new Set(state.data.items.map(d => d.settlementDate.split('T')[0]));
    const waAligned = waFiltered.filter(d => nemDates.has(d.settlementDate.split('T')[0]));

    const option = buildOption(state.data.items, waAligned);
    ctrl.setOption(option);
  };

  // Track current subscription so we can unsub on year/month change
  let currentUnsub = null;

  const load = () => {
    if (currentUnsub) currentUnsub();
    const atom = getDailyPriceAtom(year, month);
    currentUnsub = atom.listen(render);
    fetchIfStale(atom, (s) => nemApi.getDailyAveragePrices(year, month, s), NEM_FRESHNESS);
    render();
  };

  // Also re-render when WEM pulse data arrives
  const unsubWem = wemPulse.listen(render);
  fetchIfStale(wemPulse, (s) => wemApi.getPulse(s), WEM_FRESHNESS);
  const unregPollWem = registerPoll('wem:pulse', wemPulse, (s) => wemApi.getPulse(s), WEM_FRESHNESS);

  container.querySelector('#year-select').addEventListener('change', e => { year = +e.target.value; load(); });
  container.querySelector('#month-select').addEventListener('change', e => { month = +e.target.value; load(); });

  load();

  cleanupFns.push(() => {
    if (currentUnsub) currentUnsub();
    unsubWem();
    unregPollWem();
    ctrl.dispose();
  });
}
