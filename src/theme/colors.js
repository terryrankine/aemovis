/**
 * AEMO GEL Design System — color tokens
 * Extracted from dashboards.public.aemo.com.au CSS custom properties
 */

// ── Primary purple ramp ──────────────────────────────────────────────
export const primary = {
  900: '#281631',
  800: '#3C1053',
  700: '#502252',
  600: '#6C3078',
  500: '#6C3078', // alias — main brand
  400: '#b056bc',
  300: '#cc8acf',
  200: '#e8cbea',
  100: '#ede9ed',
};

// ── Secondary palette ────────────────────────────────────────────────
export const red     = { 500: '#d4254e', 300: '#dd4e70', 200: '#e77892', 100: '#feefef' };
export const denim   = { 500: '#3379bf', 300: '#5493d1' };
export const green   = { 500: '#467822', 300: '#5d9f2d', 200: '#93be74', 100: '#ecf7e3' };
export const orange  = { 500: '#da2901', 300: '#f9b067', 200: '#fee2bf', 100: '#fff4ec' };
export const blue    = { 500: '#5666bc', 300: '#7384d2', 200: '#a0abd9', 100: '#f4fbfc' };
export const yellow  = '#ffd565';
export const aqua    = '#85cee2';
export const violet  = { 900: '#282b3e', 500: '#777da7' };
export const teal    = '#34b9b3';

// ── Neutrals (slate) ────────────────────────────────────────────────
export const slate = {
  1100: '#121417',
  1000: '#1d2026',
  900:  '#282c34',
  800:  '#333842',
  700:  '#434b58',
  600:  '#545d6e',
  500:  '#6b778c',
  400:  '#9ea6b5',
  300:  '#d2d6dd',
  200:  '#dcdfe4',
  100:  '#f1f2f3',
  50:   '#fafafa',
};

// ── Fuel‑type colours (from AEMO config.json) ────────────────────────
export const fuel = {
  'Black coal':      '#333536',
  'Brown coal':      '#97785c',
  'Coal':            '#333536',
  'Gas':             '#34b9b3',
  'Natural Gas (Pipeline)': '#34b9b3',
  'Coal seam methane': '#34b9b3',
  'Hydro':           '#ADE0EE',
  'Wind':            '#A1D978',
  'Solar':           '#FFD565',
  'Utility-scale Solar': '#FFD565',
  'Rooftop PV':      '#FFED90',
  'Distributed PV':  '#FFED90',
  'Dpv':             '#FFD565',
  'Battery':         '#B056BC',
  'Battery Storage':  '#B056BC',
  'Biomass':         '#A82140',
  'Liquid Fuel':     '#FE5F55',
  'Diesel oil':      '#FE5F55',
  'Distillate':      '#FE5F55',
  'Kerosene - non aviation': '#FE5F55',
  'Renewables':      '#e1ee8e',
  'Demand side':     '#5666bc',
  'Battery load':    '#d77ee2',
  'VPP Battery load': '#e2a8ea',
  'Landfill gas':    '#5cdcd6',
};

// ── Chart series palette (for region lines etc.) ─────────────────────
export const regionColors = {
  NSW1: '#3379bf',
  QLD1: '#d4254e',
  VIC1: '#6C3078',
  SA1:  '#f9b067',
  TAS1: '#467822',
  WA1:  '#E67E22',
};

// ── ESS / WEM-specific series colours ──────────────────────────────
export const essColors = {
  energy:    '#d4254e',
  regRaise:  '#3379bf',
  regLower:  '#5493d1',
  contRaise: '#467822',
  contLower: '#5d9f2d',
  rocof:     '#f9b067',
};

// ── Outage type colours ────────────────────────────────────────────
export const outageColors = {
  planned:       '#3379bf',
  forced:        '#d4254e',
  consequential: '#f9b067',
};

// ── Semantic tokens ──────────────────────────────────────────────────
export const background = '#ffffff';
export const surface    = slate[50];
export const border     = slate[300];
export const textPrimary   = slate[1100];
export const textSecondary = slate[600];
export const link       = denim[500];

// ── Price status ─────────────────────────────────────────────────────
export const priceFirm      = teal;
export const priceForcast   = primary[400];
export const demandActual   = aqua;
export const demandForecast = primary[300];

// ── Fonts ────────────────────────────────────────────────────────────
export const fontFamily = '"AvenirLT-Roman", "AvenirLT-Medium", "Trebuchet MS", Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif';
export const fontFamilyMono = 'Courier, monospace';
