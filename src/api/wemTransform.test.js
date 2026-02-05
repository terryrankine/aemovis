import { describe, it, expect } from 'vitest';
import { joinFuelMix, normalisePulse, dailyAveragePrices, normaliseDpv, buildDispatchStack } from './wemTransform.js';

// ── joinFuelMix ────────────────────────────────────────────────────

describe('joinFuelMix', () => {
  const facilityMeta = [
    { FACILITY_CODE: 'COLLIE_G1', PRIMARY_FUEL: 'Coal' },
    { FACILITY_CODE: 'WIND_FARM', PRIMARY_FUEL: 'Wind' },
    { FACILITY_CODE: 'GAS_PLANT', PRIMARY_FUEL: 'Gas' },
  ];

  it('aggregates MW by mapped fuel type', () => {
    const generation = [
      { FACILITY_CODE: 'COLLIE_G1', I01: 200 },
      { FACILITY_CODE: 'WIND_FARM', I01: 150 },
      { FACILITY_CODE: 'GAS_PLANT', I01: 100 },
    ];
    const result = joinFuelMix(generation, facilityMeta);

    expect(result).toEqual(expect.arrayContaining([
      { fuelType: 'Coal', supply: 200, state: 'WA1' },
      { fuelType: 'Wind', supply: 150, state: 'WA1' },
      { fuelType: 'Gas', supply: 100, state: 'WA1' },
    ]));
  });

  it('sums facilities with same fuel type', () => {
    const generation = [
      { FACILITY_CODE: 'COLLIE_G1', I01: 200 },
      { FACILITY_CODE: 'COLLIE_G2', I01: 180 }, // unknown facility → 'Other'
    ];
    const result = joinFuelMix(generation, facilityMeta);
    const coal = result.find(r => r.fuelType === 'Coal');
    expect(coal.supply).toBe(200);
  });

  it('skips rows with zero or negative MW', () => {
    const generation = [
      { FACILITY_CODE: 'COLLIE_G1', I01: 0 },
      { FACILITY_CODE: 'WIND_FARM', I01: -5 },
    ];
    const result = joinFuelMix(generation, facilityMeta);
    expect(result).toHaveLength(0);
  });

  it('maps unknown facilities to Other', () => {
    const generation = [{ FACILITY_CODE: 'UNKNOWN', I01: 50 }];
    const result = joinFuelMix(generation, facilityMeta);
    expect(result[0].fuelType).toBe('Other');
  });

  it('handles empty inputs', () => {
    expect(joinFuelMix([], [])).toEqual([]);
  });

  it('uses Object.create(null) — no prototype keys leak', () => {
    const generation = [{ FACILITY_CODE: 'COLLIE_G1', I01: 100 }];
    const result = joinFuelMix(generation, facilityMeta);
    // Should not include toString, hasOwnProperty, etc. as fuel types
    const fuelTypes = result.map(r => r.fuelType);
    expect(fuelTypes).not.toContain('toString');
    expect(fuelTypes).not.toContain('hasOwnProperty');
  });
});

// ── normalisePulse ─────────────────────────────────────────────────

describe('normalisePulse', () => {
  const makePulseRow = (time, price, demand, outage = 0) => ({
    TRADING_DAY_INTERVAL: time,
    ENERGY_PRICE: price,
    FORECAST_EOI_MW: demand,
    TOTAL_OUTAGE_MW: outage,
    PLANNED_OUTAGE_MW: 0,
    FORCED_OUTAGE_MW: 0,
    CONS_OUTAGE_MW: 0,
  });

  it('returns summary from latest row with price', () => {
    const rows = [
      makePulseRow('2026-02-05 08:00', 45.0, 3000),
      makePulseRow('2026-02-05 08:30', 50.0, 3100),
    ];
    const { summary } = normalisePulse(rows);
    expect(summary.regionId).toBe('WA1');
    expect(summary.price).toBe(50.0);
    expect(summary.totalDemand).toBe(3100);
  });

  it('filters out rows where both price and demand are null', () => {
    const rows = [
      makePulseRow('2026-02-05 08:00', 45.0, 3000),
      { TRADING_DAY_INTERVAL: '2026-02-05 09:00', ENERGY_PRICE: null, FORECAST_EOI_MW: null },
    ];
    const { timeSeries } = normalisePulse(rows);
    expect(timeSeries).toHaveLength(1);
  });

  it('marks rows with price as ACTUAL, without as FORECAST', () => {
    const rows = [
      makePulseRow('2026-02-05 08:00', 45.0, 3000),
      { TRADING_DAY_INTERVAL: '2026-02-05 08:30', ENERGY_PRICE: null, FORECAST_EOI_MW: 3100 },
    ];
    const { timeSeries } = normalisePulse(rows);
    expect(timeSeries[0].periodType).toBe('ACTUAL');
    expect(timeSeries[1].periodType).toBe('FORECAST');
  });

  it('returns empty arrays for null/empty input', () => {
    expect(normalisePulse(null)).toEqual({ summary: null, timeSeries: [], outages: [] });
    expect(normalisePulse([])).toEqual({ summary: null, timeSeries: [], outages: [] });
  });

  it('sorts by trading interval ascending', () => {
    const rows = [
      makePulseRow('2026-02-05 09:00', 50, 3100),
      makePulseRow('2026-02-05 08:00', 45, 3000),
    ];
    const { timeSeries } = normalisePulse(rows);
    expect(timeSeries[0].settlementDate).toBe('2026-02-05 08:00');
    expect(timeSeries[1].settlementDate).toBe('2026-02-05 09:00');
  });

  it('extracts outage data', () => {
    const rows = [
      { ...makePulseRow('2026-02-05 08:00', 45, 3000), TOTAL_OUTAGE_MW: 100, PLANNED_OUTAGE_MW: 60, FORCED_OUTAGE_MW: 30, CONS_OUTAGE_MW: 10 },
    ];
    const { outages } = normalisePulse(rows);
    expect(outages[0]).toEqual({
      time: '2026-02-05 08:00',
      total: 100,
      planned: 60,
      forced: 30,
      consequential: 10,
    });
  });

  it('extracts essPricing data', () => {
    const rows = [makePulseRow('2026-02-05 08:00', 45, 3000)];
    const { essPricing } = normalisePulse(rows);
    expect(essPricing[0].energy).toBe(45);
    expect(essPricing[0].time).toBe('2026-02-05 08:00');
  });
});

// ── dailyAveragePrices ─────────────────────────────────────────────

describe('dailyAveragePrices', () => {
  it('computes daily averages from interval prices', () => {
    const rows = [
      { TRADING_DAY_INTERVAL: '2026-02-05 08:00', ENERGY_PRICE: 40 },
      { TRADING_DAY_INTERVAL: '2026-02-05 08:30', ENERGY_PRICE: 60 },
      { TRADING_DAY_INTERVAL: '2026-02-06 08:00', ENERGY_PRICE: 100 },
    ];
    const result = dailyAveragePrices(rows);

    expect(result).toHaveLength(2);
    expect(result[0].settlementDate).toBe('2026-02-05T00:00:00');
    expect(result[0].regionId).toBe('WA1');
    expect(result[0].avgRrp).toBe('50.00'); // (40+60)/2
    expect(result[1].avgRrp).toBe('100.00');
  });

  it('skips rows without price', () => {
    const rows = [
      { TRADING_DAY_INTERVAL: '2026-02-05 08:00', ENERGY_PRICE: null },
      { TRADING_DAY_INTERVAL: '2026-02-05 08:30', ENERGY_PRICE: 60 },
    ];
    const result = dailyAveragePrices(rows);
    expect(result).toHaveLength(1);
    expect(result[0].avgRrp).toBe('60.00');
  });

  it('returns empty for null/empty input', () => {
    expect(dailyAveragePrices(null)).toEqual([]);
    expect(dailyAveragePrices([])).toEqual([]);
  });

  it('sorts output by date ascending', () => {
    const rows = [
      { TRADING_DAY_INTERVAL: '2026-02-07 08:00', ENERGY_PRICE: 30 },
      { TRADING_DAY_INTERVAL: '2026-02-05 08:00', ENERGY_PRICE: 50 },
    ];
    const result = dailyAveragePrices(rows);
    expect(result[0].settlementDate).toBe('2026-02-05T00:00:00');
    expect(result[1].settlementDate).toBe('2026-02-07T00:00:00');
  });

  it('handles T-separated timestamps', () => {
    const rows = [
      { TRADING_DAY_INTERVAL: '2026-02-05T08:00:00', ENERGY_PRICE: 42 },
    ];
    const result = dailyAveragePrices(rows);
    expect(result[0].settlementDate).toBe('2026-02-05T00:00:00');
  });
});

// ── normaliseDpv ───────────────────────────────────────────────────

describe('normaliseDpv', () => {
  it('extracts time, dpv, demand from standard column names', () => {
    const rows = [
      { 'Trading Interval': '2026-02-05 10:00', 'Estimated DPV Generation (MW)': 1200, 'Operational Demand (MW)': 2800 },
    ];
    const result = normaliseDpv(rows);
    expect(result[0]).toEqual({ time: '2026-02-05 10:00', dpv: 1200, demand: 2800 });
  });

  it('handles alternative column names', () => {
    const rows = [
      { TRADING_DAY_INTERVAL: '2026-02-05 10:00', DPV_MW: 500, OPERATIONAL_DEMAND: 3000 },
    ];
    const result = normaliseDpv(rows);
    expect(result[0].dpv).toBe(500);
    expect(result[0].demand).toBe(3000);
  });

  it('defaults missing dpv/demand to 0', () => {
    const rows = [
      { 'Trading Interval': '2026-02-05 10:00' },
    ];
    const result = normaliseDpv(rows);
    expect(result[0].dpv).toBe(0);
    expect(result[0].demand).toBe(0);
  });

  it('sorts by time ascending', () => {
    const rows = [
      { 'Trading Interval': '2026-02-05 12:00', 'Estimated DPV Generation (MW)': 900, 'Operational Demand (MW)': 2500 },
      { 'Trading Interval': '2026-02-05 10:00', 'Estimated DPV Generation (MW)': 1200, 'Operational Demand (MW)': 2800 },
    ];
    const result = normaliseDpv(rows);
    expect(result[0].time).toBe('2026-02-05 10:00');
  });

  it('returns empty for null/empty input', () => {
    expect(normaliseDpv(null)).toEqual([]);
    expect(normaliseDpv([])).toEqual([]);
  });
});

// ── buildDispatchStack ────────────────────────────────────────────

describe('buildDispatchStack', () => {
  const facilityMeta = [
    { FACILITY_CODE: 'COLLIE_G1', PRIMARY_FUEL: 'Coal' },
    { FACILITY_CODE: 'WIND_FARM', PRIMARY_FUEL: 'Wind' },
    { FACILITY_CODE: 'GAS_PLANT', PRIMARY_FUEL: 'Gas' },
    { FACILITY_CODE: 'SOLAR_PK',  PRIMARY_FUEL: 'Solar' },
  ];

  it('aggregates MW by fuel type per period', () => {
    const rows = [
      { FACILITY_CODE: 'COLLIE_G1', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 200 },
      { FACILITY_CODE: 'WIND_FARM', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 150 },
      { FACILITY_CODE: 'GAS_PLANT', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 100 },
      { FACILITY_CODE: 'COLLIE_G1', PERIOD: '2026-02-04 08:30:00', ACTUAL_MW: 210 },
    ];
    const result = buildDispatchStack(rows, facilityMeta);

    expect(result.periods).toEqual(['2026-02-04 08:00:00', '2026-02-04 08:30:00']);
    expect(result.seriesByFuel['Coal']).toEqual([200, 210]);
    expect(result.seriesByFuel['Wind']).toEqual([150, 0]);
    expect(result.seriesByFuel['Gas']).toEqual([100, 0]);
  });

  it('filters out negative ACTUAL_MW (loads)', () => {
    const rows = [
      { FACILITY_CODE: 'COLLIE_G1', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 200 },
      { FACILITY_CODE: 'GAS_PLANT', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: -50 },
    ];
    const result = buildDispatchStack(rows, facilityMeta);

    expect(result.seriesByFuel['Coal']).toEqual([200]);
    expect(result.seriesByFuel['Gas']).toBeUndefined();
  });

  it('filters out zero ACTUAL_MW', () => {
    const rows = [
      { FACILITY_CODE: 'COLLIE_G1', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 0 },
    ];
    const result = buildDispatchStack(rows, facilityMeta);
    expect(result.periods).toHaveLength(0);
  });

  it('maps fuel types through FUEL_MAP', () => {
    const meta = [
      { FACILITY_CODE: 'DIST_1', PRIMARY_FUEL: 'Distillate' },
    ];
    const rows = [
      { FACILITY_CODE: 'DIST_1', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 30 },
    ];
    const result = buildDispatchStack(rows, meta);
    expect(result.seriesByFuel['Liquid Fuel']).toEqual([30]);
    expect(result.seriesByFuel['Distillate']).toBeUndefined();
  });

  it('assigns unknown facilities to Other', () => {
    const rows = [
      { FACILITY_CODE: 'UNKNOWN', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 42 },
    ];
    const result = buildDispatchStack(rows, facilityMeta);
    expect(result.seriesByFuel['Other']).toEqual([42]);
  });

  it('sorts periods chronologically', () => {
    const rows = [
      { FACILITY_CODE: 'COLLIE_G1', PERIOD: '2026-02-04 09:00:00', ACTUAL_MW: 200 },
      { FACILITY_CODE: 'COLLIE_G1', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 180 },
    ];
    const result = buildDispatchStack(rows, facilityMeta);
    expect(result.periods[0]).toBe('2026-02-04 08:00:00');
    expect(result.periods[1]).toBe('2026-02-04 09:00:00');
    expect(result.seriesByFuel['Coal']).toEqual([180, 200]);
  });

  it('computes totalByPeriod correctly', () => {
    const rows = [
      { FACILITY_CODE: 'COLLIE_G1', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 200 },
      { FACILITY_CODE: 'WIND_FARM', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 150 },
    ];
    const result = buildDispatchStack(rows, facilityMeta);
    expect(result.totalByPeriod).toEqual([350]);
  });

  it('returns empty structure for null/empty input', () => {
    const empty = buildDispatchStack(null, facilityMeta);
    expect(empty.periods).toEqual([]);
    expect(empty.totalByPeriod).toEqual([]);

    const empty2 = buildDispatchStack([], facilityMeta);
    expect(empty2.periods).toEqual([]);
  });

  it('aligns series arrays — zero-fills missing fuels per period', () => {
    const rows = [
      { FACILITY_CODE: 'COLLIE_G1', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 200 },
      { FACILITY_CODE: 'WIND_FARM', PERIOD: '2026-02-04 08:30:00', ACTUAL_MW: 150 },
    ];
    const result = buildDispatchStack(rows, facilityMeta);

    // Coal only in period 1, Wind only in period 2
    expect(result.seriesByFuel['Coal']).toEqual([200, 0]);
    expect(result.seriesByFuel['Wind']).toEqual([0, 150]);
    expect(result.periods).toHaveLength(2);
  });

  it('uses Object.create(null) — no prototype pollution', () => {
    const rows = [
      { FACILITY_CODE: 'COLLIE_G1', PERIOD: '2026-02-04 08:00:00', ACTUAL_MW: 100 },
    ];
    const result = buildDispatchStack(rows, facilityMeta);
    expect(Object.getPrototypeOf(result.seriesByFuel)).toBeNull();
  });
});
