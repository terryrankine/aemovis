/**
 * NEM (National Electricity Market) REST API client.
 *
 * Refactored from AemoApi.js. Uses ky for fetch with retry/timeout.
 * Every public method returns { data, error } for consistency.
 */
import ky from 'ky';
import { NEM_BASE, API_KEY } from './config.js';

class NemApi {
  constructor() {
    // In dev, Vite proxies /NEM → AEMO, so use '' as prefixUrl.
    const isDev = import.meta.env?.DEV;
    this.client = ky.create({
      prefixUrl: isDev ? '' : NEM_BASE,
      headers: { 'x-api-key': API_KEY },
      retry: { limit: 1, statusCodes: [500, 502, 503, 504] },
      timeout: 15_000,
    });
  }

  async _get(path, signal) {
    try {
      // ky expects path without leading slash when using prefixUrl
      const json = await this.client.get(path, { signal }).json();
      return { data: json.data, error: null };
    } catch (err) {
      if (err.name === 'AbortError') throw err; // let caller handle abort
      console.error(`[NemApi] ${path}:`, err);
      return { data: null, error: err.message };
    }
  }

  // ── 1. Dispatch Overview ──────────────────────────────────────────
  async getElecSummary(signal) {
    const { data, error } = await this._get('NEM/v1/PWS/NEMDashboard/elecSummary', signal);
    if (error) return { data: null, error };

    const summary = (data.summary || []).map(r => ({
      ...r,
      interconnectorFlows: JSON.parse(r.interconnectorFlows || '[]'),
    }));
    return { data: { summary, prices: data.prices || [] }, error: null };
  }

  // ── 2. Price & Demand ─────────────────────────────────────────────
  async getPriceAndDemand(timescale = '30MIN', signal) {
    return this._get(`NEM/v1/PWS/NEMDashboard/priceAndDemand?timescale=${timescale}`, signal);
  }

  // ── 3. Cumulative Price ───────────────────────────────────────────
  async getCumulativePrice(signal) {
    return this._get('NEM/v1/PWS/NEMDashboard/cumulativePrice', signal);
  }

  // ── 4. Market Price Limits ────────────────────────────────────────
  async getMarketPriceLimits(signal) {
    const { data, error } = await this._get('NEM/v1/PWS/NEMDashboard/marketPriceLimits', signal);
    if (error) return { data: null, error };
    const map = {};
    for (const { key, value } of data.items || []) map[key] = value;
    return { data: map, error: null };
  }

  // ── 5. Fuel Mix ───────────────────────────────────────────────────
  async getFuelMix(type = 'CURRENT', signal) {
    return this._get(`NEM/v1/PWS/NEMDashboard/fuelMix?type=${type}`, signal);
  }

  // ── 6. Average Price ──────────────────────────────────────────────
  async getDailyAveragePrices(year, month, signal) {
    const mm = String(month).padStart(2, '0');
    return this._get(`NEM/v1/PWS/NEMDashboard/dailyAveragePrices?year=${year}&month=${mm}`, signal);
  }

  // ── 7. Seven-Day Outlook ──────────────────────────────────────────
  async getSevenDayOutlook(signal) {
    const { data, error } = await this._get('NEM/v1/PWS/NEMDashboard/sevenDayOutlook', signal);
    if (error) return { data: null, error };

    const pivot = {};
    for (const row of data.items || []) {
      const d = row.prettyDate;
      pivot[d] ??= {};
      pivot[d][row.regionId] ??= {};
      pivot[d][row.regionId][row.dataType] = row.dataValue;
    }
    return { data: { raw: data.items, pivot }, error: null };
  }
}

export const nemApi = new NemApi();
export default nemApi;
