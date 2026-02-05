/**
 * Fetch orchestration with per-key AbortController.
 *
 * fetchForStore(atom, fetchFn) runs the fetch, manages loading state,
 * and preserves stale data on error for graceful degradation.
 */

/** Map<atom, AbortController> — one in-flight controller per atom */
const controllers = new Map();

/**
 * Fetch data and write result into a nanostores atom.
 *
 * @param {import('nanostores').WritableAtom} atom
 * @param {(signal: AbortSignal) => Promise<{data: any, error: string|null}>} fetchFn
 * @returns {Promise<void>}
 */
export async function fetchForStore(atom, fetchFn) {
  // Abort any in-flight request for this atom
  controllers.get(atom)?.abort();

  const ac = new AbortController();
  controllers.set(atom, ac);

  const prev = atom.get();
  atom.set({ ...prev, status: 'loading', error: null });

  try {
    const { data, error } = await fetchFn(ac.signal);

    // If this controller was replaced (another fetch started), bail
    if (controllers.get(atom) !== ac) return;

    if (error) {
      // Keep previous data for graceful degradation
      atom.set({ data: prev.data, error, fetchedAt: prev.fetchedAt, status: 'error' });
    } else {
      atom.set({ data, error: null, fetchedAt: Date.now(), status: 'ready' });
    }
  } catch (err) {
    // AbortError is expected when a newer fetch replaces this one
    if (err.name === 'AbortError') return;
    if (controllers.get(atom) !== ac) return;

    atom.set({ data: prev.data, error: err.message, fetchedAt: prev.fetchedAt, status: 'error' });
  } finally {
    if (controllers.get(atom) === ac) controllers.delete(atom);
  }
}

/**
 * Fetch only if atom data is stale (older than freshnessMs) or missing.
 * Prevents redundant re-fetches when navigating between tabs.
 *
 * @param {import('nanostores').WritableAtom} atom
 * @param {(signal: AbortSignal) => Promise<{data: any, error: string|null}>} fetchFn
 * @param {number} freshnessMs - Max age in ms before data is considered stale
 * @returns {Promise<void>|undefined}
 */
export function fetchIfStale(atom, fetchFn, freshnessMs) {
  const { fetchedAt, status } = atom.get();
  if (status === 'loading') return;
  if (fetchedAt && (Date.now() - fetchedAt) < freshnessMs) return;
  return fetchForStore(atom, fetchFn);
}

/**
 * Abort all in-flight requests. Called on app teardown.
 */
export function abortAll() {
  for (const ac of controllers.values()) ac.abort();
  controllers.clear();
}
