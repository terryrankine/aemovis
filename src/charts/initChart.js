import * as echarts from 'echarts';

/**
 * Safely initialise (or reuse) an ECharts instance on `el`.
 * Waits one animation frame so the container has layout dimensions.
 *
 * Returns a Promise<echarts.ECharts>.
 */
export function initChart(el, existingChart) {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      if (existingChart && !existingChart.isDisposed()) {
        existingChart.resize();
        resolve(existingChart);
        return;
      }
      // Reuse any existing instance on this DOM element to avoid warnings
      const existing = echarts.getInstanceByDom(el);
      if (existing && !existing.isDisposed()) {
        existing.resize();
        resolve(existing);
        return;
      }
      const c = echarts.init(el, 'aemo');
      const onResize = () => { if (!c.isDisposed()) c.resize(); };
      window.addEventListener('resize', onResize);
      // Attach disposer so callers can clean up the listener
      c._removeResizeListener = () => window.removeEventListener('resize', onResize);
      resolve(c);
    });
  });
}

/**
 * Dispose chart and remove its resize listener.
 */
export function disposeChart(chart) {
  if (!chart) return;
  chart._removeResizeListener?.();
  if (!chart.isDisposed()) chart.dispose();
}
