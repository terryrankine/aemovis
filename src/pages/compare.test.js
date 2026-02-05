import { describe, it, expect } from 'vitest';
import { _buildOptionCompare as buildPriceCompare } from './PriceAndDemand.js';
import { _buildPieData, _buildOptionCompare as buildFuelCompare } from './FuelMix.js';
import { _calcRenewable, _buildOptionCompare as buildRenewableCompare } from './RenewablePenetration.js';

// ── PriceAndDemand compare ─────────────────────────────────────────

describe('PriceAndDemand buildOptionCompare', () => {
  const makeItem = (regionId, date, rrp, demand, type = 'ACTUAL') => ({
    regionId, settlementDate: date, rrp, totalDemand: demand, periodType: type,
  });

  it('produces series for each selected region', () => {
    const items = [
      makeItem('NSW1', '2025-01-01T12:00', 80, 8000),
      makeItem('QLD1', '2025-01-01T12:00', 60, 5000),
      makeItem('VIC1', '2025-01-01T12:00', 70, 4000),
    ];
    const opt = buildPriceCompare(items, ['NSW1', 'QLD1'], null);
    // 2 regions × 2 metrics (price + demand) = 4 series
    expect(opt.series.length).toBe(4);
    expect(opt.series[0].name).toBe('NSW Price');
    expect(opt.series[1].name).toBe('NSW Demand');
    expect(opt.series[2].name).toBe('QLD Price');
    expect(opt.series[3].name).toBe('QLD Demand');
  });

  it('uses region colors for each region', () => {
    const items = [
      makeItem('NSW1', '2025-01-01T12:00', 80, 8000),
      makeItem('SA1', '2025-01-01T12:00', 90, 2000),
    ];
    const opt = buildPriceCompare(items, ['NSW1', 'SA1'], null);
    // NSW1 color = #3379bf, SA1 = #f9b067
    expect(opt.series[0].lineStyle.color).toBe('#3379bf');
    expect(opt.series[2].lineStyle.color).toBe('#f9b067');
  });

  it('uses solid lines for price, dashed for demand', () => {
    const items = [makeItem('NSW1', '2025-01-01T12:00', 80, 8000)];
    const opt = buildPriceCompare(items, ['NSW1'], null);
    expect(opt.series[0].lineStyle.type).toBeUndefined(); // solid (default)
    expect(opt.series[1].lineStyle.type).toBe('dashed');
  });

  it('includes forecast series when forecast data exists', () => {
    const items = [
      makeItem('NSW1', '2025-01-01T12:00', 80, 8000, 'ACTUAL'),
      makeItem('NSW1', '2025-01-02T12:00', 85, 8200, 'FORECAST'),
    ];
    const opt = buildPriceCompare(items, ['NSW1'], null);
    // 1 region: price + demand + forecast price + forecast demand = 4
    expect(opt.series.length).toBe(4);
    expect(opt.series[2].name).toBe('NSW Price (f)');
    expect(opt.series[3].name).toBe('NSW Demand (f)');
  });

  it('adds APC markLine when limits provided and NEM region selected', () => {
    const items = [makeItem('NSW1', '2025-01-01T12:00', 80, 8000)];
    const limits = { AdministeredPriceCap: 500 };
    const opt = buildPriceCompare(items, ['NSW1'], limits);
    const apcSeries = opt.series.find(s => s.name === 'APC');
    expect(apcSeries).toBeDefined();
    expect(apcSeries.markLine.data[0].yAxis).toBe(500);
  });

  it('omits APC when only WA1 selected', () => {
    const items = [makeItem('WA1', '2025-01-01T12:00', 50, 3000)];
    const limits = { AdministeredPriceCap: 500 };
    const opt = buildPriceCompare(items, ['WA1'], limits);
    const apcSeries = opt.series.find(s => s.name === 'APC');
    expect(apcSeries).toBeUndefined();
  });

  it('has dual y-axes ($/MWh and MW)', () => {
    const items = [makeItem('NSW1', '2025-01-01T12:00', 80, 8000)];
    const opt = buildPriceCompare(items, ['NSW1'], null);
    expect(opt.yAxis).toHaveLength(2);
    expect(opt.yAxis[0].name).toBe('$/MWh');
    expect(opt.yAxis[1].name).toBe('MW');
  });

  it('filters items by selected regions only', () => {
    const items = [
      makeItem('NSW1', '2025-01-01T12:00', 80, 8000),
      makeItem('QLD1', '2025-01-01T12:00', 60, 5000),
      makeItem('VIC1', '2025-01-01T12:00', 70, 4000),
    ];
    const opt = buildPriceCompare(items, ['VIC1'], null);
    // Only VIC: 2 series (price + demand)
    expect(opt.series.length).toBe(2);
    expect(opt.series[0].name).toBe('VIC Price');
    expect(opt.series[0].data[0][1]).toBe(70);
  });
});

// ── FuelMix helpers ─────────────────────────────────────────────────

describe('FuelMix buildPieData', () => {
  it('aggregates supply by fuel type', () => {
    const items = [
      { fuelType: 'Wind', supply: 100 },
      { fuelType: 'Wind', supply: 200 },
      { fuelType: 'Gas', supply: 500 },
    ];
    const data = _buildPieData(items);
    const gas = data.find(d => d.name === 'Gas');
    const wind = data.find(d => d.name === 'Wind');
    expect(gas.value).toBe(500);
    expect(wind.value).toBe(300);
  });

  it('orders by FUEL_ORDER then alphabetical extras', () => {
    const items = [
      { fuelType: 'Zebra Fuel', supply: 10 },
      { fuelType: 'Wind', supply: 100 },
      { fuelType: 'Black coal', supply: 200 },
    ];
    const data = _buildPieData(items);
    expect(data[0].name).toBe('Black coal');
    expect(data[1].name).toBe('Wind');
    expect(data[2].name).toBe('Zebra Fuel');
  });

  it('assigns colors from fuelColors theme', () => {
    const items = [{ fuelType: 'Solar', supply: 100 }];
    const data = _buildPieData(items);
    expect(data[0].itemStyle.color).toBe('#FFD565');
  });

  it('falls back to default color for unknown fuels', () => {
    const items = [{ fuelType: 'Unknown', supply: 50 }];
    const data = _buildPieData(items);
    expect(data[0].itemStyle.color).toBe('#6b778c');
  });
});

describe('FuelMix buildOptionCompare', () => {
  it('creates side-by-side pie series for each region', () => {
    const regionsData = [
      { label: 'NSW', items: [{ fuelType: 'Gas', supply: 500, state: 'NSW1' }], region: 'NSW1' },
      { label: 'VIC', items: [{ fuelType: 'Wind', supply: 300, state: 'VIC1' }], region: 'VIC1' },
    ];
    const opt = buildFuelCompare(regionsData);
    expect(opt.series).toHaveLength(2);
    expect(opt.title).toHaveLength(2);
    expect(opt.title[0].text).toBe('NSW');
    expect(opt.title[1].text).toBe('VIC');
  });

  it('positions pies evenly across width', () => {
    const regionsData = [
      { label: 'A', items: [{ fuelType: 'Gas', supply: 100, state: 'A' }], region: 'A' },
      { label: 'B', items: [{ fuelType: 'Gas', supply: 100, state: 'B' }], region: 'B' },
      { label: 'C', items: [{ fuelType: 'Gas', supply: 100, state: 'C' }], region: 'C' },
    ];
    const opt = buildFuelCompare(regionsData);
    // 3 pies: 25%, 50%, 75%
    expect(opt.series[0].center[0]).toBe('25.0%');
    expect(opt.series[1].center[0]).toBe('50.0%');
    expect(opt.series[2].center[0]).toBe('75.0%');
  });

  it('shrinks radius for more than 2 regions', () => {
    const make = (label) => ({ label, items: [{ fuelType: 'Gas', supply: 100, state: label }], region: label });
    const opt2 = buildFuelCompare([make('A'), make('B')]);
    const opt4 = buildFuelCompare([make('A'), make('B'), make('C'), make('D')]);
    // 2 regions: outer 55%, 4 regions: outer 38%
    expect(opt2.series[0].radius[1]).toBe('55%');
    expect(opt4.series[0].radius[1]).toBe('38%');
  });

  it('shows total MW in subtitle for each region', () => {
    const regionsData = [
      { label: 'NSW', items: [{ fuelType: 'Gas', supply: 1234, state: 'NSW1' }], region: 'NSW1' },
    ];
    const opt = buildFuelCompare(regionsData);
    expect(opt.title[0].subtext).toBe('1,234 MW');
  });

  it('passes NEM items unfiltered for NEM aggregate', () => {
    const regionsData = [{
      label: 'NEM',
      items: [
        { fuelType: 'Gas', supply: 500, state: 'NSW1' },
        { fuelType: 'Wind', supply: 300, state: 'VIC1' },
      ],
      region: 'NEM',
    }];
    const opt = buildFuelCompare(regionsData);
    const total = opt.series[0].data.reduce((s, d) => s + d.value, 0);
    expect(total).toBe(800);
  });
});

// ── RenewablePenetration helpers ────────────────────────────────────

describe('RenewablePenetration calcRenewable', () => {
  it('classifies known renewable fuel types', () => {
    const items = [
      { fuelType: 'Wind', supply: 100 },
      { fuelType: 'Solar', supply: 200 },
      { fuelType: 'Gas', supply: 500 },
    ];
    const { renewable, nonRenewable } = _calcRenewable(items);
    expect(renewable).toBe(300);
    expect(nonRenewable).toBe(500);
  });

  it('treats Dpv and Distributed PV as renewable', () => {
    const items = [
      { fuelType: 'Dpv', supply: 50 },
      { fuelType: 'Distributed PV', supply: 30 },
    ];
    const { renewable, nonRenewable } = _calcRenewable(items);
    expect(renewable).toBe(80);
    expect(nonRenewable).toBe(0);
  });

  it('returns zeros for empty array', () => {
    const { renewable, nonRenewable } = _calcRenewable([]);
    expect(renewable).toBe(0);
    expect(nonRenewable).toBe(0);
  });
});

describe('RenewablePenetration buildOptionCompare', () => {
  it('creates side-by-side donut charts', () => {
    const regionsData = [
      { label: 'NSW', items: [{ fuelType: 'Wind', supply: 100, state: 'NSW1' }, { fuelType: 'Gas', supply: 200, state: 'NSW1' }], region: 'NSW1' },
      { label: 'VIC', items: [{ fuelType: 'Solar', supply: 300, state: 'VIC1' }, { fuelType: 'Gas', supply: 100, state: 'VIC1' }], region: 'VIC1' },
    ];
    const opt = buildRenewableCompare(regionsData);
    expect(opt.series).toHaveLength(2);
    expect(opt.title).toHaveLength(2);
  });

  it('shows percentage in title text', () => {
    const regionsData = [{
      label: 'NSW',
      items: [
        { fuelType: 'Wind', supply: 250, state: 'NSW1' },
        { fuelType: 'Gas', supply: 750, state: 'NSW1' },
      ],
      region: 'NSW1',
    }];
    const opt = buildRenewableCompare(regionsData);
    expect(opt.title[0].text).toBe('25.0%');
    expect(opt.title[0].subtext).toContain('NSW');
  });

  it('each pie has exactly 2 segments (renewable + non-renewable)', () => {
    const regionsData = [{
      label: 'SA',
      items: [
        { fuelType: 'Wind', supply: 500, state: 'SA1' },
        { fuelType: 'Solar', supply: 200, state: 'SA1' },
        { fuelType: 'Gas', supply: 300, state: 'SA1' },
      ],
      region: 'SA1',
    }];
    const opt = buildRenewableCompare(regionsData);
    expect(opt.series[0].data).toHaveLength(2);
    expect(opt.series[0].data[0].name).toBe('Renewable');
    expect(opt.series[0].data[0].value).toBe(700);
    expect(opt.series[0].data[1].name).toBe('Non-renewable');
    expect(opt.series[0].data[1].value).toBe(300);
  });
});
