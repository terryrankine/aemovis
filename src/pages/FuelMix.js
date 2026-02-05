import nemApi from '../api/NemApi.js';
import wemApi from '../api/WemApi.js';
import { NEM_REGIONS, FUEL_ORDER, NEM_FRESHNESS, WEM_GEN_FRESHNESS, STATIC_FRESHNESS } from '../api/config.js';
import { fuel as fuelColors } from '../theme/colors.js';
import { nemFuelMix, wemGeneration, wemFacilityMeta } from '../store/atoms.js';
import { joinFuelMix } from '../api/wemTransform.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { ChartController } from '../charts/ChartController.js';

/** Build pie segment data from a flat items array */
function buildPieData(items) {
  const byFuel = Object.create(null);
  for (const row of items) {
    byFuel[row.fuelType] = (byFuel[row.fuelType] || 0) + row.supply;
  }
  const ordered = FUEL_ORDER.filter(f => byFuel[f] != null);
  const extra = Object.keys(byFuel).filter(f => !ordered.includes(f)).sort();
  return [...ordered, ...extra].map(f => ({
    name: f,
    value: Math.round(byFuel[f]),
    itemStyle: { color: fuelColors[f] || '#6b778c' },
  }));
}

function buildOption(items, region) {
  const filtered = region === 'NEM'
    ? items
    : items.filter(d => d.state === region);

  const data = buildPieData(filtered);
  const total = data.reduce((s, d) => s + d.value, 0);

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} MW ({d}%)' },
    legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}\n{d}%', fontSize: 11 },
        data,
      },
    ],
    title: {
      text: `${total.toLocaleString()} MW`,
      left: 'center', top: 'center',
      textStyle: { fontSize: 18, fontWeight: 700, color: '#333842' },
    },
  };
}

/** Compare mode: side-by-side pie charts */
function buildOptionCompare(regionsData) {
  const n = regionsData.length;
  const series = [];
  const titles = [];

  regionsData.forEach((rd, i) => {
    const cx = `${(100 * (i + 1) / (n + 1)).toFixed(1)}%`;
    const filtered = rd.region === 'NEM'
      ? rd.items
      : rd.items.filter(d => d.state === rd.region);
    const data = buildPieData(filtered);
    const total = data.reduce((s, d) => s + d.value, 0);

    const outerR = n <= 2 ? '55%' : n <= 3 ? '45%' : '38%';
    const innerR = n <= 2 ? '30%' : n <= 3 ? '22%' : '18%';
    const fontSize = n <= 2 ? 11 : 9;

    series.push({
      type: 'pie',
      radius: [innerR, outerR],
      center: [cx, '50%'],
      avoidLabelOverlap: true,
      label: { formatter: '{b}\n{d}%', fontSize },
      data,
    });

    titles.push({
      text: rd.label,
      subtext: `${total.toLocaleString()} MW`,
      left: cx,
      top: 5,
      textAlign: 'center',
      textStyle: { fontSize: 14, fontWeight: 600, color: '#333842' },
      subtextStyle: { fontSize: 11, color: '#545d6e' },
    });
  });

  return {
    title: titles,
    tooltip: { trigger: 'item', formatter: '{b}: {c} MW ({d}%)' },
    legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 11 } },
    series,
  };
}

const fetchFuelMix = (signal) => nemApi.getFuelMix('CURRENT', signal);
const fetchGeneration = (signal) => wemApi.getGeneration(signal);
const fetchFacilityMeta = (signal) => wemApi.getFacilityMeta(signal);

// Exported for unit testing
export { buildPieData as _buildPieData, buildOptionCompare as _buildOptionCompare };

export function renderFuelMix(container, cleanupFns) {
  const allRegions = [...NEM_REGIONS, { label: 'WA', value: 'WA1' }, { label: 'NEM', value: 'NEM' }];
  let region = 'NEM';
  let comparing = false;
  let selectedRegions = new Set();

  container.innerHTML = `
    <div class="page-header">
      <h2>Fuel Mix</h2>
      <div class="region-tabs">${allRegions.map(r => `<button class="region-btn ${r.value === region ? 'active' : ''}" data-region="${r.value}">${r.label}</button>`).join('')}<button class="compare-btn">Compare</button></div>
    </div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));
  const compareBtn = container.querySelector('.compare-btn');

  const updateButtons = () => {
    container.querySelectorAll('.region-btn').forEach(b => {
      b.classList.toggle('active', comparing
        ? selectedRegions.has(b.dataset.region)
        : b.dataset.region === region);
    });
  };

  /** Get items for a given region from the appropriate data source */
  const getRegionItems = (r) => {
    if (r === 'WA1') {
      const genState = wemGeneration.get();
      const metaState = wemFacilityMeta.get();
      if (genState.data && metaState.data) {
        return joinFuelMix(genState.data, metaState.data);
      }
      return null;
    }
    const state = nemFuelMix.get();
    return state.data ? state.data.items : null;
  };

  const render = () => {
    if (comparing) {
      const regionsData = [];
      for (const r of selectedRegions) {
        const items = getRegionItems(r);
        if (items) {
          const label = allRegions.find(x => x.value === r)?.label ?? r;
          regionsData.push({ label, items, region: r });
        }
      }
      if (regionsData.length) {
        const option = buildOptionCompare(regionsData);
        ctrl.setOption(option);
      }
    } else {
      if (region === 'WA1') {
        const genState = wemGeneration.get();
        const metaState = wemFacilityMeta.get();
        if (genState.data && metaState.data) {
          const items = joinFuelMix(genState.data, metaState.data);
          const option = buildOption(items, 'WA1');
          ctrl.setOption(option);
        }
      } else {
        const state = nemFuelMix.get();
        if (state.data) {
          const option = buildOption(state.data.items, region);
          ctrl.setOption(option);
        }
      }
    }
  };

  const unsubNem = nemFuelMix.listen(render);
  const unsubGen = wemGeneration.listen(render);
  const unsubMeta = wemFacilityMeta.listen(render);

  fetchIfStale(nemFuelMix, fetchFuelMix, NEM_FRESHNESS);
  fetchIfStale(wemGeneration, fetchGeneration, WEM_GEN_FRESHNESS);
  fetchIfStale(wemFacilityMeta, fetchFacilityMeta, STATIC_FRESHNESS);
  render();

  const unregPollNem = registerPoll('nem:fuelMix', nemFuelMix, fetchFuelMix, NEM_FRESHNESS);
  const unregPollGen = registerPoll('wem:generation', wemGeneration, fetchGeneration, WEM_GEN_FRESHNESS);
  const unregPollMeta = registerPoll('wem:facilityMeta', wemFacilityMeta, fetchFacilityMeta, STATIC_FRESHNESS);

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

  cleanupFns.push(() => {
    unsubNem();
    unsubGen();
    unsubMeta();
    unregPollNem();
    unregPollGen();
    unregPollMeta();
    ctrl.dispose();
  });
}
