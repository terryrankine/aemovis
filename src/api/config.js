/**
 * AEMO Dashboard API configuration — NEM + WEM
 */

// ── NEM (National Electricity Market) ───────────────────────────────
export const NEM_BASE = 'https://dashboards.public.aemo.com.au';
export const API_KEY  = import.meta.env.VITE_NEM_API_KEY || '';

export const NEM_REGIONS = [
  { label: 'NSW', value: 'NSW1' },
  { label: 'QLD', value: 'QLD1' },
  { label: 'VIC', value: 'VIC1' },
  { label: 'SA',  value: 'SA1'  },
  { label: 'TAS', value: 'TAS1' },
];

// ── WEM (Wholesale Electricity Market — WA) ─────────────────────────
export const WEM_BASE = 'https://data.wa.aemo.com.au';

export const WEM_REGIONS = [
  { label: 'WA', value: 'WA1' },
];

// ── Combined ────────────────────────────────────────────────────────
export const ALL_REGIONS = [...NEM_REGIONS, ...WEM_REGIONS];

export const TIMESCALES = [
  { label: 'Pre-Dispatch (30 min)', value: '30MIN' },
  { label: 'Dispatch (5 min)',      value: '5MIN'  },
];

export const FUEL_ORDER = [
  'Black coal', 'Brown coal', 'Gas', 'Hydro', 'Wind',
  'Solar', 'Battery', 'Biomass', 'Liquid Fuel',
];

// ── Polling / freshness ─────────────────────────────────────────────
export const NEM_POLL_INTERVAL   = 5 * 60 * 1000;      // 5 min
export const WEM_POLL_INTERVAL   = 30 * 60 * 1000;     // 30 min

export const NEM_FRESHNESS       = 4.5 * 60 * 1000;    // 4.5 min
export const WEM_FRESHNESS       = 25 * 60 * 1000;     // 25 min
export const WEM_GEN_FRESHNESS   = 55 * 60 * 1000;     // 55 min
export const STATIC_FRESHNESS    = 60 * 60 * 1000;     // 1 hour

// Legacy exports for backward compat during migration
export const API_BASE = NEM_BASE;
export const REGIONS  = NEM_REGIONS;
export const POLL_INTERVAL = NEM_POLL_INTERVAL;
