/**
 * Centralised polling with ref-counting.
 *
 * Pages register which atom keys they need. The poller checks freshness
 * and re-fetches stale atoms on a 60s tick. Only actively needed keys
 * are polled.
 */
import { fetchForStore } from './actions.js';

/** @type {Map<string, { atom: object, fetchFn: function, freshMs: number, refs: number }>} */
const registry = new Map();

let intervalId = null;

/**
 * Register interest in a data key. Returns an unregister function.
 *
 * @param {string} key - Human-readable key for dedup (e.g. 'nem:fuelMix')
 * @param {import('nanostores').WritableAtom} atom
 * @param {(signal: AbortSignal) => Promise<{data: any, error: string|null}>} fetchFn
 * @param {number} freshnessMs - Max age in ms before re-fetch
 * @returns {() => void} unregister function
 */
export function registerPoll(key, atom, fetchFn, freshnessMs) {
  const existing = registry.get(key);
  if (existing) {
    existing.refs++;
    return () => unregister(key);
  }

  registry.set(key, { atom, fetchFn, freshMs: freshnessMs, refs: 1 });
  return () => unregister(key);
}

function unregister(key) {
  const entry = registry.get(key);
  if (!entry) return;
  entry.refs--;
  if (entry.refs <= 0) registry.delete(key);
}

function tick() {
  const now = Date.now();
  for (const [, entry] of registry) {
    const { atom, fetchFn, freshMs } = entry;
    const { fetchedAt, status } = atom.get();
    const stale = (now - fetchedAt) > freshMs;
    if (stale && status !== 'loading') {
      fetchForStore(atom, fetchFn);
    }
  }
}

export function startPoller() {
  if (intervalId) return;
  intervalId = setInterval(tick, 60_000);
}

export function stopPoller() {
  clearInterval(intervalId);
  intervalId = null;
}
