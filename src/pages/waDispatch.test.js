import { describe, it, expect } from 'vitest';
import { buildOption } from './WaDispatch.js';

describe('WaDispatch buildOption', () => {
  const makeStack = () => ({
    periods: ['2026-02-04 08:00:00', '2026-02-04 08:30:00'],
    seriesByFuel: {
      'Coal': [200, 210],
      'Wind': [150, 160],
      'Gas':  [100, 90],
    },
    totalByPeriod: [450, 460],
  });

  it('creates one area series per fuel type', () => {
    const opt = buildOption(makeStack(), null);
    const fuelSeries = opt.series.filter(s => s.stack === 'generation');
    expect(fuelSeries).toHaveLength(3);

    const names = fuelSeries.map(s => s.name);
    expect(names).toContain('Coal');
    expect(names).toContain('Wind');
    expect(names).toContain('Gas');
  });

  it('stacks all generation series', () => {
    const opt = buildOption(makeStack(), null);
    const fuelSeries = opt.series.filter(s => s.stack === 'generation');
    for (const s of fuelSeries) {
      expect(s.stack).toBe('generation');
      expect(s.areaStyle).toBeDefined();
    }
  });

  it('orders fuels by FUEL_ORDER', () => {
    const opt = buildOption(makeStack(), null);
    const fuelSeries = opt.series.filter(s => s.stack === 'generation');
    const names = fuelSeries.map(s => s.name);
    // FUEL_ORDER: Gas before Wind before Coal? No — Coal before Gas before Wind
    // FUEL_ORDER = ['Black coal','Brown coal','Gas','Hydro','Wind','Solar','Battery','Biomass','Liquid Fuel']
    // Coal maps to 'Coal' — not in FUEL_ORDER (it has 'Black coal', 'Brown coal')
    // So Gas and Wind are from FUEL_ORDER, Coal goes to extras
    expect(names.indexOf('Gas')).toBeLessThan(names.indexOf('Wind'));
  });

  it('applies fuel colors from theme', () => {
    const opt = buildOption(makeStack(), null);
    const windSeries = opt.series.find(s => s.name === 'Wind');
    expect(windSeries.itemStyle.color).toBe('#A1D978');
  });

  it('uses fallback color for unknown fuels', () => {
    const stack = {
      periods: ['2026-02-04 08:00:00'],
      seriesByFuel: { 'ZebraFuel': [42] },
      totalByPeriod: [42],
    };
    const opt = buildOption(stack, null);
    const s = opt.series.find(s => s.name === 'ZebraFuel');
    expect(s.itemStyle.color).toBe('#6b778c');
  });

  it('adds price line on secondary y-axis when priceSeries provided', () => {
    const prices = [
      { settlementDate: '2026-02-04 08:00:00', rrp: 45.0 },
      { settlementDate: '2026-02-04 08:30:00', rrp: 50.0 },
    ];
    const opt = buildOption(makeStack(), prices);
    const priceLine = opt.series.find(s => s.name === 'Price');
    expect(priceLine).toBeDefined();
    expect(priceLine.yAxisIndex).toBe(1);
    expect(priceLine.lineStyle.color).toBe('#d4254e');
  });

  it('omits price series when priceSeries is null', () => {
    const opt = buildOption(makeStack(), null);
    const priceLine = opt.series.find(s => s.name === 'Price');
    expect(priceLine).toBeUndefined();
  });

  it('omits price series when priceSeries is empty', () => {
    const opt = buildOption(makeStack(), []);
    const priceLine = opt.series.find(s => s.name === 'Price');
    expect(priceLine).toBeUndefined();
  });

  it('has dual y-axes (MW left, $/MWh right)', () => {
    const opt = buildOption(makeStack(), null);
    expect(opt.yAxis).toHaveLength(2);
    expect(opt.yAxis[0].name).toBe('MW');
    expect(opt.yAxis[0].position).toBe('left');
    expect(opt.yAxis[1].name).toBe('$/MWh');
    expect(opt.yAxis[1].position).toBe('right');
  });

  it('uses time xAxis', () => {
    const opt = buildOption(makeStack(), null);
    expect(opt.xAxis.type).toBe('time');
  });

  it('omits price series when price dates are outside generation range', () => {
    const prices = [
      { settlementDate: '2026-03-01 08:00:00', rrp: 45.0 },
      { settlementDate: '2026-03-01 08:30:00', rrp: 50.0 },
    ];
    const opt = buildOption(makeStack(), prices);
    const priceLine = opt.series.find(s => s.name === 'Price');
    expect(priceLine).toBeUndefined();
  });

  it('includes only price points within generation time range', () => {
    const prices = [
      { settlementDate: '2026-02-03 08:00:00', rrp: 40.0 },  // before range
      { settlementDate: '2026-02-04 08:00:00', rrp: 45.0 },  // in range
      { settlementDate: '2026-02-04 08:30:00', rrp: 50.0 },  // in range
      { settlementDate: '2026-02-05 08:00:00', rrp: 55.0 },  // after range
    ];
    const opt = buildOption(makeStack(), prices);
    const priceLine = opt.series.find(s => s.name === 'Price');
    expect(priceLine).toBeDefined();
    expect(priceLine.data).toHaveLength(2);
    expect(priceLine.data[0][1]).toBe(45.0);
    expect(priceLine.data[1][1]).toBe(50.0);
  });

  it('puts Other fuel last', () => {
    const stack = {
      periods: ['2026-02-04 08:00:00'],
      seriesByFuel: {
        'Other': [10],
        'Wind': [100],
        'Gas': [50],
      },
      totalByPeriod: [160],
    };
    const opt = buildOption(stack, null);
    const fuelSeries = opt.series.filter(s => s.stack === 'generation');
    const names = fuelSeries.map(s => s.name);
    expect(names[names.length - 1]).toBe('Other');
  });
});
