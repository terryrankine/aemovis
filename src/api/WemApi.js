/**
 * WEM (Wholesale Electricity Market — WA) data client.
 *
 * Fetches CSV files from data.wa.aemo.com.au.
 * CORS is open (Access-Control-Allow-Origin: *), but the IIS server
 * rejects fetch's default Accept header with 406. We send a browser-style
 * Accept header to work around this.
 * Uses PapaParse for CSV parsing.
 * Every public method returns { data, error } for consistency.
 */
import Papa from 'papaparse';
import { WEM_BASE } from './config.js';

/** Accept header that the WEM IIS server will tolerate */
const ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

class WemApi {
  constructor() {
    this.base = WEM_BASE;
  }

  /**
   * Fetch a CSV endpoint and parse with PapaParse.
   * @returns {{ data: object[]|null, error: string|null }}
   */
  async _getCsv(path, signal) {
    try {
      const res = await fetch(`${this.base}/${path}`, {
        signal,
        headers: { 'Accept': ACCEPT },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      const result = Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });
      if (result.errors.length > 0) {
        console.warn(`[WemApi] CSV parse warnings for ${path}:`, result.errors);
      }
      return { data: result.data, error: null };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.error(`[WemApi] ${path}:`, err);
      return { data: null, error: err.message };
    }
  }

  // ── Pulse (near-real-time price, demand, gen, outages) ────────────
  async getPulse(signal) {
    return this._getCsv('public/infographic/neartime/pulse.csv', signal);
  }

  // ── Generation (per-facility for 48 intervals) ────────────────────
  async getGeneration(signal) {
    return this._getCsv('public/infographic/generation.csv', signal);
  }

  // ── Facility metadata (fuel type, capacity, lat/lon) ──────────────
  async getFacilityMeta(signal) {
    return this._getCsv('public/infographic/facility-meta-fuelmix.csv', signal);
  }

  // ── DPV vs Operational Demand ─────────────────────────────────────
  async getDpvDemand(signal) {
    return this._getCsv('public/infographic/dpvopdemand/distributed-pv_opdemand.csv', signal);
  }

  // ── Facility intervals (last 96 × 30-min intervals, ~2 days) ────
  async getIntervals96(signal) {
    return this._getCsv('public/infographic/facility-intervals-last96.csv', signal);
  }
}

export const wemApi = new WemApi();
export default wemApi;
