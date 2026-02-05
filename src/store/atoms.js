/**
 * Reactive data atoms for all NEM and WEM data keys.
 *
 * Each atom holds { data, error, fetchedAt, status } where:
 *   status: 'idle' | 'loading' | 'ready' | 'error'
 *   data: parsed API response (kept on error for graceful degradation)
 *   error: error message string or null
 *   fetchedAt: Date.now() of last successful fetch
 */
import { atom } from 'nanostores';

const INITIAL = { data: null, error: null, fetchedAt: 0, status: 'idle' };

const make = () => atom({ ...INITIAL });

// ── NEM atoms ───────────────────────────────────────────────────────
export const nemElecSummary       = make();
export const nemPriceAndDemand30  = make();
export const nemPriceAndDemand5   = make();
export const nemCumulativePrice   = make();
export const nemMarketPriceLimits = make();
export const nemFuelMix           = make();
export const nemSevenDayOutlook   = make();

// Daily average prices are keyed by year-month, so we use a Map-backed
// factory. Pages call getDailyPriceAtom(year, month).
const dailyPriceAtoms = new Map();
export function getDailyPriceAtom(year, month) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  if (!dailyPriceAtoms.has(key)) dailyPriceAtoms.set(key, make());
  return dailyPriceAtoms.get(key);
}

// ── WEM atoms ───────────────────────────────────────────────────────
export const wemPulse              = make();
export const wemGeneration         = make();
export const wemFacilityMeta       = make();
export const wemDpvDemand          = make();

// ── Lookup table: string key → atom ─────────────────────────────────
// Used by poller to iterate active keys.
export const ATOM_REGISTRY = {
  'nem:elecSummary':        nemElecSummary,
  'nem:priceAndDemand:30':  nemPriceAndDemand30,
  'nem:priceAndDemand:5':   nemPriceAndDemand5,
  'nem:cumulativePrice':    nemCumulativePrice,
  'nem:marketPriceLimits':  nemMarketPriceLimits,
  'nem:fuelMix':            nemFuelMix,
  'nem:sevenDayOutlook':    nemSevenDayOutlook,
  'wem:pulse':              wemPulse,
  'wem:generation':         wemGeneration,
  'wem:facilityMeta':       wemFacilityMeta,
  'wem:dpvDemand':          wemDpvDemand,
};
