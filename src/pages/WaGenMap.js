/**
 * WA Generation Map — Geo map with scatter overlay of WA facilities
 * positioned by lat/lon, sized by current output, colored by fuel type.
 *
 * Uses ECharts geo component with Australia states GeoJSON.
 *
 * Data sources: generation.csv (I01 for current output, MAX_GEN_CAPACITY),
 *               facility-meta-fuelmix.csv (lat/lon, display names, fuel types)
 */
import * as echarts from 'echarts';
import wemApi from '../api/WemApi.js';
import { wemGeneration, wemFacilityMeta } from '../store/atoms.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { WEM_GEN_FRESHNESS, STATIC_FRESHNESS } from '../api/config.js';
import { fuel as fuelColors } from '../theme/colors.js';
import { ChartController } from '../charts/ChartController.js';
import australiaGeoJson from '../assets/australia-states.json';

// Register Australia map once
echarts.registerMap('australia', australiaGeoJson);

// Fuel mapping (same as wemTransform)
const FUEL_MAP = {
  'Wind': 'Wind', 'Gas': 'Gas', 'Natural Gas': 'Gas', 'Coal': 'Coal',
  'Solar': 'Solar', 'Distillate': 'Liquid Fuel', 'Landfill Gas': 'Biomass',
  'Landfill / Sewage Gas': 'Biomass', 'Dual (Gas/Distillate)': 'Gas',
  'Battery': 'Battery', 'Battery Storage': 'Battery', 'Waste to Energy': 'Biomass',
  'Utility Solar PV': 'Solar',
};
function mapFuel(f) { return FUEL_MAP[f] || f; }

// Coordinate corrections for facilities with wrong lat/lon in AEMO metadata
// AEMO lists these at Perth CBD (-31.95, 115.86) instead of actual locations
// Real coordinates from Global Energy Observatory & Wikipedia
const COORD_FIXES = {
  'COCKBURN_CCG1':           { lat: -32.200, lon: 115.774 },  // Naval Base, 42 Hope Valley Rd
  'KWINANA_GT2':             { lat: -32.228, lon: 115.773 },  // Kwinana industrial area
  'KWINANA_GT3':             { lat: -32.228, lon: 115.773 },  // Kwinana industrial area
  'PERTHENERGY_KWINANA_GT1': { lat: -32.228, lon: 115.773 },  // Kwinana industrial area
};

/**
 * Extract the AS_AT timestamp from generation data (most recent interval time).
 * @param {object[]} generationRows
 * @returns {string|null}
 */
export function extractDataTimestamp(generationRows) {
  if (!generationRows || generationRows.length === 0) return null;
  for (const row of generationRows) {
    const asAt = row.AS_AT || row.As_At;
    if (asAt) return String(asAt).trim();
  }
  return null;
}

export function buildFacilities(generationRows, facilityMeta) {
  // Build meta lookup: code → { name, fuel, lat, lon }
  const metaMap = new Map();
  for (const fac of facilityMeta) {
    const code = String(fac.FACILITY_CODE || fac.Facility_Code || '').replace(/"/g, '');
    const name = String(fac.DISPLAY_NAME || fac.FACILITY_CODE || '').replace(/"/g, '');
    const fuel = mapFuel(String(fac.PRIMARY_FUEL || fac.FACILITY_TYPE || '').replace(/"/g, ''));
    let lat = parseFloat(String(fac.LATITUDE || '').replace(/"/g, ''));
    let lon = parseFloat(String(fac.LONGITUDE || '').replace(/"/g, ''));

    // Apply coordinate fixes for facilities with wrong AEMO metadata
    const fix = COORD_FIXES[code];
    if (fix) {
      lat = fix.lat;
      lon = fix.lon;
    }

    if (code && !isNaN(lat) && !isNaN(lon)) {
      metaMap.set(code, { name, fuel, lat, lon });
    }
  }

  // Join with generation data
  const facilities = [];
  for (const row of generationRows) {
    const code = row.FACILITY_CODE || row.PARTICIPANT_CODE || '';
    const meta = metaMap.get(code);
    if (!meta) continue;

    const mw = row.I01 ?? 0;
    const capacity = row.MAX_GEN_CAPACITY ?? 0;

    facilities.push({
      name: meta.name,
      code,
      fuel: meta.fuel,
      lat: meta.lat,
      lon: meta.lon,
      mw: typeof mw === 'number' ? mw : 0,
      capacity: typeof capacity === 'number' ? capacity : 0,
    });
  }
  return facilities;
}

export function buildOption(facilities) {
  // Group by fuel type for separate series (legend filtering)
  const byFuel = Object.create(null);
  for (const f of facilities) {
    if (!byFuel[f.fuel]) byFuel[f.fuel] = [];
    byFuel[f.fuel].push(f);
  }

  const series = Object.entries(byFuel).map(([fuel, items]) => ({
    name: fuel,
    type: 'scatter',
    coordinateSystem: 'geo',
    data: items.map(f => ({
      value: [f.lon, f.lat, Math.max(f.mw, 0)],
      name: f.name,
      facility: f,
    })),
    symbolSize: (val) => {
      const mw = val[2];
      if (mw <= 0) return 6;
      return Math.max(8, Math.min(50, Math.sqrt(mw) * 2.5));
    },
    itemStyle: { color: fuelColors[fuel] || '#6b778c', opacity: 0.85 },
    emphasis: {
      itemStyle: { borderColor: '#333', borderWidth: 2 },
    },
  }));

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const f = params.data.facility;
        const util = f.capacity > 0 ? ((f.mw / f.capacity) * 100).toFixed(0) : '—';
        return `<b>${f.name}</b><br/>`
          + `${f.fuel}<br/>`
          + `Output: ${f.mw > 0 ? f.mw.toFixed(1) : '0'} MW<br/>`
          + `Capacity: ${f.capacity.toFixed(0)} MW<br/>`
          + `Utilization: ${util}%`;
      },
    },
    legend: { top: 0, type: 'scroll', textStyle: { fontSize: 11 } },
    geo: {
      map: 'australia',
      roam: true,
      zoom: 1.8,
      center: [122, -28],
      silent: true,  // Disable all mouse events on the geo layer
      label: { show: false },
      itemStyle: {
        areaColor: '#e8e8e8',
        borderColor: '#999',
        borderWidth: 0.5,
      },
      emphasis: {
        disabled: true,  // Disable hover emphasis on geo regions
      },
      regions: [
        { name: 'Western Australia', itemStyle: { areaColor: '#d9e8f5' } },
      ],
    },
    series,
  };
}

function formatTimestamp(ts) {
  if (!ts) return 'Unknown';
  // Parse "2026-02-05 12:00:00" format
  const d = new Date(ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) return ts;

  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);

  // Format time as HH:MM
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const timeStr = `${hh}:${mm}`;

  // Show relative age
  if (diffMins < 1) return `${timeStr} (just now)`;
  if (diffMins < 60) return `${timeStr} (${diffMins}m ago)`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${timeStr} (${diffHrs}h ago)`;
  return ts;
}

function updateKpi(container, facilities, dataTimestamp) {
  const kpiRow = container.querySelector('.kpi-row');
  if (!kpiRow || facilities.length === 0) return;

  const generating = facilities.filter(f => f.mw > 0);
  const totalMw = generating.reduce((s, f) => s + f.mw, 0);
  const totalCap = facilities.reduce((s, f) => s + f.capacity, 0);

  kpiRow.innerHTML = `
    <div class="kpi">
      <span class="kpi-label">Data Time</span>
      <span class="kpi-value" style="color:#666; font-size:0.9em">${formatTimestamp(dataTimestamp)}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Facilities</span>
      <span class="kpi-value" style="color:#333842">${facilities.length}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Generating</span>
      <span class="kpi-value" style="color:#467822">${generating.length}</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Total Output</span>
      <span class="kpi-value" style="color:#34b9b3">${Math.round(totalMw).toLocaleString()} MW</span>
    </div>
    <div class="kpi">
      <span class="kpi-label">Installed Capacity</span>
      <span class="kpi-value" style="color:#3379bf">${Math.round(totalCap).toLocaleString()} MW</span>
    </div>
  `;
}

const fetchGeneration = (signal) => wemApi.getGeneration(signal);
const fetchFacilityMeta = (signal) => wemApi.getFacilityMeta(signal);

export function renderWaGenMap(container, cleanupFns) {
  container.innerHTML = `
    <div class="page-header"><h2>WA Generation Map</h2></div>
    <div class="kpi-row"></div>
    <div class="chart-box"></div>
  `;

  const ctrl = new ChartController(container.querySelector('.chart-box'));

  const render = () => {
    const genState = wemGeneration.get();
    const metaState = wemFacilityMeta.get();
    if (!genState.data || !metaState.data) return;

    const facilities = buildFacilities(genState.data, metaState.data);
    if (facilities.length === 0) return;

    const dataTimestamp = extractDataTimestamp(genState.data);
    const option = buildOption(facilities);
    ctrl.setOption(option);
    updateKpi(container, facilities, dataTimestamp);
  };

  const unsubGen = wemGeneration.listen(render);
  const unsubMeta = wemFacilityMeta.listen(render);

  fetchIfStale(wemGeneration, fetchGeneration, WEM_GEN_FRESHNESS);
  fetchIfStale(wemFacilityMeta, fetchFacilityMeta, STATIC_FRESHNESS);
  render();

  const unregGen = registerPoll('wem:generation', wemGeneration, fetchGeneration, WEM_GEN_FRESHNESS);
  const unregMeta = registerPoll('wem:facilityMeta', wemFacilityMeta, fetchFacilityMeta, STATIC_FRESHNESS);

  cleanupFns.push(() => {
    unsubGen();
    unsubMeta();
    unregGen();
    unregMeta();
    ctrl.dispose();
  });
}
