/**
 * Custom ECharts theme using AEMO GEL design tokens.
 * Register once at app startup: echarts.registerTheme('aemo', aemoTheme)
 */
import { primary, denim, red, green, orange, blue, teal, slate, fontFamily } from './colors.js';

const aemoTheme = {
  color: [
    denim[500],   // #3379bf
    red[500],     // #d4254e
    primary[600], // #6C3078
    orange[300],  // #f9b067
    green[500],   // #467822
    blue[500],    // #5666bc
    teal,         // #34b9b3
    primary[400], // #b056bc
    green[300],   // #5d9f2d
    red[300],     // #dd4e70
  ],
  backgroundColor: 'transparent',
  textStyle: { fontFamily },
  title: {
    textStyle:    { color: slate[1100], fontFamily },
    subtextStyle: { color: slate[600],  fontFamily },
  },
  legend: {
    textStyle: { color: slate[700] },
  },
  tooltip: {
    backgroundColor: 'rgba(40,44,52,0.92)',
    borderColor: slate[700],
    textStyle: { color: '#fff', fontSize: 12 },
  },
  categoryAxis: {
    axisLine:  { lineStyle: { color: slate[300] } },
    axisTick:  { lineStyle: { color: slate[300] } },
    axisLabel: { color: slate[600] },
    splitLine: { lineStyle: { color: slate[100] } },
  },
  valueAxis: {
    axisLine:  { lineStyle: { color: slate[300] } },
    axisTick:  { lineStyle: { color: slate[300] } },
    axisLabel: { color: slate[600] },
    splitLine: { lineStyle: { color: slate[100] } },
  },
  timeAxis: {
    axisLine:  { lineStyle: { color: slate[300] } },
    axisTick:  { lineStyle: { color: slate[300] } },
    axisLabel: { color: slate[600] },
    splitLine: { lineStyle: { color: slate[100] } },
  },
  line: {
    smooth: false,
    symbol: 'none',
    lineStyle: { width: 2 },
  },
  bar: {
    barMaxWidth: 40,
    itemStyle: { borderRadius: [2, 2, 0, 0] },
  },
  pie: {
    itemStyle: { borderColor: '#fff', borderWidth: 1 },
  },
};

export default aemoTheme;
