/**
 * Chart lifecycle wrapper.
 *
 * Replaces the module-level `let chart = null` singleton pattern.
 * Each page creates a ChartController in its render function (local scope).
 * On cleanup, ctrl.dispose() handles everything.
 */
import { initChart, disposeChart } from './initChart.js';

export class ChartController {
  /** @param {HTMLElement} el - The chart container element */
  constructor(el) {
    this._el = el;
    this._chart = null;
    this._unsubs = [];
  }

  /** True if the element is still in the DOM */
  get alive() {
    return this._el && this._el.isConnected;
  }

  /**
   * Set chart option. Initialises chart on first call.
   * Checks the element is still in DOM before rendering.
   */
  async setOption(option) {
    if (!this.alive) return;
    this._chart = await initChart(this._el, this._chart);
    this._chart.setOption(option, true);
  }

  /**
   * Subscribe to a nanostores atom. When the atom changes and has data,
   * call buildFn(data) to get an ECharts option, then render it.
   *
   * @param {import('nanostores').ReadableAtom} atom
   * @param {(data: any) => object|null} buildFn - Returns ECharts option or null to skip
   * @returns {() => void} unsubscribe function
   */
  subscribe(atom, buildFn) {
    const unsub = atom.listen((state) => {
      if (!this.alive) return;
      if (state.status === 'ready' && state.data) {
        const option = buildFn(state.data);
        if (option) this.setOption(option);
      }
    });
    this._unsubs.push(unsub);
    return unsub;
  }

  /**
   * Dispose chart and unsubscribe all listeners.
   */
  dispose() {
    for (const unsub of this._unsubs) unsub();
    this._unsubs = [];
    disposeChart(this._chart);
    this._chart = null;
  }
}
