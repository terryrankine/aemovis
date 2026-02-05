import { describe, it, expect, vi, beforeEach } from 'vitest';
import { atom } from 'nanostores';
import { fetchForStore, fetchIfStale } from './actions.js';

function makeAtom() {
  return atom({ data: null, error: null, fetchedAt: 0, status: 'idle' });
}

describe('fetchForStore', () => {
  it('sets status to ready on successful fetch', async () => {
    const a = makeAtom();
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [1, 2] }, error: null });

    await fetchForStore(a, fetchFn);

    const state = a.get();
    expect(state.status).toBe('ready');
    expect(state.data).toEqual({ items: [1, 2] });
    expect(state.error).toBeNull();
    expect(state.fetchedAt).toBeGreaterThan(0);
  });

  it('sets status to error on fetch failure, preserves previous data', async () => {
    const a = makeAtom();
    a.set({ data: { old: true }, error: null, fetchedAt: 100, status: 'ready' });

    const fetchFn = vi.fn().mockResolvedValue({ data: null, error: 'Network error' });

    await fetchForStore(a, fetchFn);

    const state = a.get();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Network error');
    expect(state.data).toEqual({ old: true }); // preserved
    expect(state.fetchedAt).toBe(100); // preserved
  });

  it('handles thrown errors gracefully', async () => {
    const a = makeAtom();
    const fetchFn = vi.fn().mockRejectedValue(new Error('Boom'));

    await fetchForStore(a, fetchFn);

    const state = a.get();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Boom');
  });

  it('ignores AbortError silently', async () => {
    const a = makeAtom();
    const abortErr = new DOMException('Aborted', 'AbortError');
    const fetchFn = vi.fn().mockRejectedValue(abortErr);

    await fetchForStore(a, fetchFn);

    // Status should still be loading (not error) because abort was ignored
    // But since the controller check fails, it stays as whatever the prev state transitions to
    const state = a.get();
    expect(state.status).not.toBe('error');
  });

  it('aborts previous in-flight request when called again', async () => {
    const a = makeAtom();
    let capturedSignal;
    const slowFetch = vi.fn((signal) => {
      capturedSignal = signal;
      return new Promise((resolve) => setTimeout(() => resolve({ data: 'slow', error: null }), 1000));
    });
    const fastFetch = vi.fn().mockResolvedValue({ data: 'fast', error: null });

    const p1 = fetchForStore(a, slowFetch);
    const p2 = fetchForStore(a, fastFetch);

    await Promise.all([p1, p2]);

    expect(capturedSignal.aborted).toBe(true);
    expect(a.get().data).toBe('fast');
  });

  it('passes AbortSignal to fetchFn', async () => {
    const a = makeAtom();
    const fetchFn = vi.fn().mockResolvedValue({ data: 'ok', error: null });

    await fetchForStore(a, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});

describe('fetchIfStale', () => {
  it('fetches when atom has no data (fetchedAt = 0)', async () => {
    const a = makeAtom();
    const fetchFn = vi.fn().mockResolvedValue({ data: 'new', error: null });

    await fetchIfStale(a, fetchFn, 60_000);

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(a.get().data).toBe('new');
  });

  it('skips fetch when data is still fresh', async () => {
    const a = makeAtom();
    a.set({ data: 'cached', error: null, fetchedAt: Date.now(), status: 'ready' });

    const fetchFn = vi.fn().mockResolvedValue({ data: 'new', error: null });

    await fetchIfStale(a, fetchFn, 60_000);

    expect(fetchFn).not.toHaveBeenCalled();
    expect(a.get().data).toBe('cached');
  });

  it('fetches when data is stale (older than freshness threshold)', async () => {
    const a = makeAtom();
    a.set({ data: 'old', error: null, fetchedAt: Date.now() - 120_000, status: 'ready' });

    const fetchFn = vi.fn().mockResolvedValue({ data: 'refreshed', error: null });

    await fetchIfStale(a, fetchFn, 60_000);

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(a.get().data).toBe('refreshed');
  });

  it('skips fetch when status is loading', async () => {
    const a = makeAtom();
    a.set({ data: null, error: null, fetchedAt: 0, status: 'loading' });

    const fetchFn = vi.fn().mockResolvedValue({ data: 'new', error: null });

    await fetchIfStale(a, fetchFn, 60_000);

    expect(fetchFn).not.toHaveBeenCalled();
  });
});
