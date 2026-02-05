import { describe, it, expect } from 'vitest';
import { buildOption as buildFcasOption } from './FcasPrices.js';
import { buildOption as buildInterchangeOption, buildGenOption } from './NetInterchange.js';
import { normaliseReserves, buildOption as buildReservesOption } from './WaReserves.js';
import { buildFacilities, buildOption as buildMapOption } from './WaGenMap.js';

// ── FCAS Prices ───────────────────────────────────────────────────

describe('FcasPrices buildOption', () => {
  const makePrices = () => [
    { regionId: 'NSW1', rrp: 50, raiseRegRrp: 10, lowerRegRrp: 5, raise6SecRrp: 0.5, lower6SecRrp: 0.3, raise60SecRrp: 1, lower60SecRrp: 0.8, raise5MinRrp: 0.2, lower5MinRrp: 0.1, raise1SecRrp: 0.01, lower1SecRrp: 0.02 },
    { regionId: 'VIC1', rrp: 30, raiseRegRrp: 8, lowerRegRrp: 3, raise6SecRrp: 0.4, lower6SecRrp: 0.2, raise60SecRrp: 0.9, lower60SecRrp: 0.7, raise5MinRrp: 0.15, lower5MinRrp: 0.05, raise1SecRrp: 0.005, lower1SecRrp: 0.01 },
  ];

  it('creates one bar series per region', () => {
    const opt = buildFcasOption(makePrices());
    expect(opt.series).toHaveLength(2);
    expect(opt.series[0].name).toBe('NSW');
    expect(opt.series[1].name).toBe('VIC');
  });

  it('has 10 FCAS categories on x-axis', () => {
    const opt = buildFcasOption(makePrices());
    expect(opt.xAxis.data).toHaveLength(10);
    expect(opt.xAxis.data).toContain('Raise Reg');
    expect(opt.xAxis.data).toContain('Lower 5m');
  });

  it('uses region colors', () => {
    const opt = buildFcasOption(makePrices());
    expect(opt.series[0].itemStyle.color).toBe('#3379bf'); // NSW1
    expect(opt.series[1].itemStyle.color).toBe('#6C3078'); // VIC1
  });

  it('each series has 10 data points', () => {
    const opt = buildFcasOption(makePrices());
    expect(opt.series[0].data).toHaveLength(10);
    expect(opt.series[0].data[0]).toBe(10); // raiseRegRrp
  });
});

// ── Net Interchange ───────────────────────────────────────────────

describe('NetInterchange buildOption', () => {
  const makeItems = () => [
    { settlementDate: '2026-02-05T08:00', regionId: 'NSW1', netInterchange: -500, scheduledGeneration: 3000, semiScheduledGeneration: 4000, periodType: 'ACTUAL' },
    { settlementDate: '2026-02-05T08:00', regionId: 'QLD1', netInterchange: 300, scheduledGeneration: 5000, semiScheduledGeneration: 2000, periodType: 'ACTUAL' },
    { settlementDate: '2026-02-05T08:30', regionId: 'NSW1', netInterchange: -400, scheduledGeneration: 3200, semiScheduledGeneration: 3800, periodType: 'ACTUAL' },
  ];

  it('creates bar series for selected regions', () => {
    const opt = buildInterchangeOption(makeItems(), ['NSW1', 'QLD1']);
    expect(opt.series).toHaveLength(2);
  });

  it('filters to selected regions only', () => {
    const opt = buildInterchangeOption(makeItems(), ['NSW1']);
    expect(opt.series).toHaveLength(1);
    expect(opt.series[0].name).toBe('NSW Net Interchange');
  });

  it('excludes FORECAST data', () => {
    const items = [
      ...makeItems(),
      { settlementDate: '2026-02-05T09:00', regionId: 'NSW1', netInterchange: -300, periodType: 'FORECAST' },
    ];
    const opt = buildInterchangeOption(items, ['NSW1']);
    // Only 2 ACTUAL timestamps for NSW
    expect(opt.series[0].data).toHaveLength(2);
  });
});

describe('NetInterchange buildGenOption', () => {
  const makeItems = () => [
    { settlementDate: '2026-02-05T08:00', regionId: 'NSW1', scheduledGeneration: 3000, semiScheduledGeneration: 4000, periodType: 'ACTUAL' },
  ];

  it('creates 2 series per region (scheduled + semi-scheduled)', () => {
    const opt = buildGenOption(makeItems(), ['NSW1']);
    expect(opt.series).toHaveLength(2);
    expect(opt.series[0].name).toBe('NSW Scheduled');
    expect(opt.series[1].name).toBe('NSW Semi-scheduled');
  });

  it('stacks by region', () => {
    const opt = buildGenOption(makeItems(), ['NSW1']);
    expect(opt.series[0].stack).toBe('gen-NSW1');
    expect(opt.series[1].stack).toBe('gen-NSW1');
  });
});

// ── WA Reserves ───────────────────────────────────────────────────

describe('WaReserves normaliseReserves', () => {
  it('extracts reserve and forecast fields from pulse rows', () => {
    const rows = [{
      TRADING_DAY_INTERVAL: '2026-02-05 08:00:00',
      RTD_TOTAL_SPINNING_RESERVE: 120,
      LFAS_UP_REQUIREMENT_MW: 80,
      FORECAST_EOI_MW: 2500,
      ACTUAL_TOTAL_GENERATION: 2450,
      RTD_TOTAL_GENERATION: 3100,
      FORECAST_NSG_MW: 1000,
      ACTUAL_NSG_MW: 980,
    }];
    const result = normaliseReserves(rows);
    expect(result).toHaveLength(1);
    expect(result[0].spinningReserve).toBe(120);
    expect(result[0].lfasUp).toBe(80);
    expect(result[0].forecastDemand).toBe(2500);
    expect(result[0].actualGen).toBe(2450);
    expect(result[0].rtdGen).toBe(3100);
  });

  it('returns empty for null/empty input', () => {
    expect(normaliseReserves(null)).toEqual([]);
    expect(normaliseReserves([])).toEqual([]);
  });

  it('sorts by time ascending', () => {
    const rows = [
      { TRADING_DAY_INTERVAL: '2026-02-05 09:00:00', RTD_TOTAL_SPINNING_RESERVE: 100, LFAS_UP_REQUIREMENT_MW: 80 },
      { TRADING_DAY_INTERVAL: '2026-02-05 08:00:00', RTD_TOTAL_SPINNING_RESERVE: 110, LFAS_UP_REQUIREMENT_MW: 80 },
    ];
    const result = normaliseReserves(rows);
    expect(result[0].time).toBe('2026-02-05 08:00:00');
  });
});

describe('WaReserves buildOption', () => {
  it('creates 5 series (forecast demand, actual gen, RTD gen, LFAS, spinning reserve)', () => {
    const rows = [{
      time: '2026-02-05 08:00:00',
      spinningReserve: 120,
      lfasUp: 80,
      forecastDemand: 2500,
      actualGen: 2450,
      rtdGen: 3100,
    }];
    const opt = buildReservesOption(rows);
    expect(opt.series).toHaveLength(5);
    const names = opt.series.map(s => s.name);
    expect(names).toContain('Forecast Demand');
    expect(names).toContain('Actual Generation');
    expect(names).toContain('Spinning Reserve');
    expect(names).toContain('LFAS Up Requirement');
  });

  it('has dual y-axes', () => {
    const rows = [{ time: '2026-02-05 08:00:00', spinningReserve: 0, lfasUp: 80, forecastDemand: 2500, actualGen: 2450, rtdGen: 3100 }];
    const opt = buildReservesOption(rows);
    expect(opt.yAxis).toHaveLength(2);
  });
});

// ── WA Gen Map ────────────────────────────────────────────────────

describe('WaGenMap buildFacilities', () => {
  const meta = [
    { FACILITY_CODE: '"COLLIE_G1"', DISPLAY_NAME: '"Collie Power Station"', PRIMARY_FUEL: '"Coal"', LATITUDE: '"-33.37"', LONGITUDE: '"116.15"' },
    { FACILITY_CODE: '"WIND_FARM"', DISPLAY_NAME: '"Albany Wind Farm"', PRIMARY_FUEL: '"Wind"', LATITUDE: '"-35.06"', LONGITUDE: '"117.78"' },
  ];

  it('joins generation with meta to produce facility list', () => {
    const gen = [
      { FACILITY_CODE: 'COLLIE_G1', I01: 200, MAX_GEN_CAPACITY: 340 },
      { FACILITY_CODE: 'WIND_FARM', I01: 15, MAX_GEN_CAPACITY: 21.6 },
    ];
    const result = buildFacilities(gen, meta);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Collie Power Station');
    expect(result[0].fuel).toBe('Coal');
    expect(result[0].mw).toBe(200);
    expect(result[0].capacity).toBe(340);
    expect(result[0].lat).toBe(-33.37);
    expect(result[0].lon).toBe(116.15);
  });

  it('skips facilities without lat/lon in meta', () => {
    const gen = [{ FACILITY_CODE: 'UNKNOWN', I01: 50, MAX_GEN_CAPACITY: 100 }];
    const result = buildFacilities(gen, meta);
    expect(result).toHaveLength(0);
  });
});

describe('WaGenMap buildOption', () => {
  it('creates scatter series grouped by fuel type', () => {
    const facilities = [
      { name: 'A', code: 'A', fuel: 'Coal', lat: -33, lon: 116, mw: 200, capacity: 340 },
      { name: 'B', code: 'B', fuel: 'Wind', lat: -35, lon: 117, mw: 15, capacity: 22 },
      { name: 'C', code: 'C', fuel: 'Coal', lat: -32, lon: 115, mw: 100, capacity: 200 },
    ];
    const opt = buildMapOption(facilities);
    expect(opt.series).toHaveLength(2); // Coal + Wind
    const coalSeries = opt.series.find(s => s.name === 'Coal');
    expect(coalSeries.data).toHaveLength(2);
  });

  it('positions bubbles by lon/lat', () => {
    const facilities = [
      { name: 'A', code: 'A', fuel: 'Wind', lat: -33.5, lon: 116.2, mw: 50, capacity: 100 },
    ];
    const opt = buildMapOption(facilities);
    expect(opt.series[0].data[0].value[0]).toBe(116.2); // lon
    expect(opt.series[0].data[0].value[1]).toBe(-33.5); // lat
  });
});
