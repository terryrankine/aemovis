/**
 * WEM data transformations.
 *
 * Normalises WEM CSV data into shapes compatible with the NEM data
 * structures used by our chart pages.
 */

// ── Fuel type mapping (WEM → NEM categories) ───────────────────────
const FUEL_MAP = {
  'Wind':                  'Wind',
  'Gas':                   'Gas',
  'Natural Gas':           'Gas',
  'Coal':                  'Coal',
  'Solar':                 'Solar',
  'Distillate':            'Liquid Fuel',
  'Landfill Gas':          'Biomass',
  'Landfill / Sewage Gas': 'Biomass',
  'Dual (Gas/Distillate)': 'Gas',
  'Battery':               'Battery',
  'Battery Storage':       'Battery',
  'Waste to Energy':       'Biomass',
  'Utility Solar PV':      'Solar',
};

function mapFuel(wemFuel) {
  return FUEL_MAP[wemFuel] || wemFuel;
}

/**
 * Join generation rows with facility metadata to produce a NEM-compatible
 * fuel mix array: [{ fuelType, supply, state: 'WA1' }]
 *
 * @param {object[]} generationRows - Parsed generation.csv rows
 * @param {object[]} facilityMeta   - Parsed facility-meta-fuelmix.csv rows
 * @returns {object[]} NEM-compatible fuel mix items
 */
export function joinFuelMix(generationRows, facilityMeta) {
  // Build lookup: facilityCode → fuel type
  const fuelLookup = new Map();
  for (const fac of facilityMeta) {
    const code = fac.FACILITY_CODE || fac.PARTICIPANT_CODE || fac.Facility_Code || fac.FacilityCode;
    const fuel = fac.PRIMARY_FUEL || fac.FACILITY_TYPE || fac.FUEL_TYPE || fac.Fuel_Type || fac.FuelType;
    if (code && fuel) fuelLookup.set(code, mapFuel(fuel));
  }

  // Sum the latest interval (I01) per fuel type
  const byFuel = Object.create(null);
  for (const row of generationRows) {
    const code = row.FACILITY_CODE || row.PARTICIPANT_CODE || row.Facility_Code || row.FacilityCode;
    const fuel = fuelLookup.get(code) || 'Other';
    const mw = row.I01 ?? row.I48 ?? 0; // I01 is the most recent interval
    if (typeof mw === 'number' && mw > 0) {
      byFuel[fuel] = (byFuel[fuel] || 0) + mw;
    }
  }

  return Object.entries(byFuel).map(([fuelType, supply]) => ({
    fuelType,
    supply,
    state: 'WA1',
  }));
}

/**
 * Normalise pulse.csv rows into structured data for multiple chart pages.
 *
 * @param {object[]} pulseRows - Parsed pulse.csv rows
 * @returns {{ summary: object, timeSeries: object[], outages: object[] }}
 */
export function normalisePulse(pulseRows) {
  if (!pulseRows || pulseRows.length === 0) {
    return { summary: null, timeSeries: [], outages: [] };
  }

  // Sort by trading interval ascending
  const sorted = [...pulseRows].sort((a, b) => {
    const tA = a.TRADING_DAY_INTERVAL || a.Trading_Interval || a.PERIOD || '';
    const tB = b.TRADING_DAY_INTERVAL || b.Trading_Interval || b.PERIOD || '';
    return tA < tB ? -1 : tA > tB ? 1 : 0;
  });

  // Extract field names (WEM CSVs vary slightly in column naming)
  const getVal = (row, ...keys) => {
    for (const k of keys) {
      if (row[k] != null) return row[k];
    }
    return null;
  };

  // Find latest row with actual data (skip future forecast rows with nulls)
  const withPrice = sorted.filter(r => getVal(r, 'ENERGY_PRICE', 'Price', 'PRICE') != null);
  const latest = withPrice.length > 0 ? withPrice[withPrice.length - 1] : sorted[sorted.length - 1];

  // Summary (latest row) for Dispatch Overview WA card
  const summary = {
    regionId: 'WA1',
    price: getVal(latest, 'ENERGY_PRICE', 'Price', 'PRICE'),
    totalDemand: getVal(latest, 'FORECAST_EOI_MW', 'FORECAST_MW', 'TOTAL_DEMAND', 'Demand', 'DEMAND'),
    // Actual gen is only populated retroactively; fall back to forecast demand
    // (WA is an isolated grid so generation ≈ demand)
    scheduledGeneration:
      getVal(latest, 'ACTUAL_TOTAL_GENERATION', 'TOTAL_GENERATION', 'Generation', 'GENERATION')
      || getVal(latest, 'FORECAST_EOI_MW', 'FORECAST_MW')
      || 0,
    semischeduledGeneration: 0,
    priceStatus: 'FIRM',
    settlementDate: getVal(latest, 'TRADING_DAY_INTERVAL', 'Trading_Interval', 'PERIOD'),
    interconnectorFlows: [], // WA has no NEM interconnectors
  };

  // Filter out completely empty future rows (all data fields null)
  const populated = sorted.filter(row => {
    const price = getVal(row, 'ENERGY_PRICE', 'Price', 'PRICE');
    const demand = getVal(row, 'FORECAST_EOI_MW', 'FORECAST_MW', 'TOTAL_DEMAND', 'Demand', 'DEMAND');
    return price != null || demand != null;
  });

  // Time series for Price & Demand chart
  // Rows with PRICE are actuals; rows without are demand-only forecasts
  const timeSeries = populated.map(row => {
    const hasPrice = getVal(row, 'ENERGY_PRICE', 'Price', 'PRICE') != null;
    return {
      settlementDate: getVal(row, 'TRADING_DAY_INTERVAL', 'Trading_Interval', 'PERIOD'),
      regionId: 'WA1',
      rrp: getVal(row, 'ENERGY_PRICE', 'Price', 'PRICE'),
      totalDemand: getVal(row, 'FORECAST_EOI_MW', 'FORECAST_MW', 'TOTAL_DEMAND', 'Demand', 'DEMAND'),
      periodType: hasPrice ? 'ACTUAL' : 'FORECAST',
    };
  });

  // Outages time series (only populated rows)
  const outages = populated.map(row => ({
    time: getVal(row, 'TRADING_DAY_INTERVAL', 'Trading_Interval', 'PERIOD'),
    total: getVal(row, 'TOTAL_OUTAGE_MW', 'Total_Outages') || 0,
    planned: getVal(row, 'PLANNED_OUTAGE_MW', 'Planned_Outages') || 0,
    forced: getVal(row, 'FORCED_OUTAGE_MW', 'Forced_Outages') || 0,
    consequential: getVal(row, 'CONS_OUTAGE_MW', 'Consequential_Outages') || 0,
  }));

  // ESS pricing time series (only populated rows)
  const essPricing = populated.map(row => ({
    time: getVal(row, 'TRADING_DAY_INTERVAL', 'Trading_Interval', 'PERIOD'),
    energy: getVal(row, 'ENERGY_PRICE', 'Price', 'PRICE'),
    regRaise: getVal(row, 'REG_RAISE_PRICE', 'Regulation_Raise_Price'),
    regLower: getVal(row, 'REG_LOWER_PRICE', 'Regulation_Lower_Price'),
    contRaise: getVal(row, 'CONT_RAISE_PRICE', 'Contingency_Raise_Price'),
    contLower: getVal(row, 'CONT_LOWER_PRICE', 'Contingency_Lower_Price'),
    rocof: getVal(row, 'ROCOF_PRICE', 'RoCoF_Price'),
  }));

  return { summary, timeSeries, outages, essPricing };
}

/**
 * Compute daily average prices from pulse.csv rows.
 * Returns NEM-compatible items: [{ settlementDate, regionId, avgRrp }]
 *
 * @param {object[]} pulseRows - Parsed pulse.csv rows
 * @returns {object[]}
 */
export function dailyAveragePrices(pulseRows) {
  if (!pulseRows || pulseRows.length === 0) return [];

  const getVal = (row, ...keys) => {
    for (const k of keys) {
      if (row[k] != null) return row[k];
    }
    return null;
  };

  // Group prices by date
  const byDate = Object.create(null);
  for (const row of pulseRows) {
    const time = getVal(row, 'TRADING_DAY_INTERVAL', 'Trading_Interval', 'PERIOD');
    const price = getVal(row, 'ENERGY_PRICE', 'Price', 'PRICE');
    if (!time || price == null) continue;
    const date = time.split(' ')[0].split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(Number(price));
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([date, prices]) => ({
      settlementDate: date + 'T00:00:00',
      regionId: 'WA1',
      avgRrp: (prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(2),
    }));
}

/**
 * Build a stacked generation dispatch from generation.csv (I01–I48 pivot)
 * joined with facility-meta-fuelmix.csv.
 *
 * generation.csv has one row per facility with columns I01 (most recent)
 * through I48 (oldest), each representing a 30-min interval.
 * The AS_AT column gives the timestamp of I01.
 *
 * @param {object[]} generationRows - Parsed generation.csv rows
 * @param {object[]} facilityMeta   - Parsed facility-meta-fuelmix.csv rows
 * @returns {{ periods: string[], seriesByFuel: Object<string, number[]>, totalByPeriod: number[], capacityByFuel: Object<string, number> }}
 */
export function buildDispatchStack(generationRows, facilityMeta) {
  if (!generationRows || generationRows.length === 0) {
    return { periods: [], seriesByFuel: Object.create(null), totalByPeriod: [], capacityByFuel: Object.create(null) };
  }

  // Build facility → fuel lookup
  const fuelLookup = new Map();
  for (const fac of (facilityMeta || [])) {
    const code = fac.FACILITY_CODE || fac.PARTICIPANT_CODE || fac.Facility_Code || fac.FacilityCode;
    const fuel = fac.PRIMARY_FUEL || fac.FACILITY_TYPE || fac.FUEL_TYPE || fac.Fuel_Type || fac.FuelType;
    if (code && fuel) fuelLookup.set(code, mapFuel(fuel));
  }

  // Determine anchor timestamp from AS_AT (first row that has it)
  let anchorTime = null;
  for (const row of generationRows) {
    const at = row.AS_AT || row.As_At;
    if (at) {
      anchorTime = new Date(String(at).trim().replace(' ', 'T'));
      break;
    }
  }
  if (!anchorTime || isNaN(anchorTime.getTime())) {
    // Fallback: use current time rounded to nearest 30min
    anchorTime = new Date();
    anchorTime.setMinutes(anchorTime.getMinutes() >= 30 ? 30 : 0, 0, 0);
  }

  // Find which I-columns exist (I01–I48)
  const iCols = [];
  for (let n = 1; n <= 48; n++) {
    const key = `I${String(n).padStart(2, '0')}`;
    if (generationRows[0][key] !== undefined) iCols.push(key);
  }
  if (iCols.length === 0) {
    return { periods: [], seriesByFuel: Object.create(null), totalByPeriod: [] };
  }

  // Build period timestamps: I01 = anchor, I02 = anchor - 30min, etc.
  // Reverse so index 0 is oldest (I48) for chronological chart order
  const fmt = (d) => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${da} ${h}:${mi}`;
  };

  // iCols[0] = I01 (most recent), iCols[last] = I48 (oldest)
  // We want chronological order: oldest first
  const periodTimestamps = iCols.map((_, i) => {
    const t = new Date(anchorTime.getTime() - i * 30 * 60 * 1000);
    return fmt(t);
  }).reverse();

  // Reversed column order so index 0 = oldest interval
  const colsChron = [...iCols].reverse();

  // Aggregate MW by fuel type per interval
  const fuelSet = new Set();
  const fuelByInterval = Object.create(null); // fuel → number[] (per interval)

  for (const row of generationRows) {
    const code = row.FACILITY_CODE || row.PARTICIPANT_CODE || row.Facility_Code || '';
    const fuel = fuelLookup.get(code) || 'Other';

    for (let i = 0; i < colsChron.length; i++) {
      const mw = row[colsChron[i]];
      if (typeof mw !== 'number' || mw <= 0) continue;

      fuelSet.add(fuel);
      if (!fuelByInterval[fuel]) fuelByInterval[fuel] = new Array(colsChron.length).fill(0);
      fuelByInterval[fuel][i] += mw;
    }
  }

  const seriesByFuel = Object.create(null);
  for (const fuel of fuelSet) {
    seriesByFuel[fuel] = fuelByInterval[fuel];
  }

  const totalByPeriod = periodTimestamps.map((_, i) => {
    let sum = 0;
    for (const fuel of Object.keys(seriesByFuel)) sum += seriesByFuel[fuel][i];
    return sum;
  });

  // Aggregate MAX_GEN_CAPACITY by fuel type (for utilization %)
  const capacityByFuel = Object.create(null);
  for (const row of generationRows) {
    const cap = row.MAX_GEN_CAPACITY ?? row.Max_Gen_Capacity;
    if (typeof cap !== 'number' || cap <= 0) continue;
    const code = row.FACILITY_CODE || row.PARTICIPANT_CODE || row.Facility_Code || '';
    const fuel = fuelLookup.get(code) || 'Other';
    capacityByFuel[fuel] = (capacityByFuel[fuel] || 0) + cap;
  }

  return { periods: periodTimestamps, seriesByFuel, totalByPeriod, capacityByFuel };
}

/**
 * Normalise DPV demand CSV rows for the DPV vs Demand chart.
 *
 * @param {object[]} rows - Parsed distributed-pv_opdemand.csv rows
 * @returns {object[]}
 */
export function normaliseDpv(rows) {
  if (!rows || rows.length === 0) return [];

  return rows.map(row => {
    const time = row['Trading Interval'] || row.TRADING_DAY_INTERVAL || row.Trading_Interval || row.Timestamp;
    const dpv = row['Estimated DPV Generation (MW)'] ?? row.DPV_MW ?? row.DPV ?? 0;
    const demand = row['Operational Demand (MW)'] ?? row.OPERATIONAL_DEMAND ?? row.Op_Demand ?? 0;
    return { time, dpv, demand };
  }).sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}
