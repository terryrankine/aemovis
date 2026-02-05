import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { atom } from 'nanostores';
import { registerPoll, startPoller, stopPoller } from './poller.js';

// Mock fetchForStore to avoid real network calls
vi.mock('./actions.js', () => ({
  fetchForStore: vi.fn(),
}));

import { fetchForStore } from './actions.js';

function makeAtom(overrides = {}) {
  return atom({ data: null, error: null, fetchedAt: 0, status: 'idle', ...overrides });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  stopPoller();
});

afterEach(() => {
  stopPoller();
  vi.useRealTimers();
});

describe('registerPoll', () => {
  it('returns an unregister function', () => {
    const a = makeAtom();
    const unreg = registerPoll('test:key', a, vi.fn(), 60_000);
    expect(typeof unreg).toBe('function');
    unreg();
  });

  it('ref-counts duplicate registrations', () => {
    const a = makeAtom();
    const fetchFn = vi.fn();
    const unreg1 = registerPoll('test:dup', a, fetchFn, 60_000);
    const unreg2 = registerPoll('test:dup', a, fetchFn, 60_000);

    // First unregister decrements ref count
    unreg1();
    // Key should still be active (ref=1)

    startPoller();
    vi.advanceTimersByTime(60_000);
    expect(fetchForStore).toHaveBeenCalled();

    unreg2();
  });
});

describe('poller tick', () => {
  it('fetches stale atoms on tick', () => {
    const a = makeAtom();
    a.set({ data: 'old', error: null, fetchedAt: Date.now() - 120_000, status: 'ready' });

    const fetchFn = vi.fn();
    const unreg = registerPoll('test:stale', a, fetchFn, 60_000);

    startPoller();
    vi.advanceTimersByTime(60_000);

    expect(fetchForStore).toHaveBeenCalledWith(a, fetchFn);
    unreg();
  });

  it('skips fresh atoms on tick', () => {
    const a = makeAtom();
    a.set({ data: 'fresh', error: null, fetchedAt: Date.now(), status: 'ready' });

    const fetchFn = vi.fn();
    const unreg = registerPoll('test:fresh', a, fetchFn, 60_000);

    startPoller();
    vi.advanceTimersByTime(60_000);

    expect(fetchForStore).not.toHaveBeenCalled();
    unreg();
  });

  it('skips atoms with status loading', () => {
    const a = makeAtom();
    a.set({ data: null, error: null, fetchedAt: 0, status: 'loading' });

    const fetchFn = vi.fn();
    const unreg = registerPoll('test:loading', a, fetchFn, 60_000);

    startPoller();
    vi.advanceTimersByTime(60_000);

    expect(fetchForStore).not.toHaveBeenCalled();
    unreg();
  });
});
