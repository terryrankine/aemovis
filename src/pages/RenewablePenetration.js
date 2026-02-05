import nemApi from '../api/NemApi.js';
import wemApi from '../api/WemApi.js';
import { NEM_REGIONS, NEM_FRESHNESS, WEM_GEN_FRESHNESS, STATIC_FRESHNESS } from '../api/config.js';
import { nemFuelMix, wemGeneration, wemFacilityMeta } from '../store/atoms.js';
import { joinFuelMix } from '../api/wemTransform.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { ChartController } from '../charts/ChartController.js';

const RENEWABLE_FUELS = new Set([
  'Hydro', 'Wind', 'Solar', 'Biomass', 'Battery',
  'Rooftop PV', 'Distributed PV', 'Utility-scale Solar', 'Dpv',
]);

/** Compute renewable vs non-renewable totals for a set of items */
function calcRenewable(items) {
  let renewable = 0;
  let nonRenewable = 0;
  for (const row of items) {
    if (RENEWABLE_FUELS.has(row.fuelType)) {
      renewable += row.supply;
    } else {
      nonRenewable += row.supply;
    }
  }
  return { renewable, nonRenewable };
}

function buildOption(items, region) {
  const filtered = region === 'NEM' ? items : items.filter(d => d.state === region);
  const { renewable, nonRenewable } = calcRenewable(filtered);
  const total = renewable + nonRenewable;
  const pct = total > 0 ? (renewable / total * 100) : 0;

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} MW ({d}%)' },
    legend: { bottom: 10 },
    title: {
      text: `${pct.toFixed(1)}%`,
      subtext: 'Renewable\nPenetration',
      left: 'center', top: 'center',
      textStyle: { fontSize: 28, fontWeight: 700, color: '#467822' },
      subtextStyle: { fontSize: 12, color: '#545d6e' },
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '72%'],
        center: ['50%', '48%'],
        label: { show: false },
        data: [
          { name: 'Renewable', value: Math.round(renewable), itemStyle: { color: '#A1D978' } },
          { name: 'Non-renewable', value: Math.round(nonRenewable), itemStyle: { color: '#333536' } },
        ],
      },
    ],
  };
}

/** Compare mode: side-by-side donut charts */
function buildOptionCompare(regionsData) {
  const n = regionsData.length;
  const series = [];
  const titles = [];

  regionsData.forEach((rd, i) => {
    const cx = `${(100 * (i + 1) / (n + 1)).toFixed(1)}%`;
    const filtered = rd.region === 'NEM'
      ? rd.items
      : rd.items.filter(d => d.state === rd.region);
    const { renewable, nonRenewable } = calcRenewable(filtered);
    const total = renewable + nonRenewable;
    const pct = total > 0 ? (renewable / total * 100) : 0;

    const outerR = n <= 2 ? '60%' : n <= 3 ? '50%' : '42%';
    const innerR = n <= 2 ? '40%' : n <= 3 ? '32%' : '26%';

    series.push({
      type: 'pie',
      radius: [innerR, outerR],
      center: [cx, '52%'],
      label: { show: false },
      data: [
        { name: 'Renewable', value: Math.round(renewable), itemStyle: { color: '#A1D978' } },
        { name: 'Non-renewable', value: Math.round(nonRenewable), itemStyle: { color: '#333536' } },
      ],
    });

    titles.push({
      text: `${pct.toFixed(1)}%`,
      subtext: `${rd.label}\nRenewable`,
      left: cx,
      top: '44%',
      textAlign: 'center',
      textStyle: { fontSize: n <= 2 ? 24 : 18, fontWeight: 700, color: '#467822' },
      subtextStyle: { fontSize: n <= 2 ? 11 : 9, color: '#545d6e' },
    });
  });

  return {
    title: titles,
    tooltip: { trigger: 'item', formatter: '{b}: {c} MW ({d}%)' },
    legend: { bottom: 10 },
    series,
  };
}

const fetchFuelMix = (signal) => nemApi.getFuelMix('CURRENT', signal);
const fetchGeneration = (signal) => wemApi.getGeneration(signal);
const fetchFacilityMeta = (signal) => wemApi.getFacilityMeta(signal);

// Exported for unit testing
export { calcRenewable as _calcRenewable, buildOptionCompare as _buildOptionCompare };

export function renderRenewablePenetration(container, cleanupFns) {
  const allRegions = [...NEM_REGIONS, { label: 'WA', value: 'WA1' }, { label: 'NEM', value: 'NEM' }];
  let region = 'NEM';
  let comparing = false;
  let selectedRegions = new Set();

  container.innerHTML = `
    <div class="page-header">
      <h2>Renewable Penetration</h2>
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
