# AEMOVis Architecture

## Overview

AEMOVis is a single-page vanilla JS application that visualises Australian
electricity market data from both the **NEM** (National Electricity Market —
NSW, QLD, VIC, SA, TAS) and the **WEM** (Wholesale Electricity Market — WA).

**10 chart pages** total: 7 existing NEM charts extended with WA data, plus
3 new WEM-only visualisations.

---

## Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Build | Vite 7 | Fast dev server, ESM-native |
| Charts | ECharts 6 | Already in use, full-featured |
| State | **nanostores** (298 B) | Tiny reactive atoms with `get`/`set`/`subscribe` |
| HTTP | **ky** (3.3 KB) | Fetch wrapper with retry, timeout, AbortController |
| CSV | **papaparse** (6.7 KB) | RFC 4180-compliant CSV parsing with dynamic typing |

Total new dependency cost: ~10.3 KB gzipped.

---

## Data Sources

### NEM — JSON REST API (existing)

- **Base URL**: `https://dashboards.public.aemo.com.au`
- **Auth**: `x-api-key: 0ae2748cec08449bb5b3b31b577f71e2` (public, static)
- **CORS**: Proxied through Vite dev server (`/NEM → AEMO`)
- **Cycle**: 5-min dispatch intervals
- **Endpoints**:

| Endpoint | Data | Used By |
|----------|------|---------|
| `elecSummary` | Per-region price, demand, gen, interconnectors | Dispatch Overview |
| `priceAndDemand` | Time-series RRP + demand (actual/forecast) | Price & Demand |
| `cumulativePrice` | Cumulative price per region (~7 days) | Cumulative Price |
| `marketPriceLimits` | APC, CPT, MPC thresholds | Price & Demand, Cumulative Price |
| `fuelMix` | Generation by fuel type per region | Fuel Mix, Renewable Penetration |
| `dailyAveragePrices` | Daily averages for a month | Average Price |
| `sevenDayOutlook` | Forecast demand/capacity/interchange | 7-Day Outlook |

### WEM — Public CSV + JSON (new, no auth)

- **Base URL**: `https://data.wa.aemo.com.au`
- **Auth**: None required
- **CORS**: Open (no proxy needed)
- **Cycle**: 30-min trading intervals

| File | URL Path | Content | Update Freq |
|------|----------|---------|-------------|
| pulse.csv | `/public/infographic/neartime/pulse.csv` | Price, demand, gen, outages (~4 days) | ~30 min |
| generation.csv | `/public/infographic/generation.csv` | Per-facility gen for 48 intervals | Daily |
| facility-meta-fuelmix.csv | `/public/infographic/facility-meta-fuelmix.csv` | Facility → fuel type + lat/lon | ~Monthly |
| distributed-pv_opdemand.csv | `/public/infographic/dpvopdemand/distributed-pv_opdemand.csv` | DPV generation vs operational demand | Periodic |

---

## Architecture

### Directory Structure

```
src/
├── api/
│   ├── config.js          # NEM + WEM constants, regions, poll intervals
│   ├── NemApi.js           # NEM REST client (refactored from AemoApi.js, uses ky)
│   ├── WemApi.js           # WEM CSV/JSON client (uses ky + papaparse)
│   └── wemTransform.js     # WEM data normalisation (fuel mix join, pulse → price/demand)
├── store/
│   ├── atoms.js            # nanostores atoms for each data key
│   ├── actions.js          # fetch orchestration with AbortController per key
│   └── poller.js           # centralised polling with ref counting
├── charts/
│   ├── initChart.js        # ECharts init/dispose utility (unchanged)
│   └── ChartController.js  # Chart lifecycle wrapper (new)
├── pages/
│   ├── DispatchOverview.js  # NEM + WA cards
│   ├── PriceAndDemand.js    # NEM + WA time series
│   ├── CumulativePrice.js   # NEM only
│   ├── FuelMix.js           # NEM + WA donut
│   ├── RenewablePenetration.js # NEM + WA donut
│   ├── AveragePrice.js      # NEM + WA bars
│   ├── SevenDayOutlook.js   # NEM only
│   ├── WemOutages.js        # WEM only (NEW)
│   ├── EssPricing.js        # WEM only (NEW)
│   └── DpvDemand.js         # WEM only (NEW)
├── theme/
│   ├── colors.js            # AEMO GEL tokens + WA1 region color + WEM fuel colors
│   └── echarts-theme.js     # Custom ECharts theme (unchanged)
├── main.js                  # App entry, routing, theme registration, poller init
└── style.css                # Global styles
```

### 1. Reactive Store (`src/store/`)

Uses **nanostores** atoms. Each data key is an atom holding
`{ data, error, fetchedAt, status }`.

```
atoms.js — one atom per data key:
  nem:elecSummary, nem:priceAndDemand:30MIN, nem:priceAndDemand:5MIN,
  nem:cumulativePrice, nem:marketPriceLimits, nem:fuelMix,
  nem:dailyAveragePrices:{year}-{month}, nem:sevenDayOutlook,
  wem:pulse, wem:generation, wem:facilityMeta, wem:dpvDemand

actions.js — fetchForStore(atomKey, fetchFn):
  - Maintains per-key AbortController map
  - Aborts in-flight request before starting new one
  - Sets status: 'loading' → 'ready' | 'error'
  - On error: keeps previous data (graceful degradation)

poller.js — centralised polling:
  - Pages register/deregister which keys they need (ref counting)
  - Single setInterval checks active keys against freshness:
    NEM keys: 4.5 min, WEM keys: 25 min, static keys: 1 hour
  - Only actively needed keys are polled
```

### 2. API Layer (`src/api/`)

Both `NemApi` and `WemApi` are plain classes (not singletons) instantiated
with a **ky** instance configured via `ky.create()`.

```
NemApi.js:
  - Refactored from AemoApi.js
  - Uses ky.create({ prefixUrl, headers, retry: { limit: 1 }, timeout: 15000 })
  - All methods accept optional AbortSignal
  - Returns { data, error } shape (unchanged contract)

WemApi.js:
  - Uses fetch with browser-style Accept header (WEM IIS rejects default)
  - getPulse() → fetch + Papa.parse pulse.csv
  - getGeneration() → fetch + Papa.parse generation.csv
  - getFacilityMeta() → fetch + Papa.parse facility-meta-fuelmix.csv
  - getDpvDemand() → fetch + Papa.parse distributed-pv_opdemand.csv
  - All return { data, error } shape

wemTransform.js:
  - joinFuelMix(generation, facilityMeta) → NEM-compatible fuel mix shape
  - normalisePulse(pulseRows) → { priceAndDemand, dispatchSummary, outages }
  - WEM fuel type mapping: Wind→Wind, Gas→Gas, Coal→Coal, Solar→Solar,
    Distillate→Liquid Fuel, Landfill Gas→Biomass, Dual (Gas/Distillate)→Gas
```

### 3. Chart Lifecycle (`src/charts/ChartController.js`)

Replaces the module-level `let chart = null` singleton pattern. Each page
creates a ChartController in its render function (local scope).

```js
class ChartController {
  constructor(el)              // stores element ref
  async setOption(option)      // checks el is still in DOM before rendering
  subscribe(atom, buildFn)     // auto-repaint when atom changes
  dispose()                    // unsubscribes all + disposes chart
}
```

**Why**: The old pattern stored chart references at module scope. If data
arrived after tab switch, it wrote to a stale DOM element. ChartController
scopes the chart to the render lifecycle and validates the DOM element
before every paint.

### 4. Routing (`src/main.js`)

Hash-based SPA routing (unchanged pattern):
- `PAGES` array with `{ id, label, render }` entries
- `navigate(pageId)` → cleanup → clear container → render
- `cleanupFns` array for teardown (timers, subscriptions, charts)

New: initialises poller on startup, tears down on page unload.

---

## Chart Pages

### Existing (7) — NEM data, extended with WA where applicable

| # | Page | Chart Type | NEM Source | WA Data? | WEM Source |
|---|------|-----------|------------|----------|------------|
| 1 | Dispatch Overview | HTML cards | elecSummary | Yes | pulse.csv (latest row) → WA1 card |
| 2 | Price & Demand | Multi-axis line | priceAndDemand | Yes | pulse.csv time series → WA1 tab |
| 3 | Cumulative Price | Multi-line | cumulativePrice | No | No WEM equivalent |
| 4 | Fuel Mix | Donut pie | fuelMix | Yes | generation.csv + facilityMeta → WA1 tab |
| 5 | Renewable Penetration | Donut pie | fuelMix | Yes | generation.csv + facilityMeta → WA1 tab |
| 6 | Average Price | Grouped bars | dailyAveragePrices | Yes | pulse.csv daily averages → WA bars (aligned to NEM dates) |
| 7 | 7-Day Outlook | Bar + line + table | sevenDayOutlook | No | No WEM equivalent |

### New WEM-Only (3)

| # | Page | Chart Type | WEM Source | Description |
|---|------|-----------|------------|-------------|
| 8 | **WEM Outages** | Stacked bar + donut | pulse.csv | Planned / forced / consequential outage MW over time. Donut shows current breakdown. Uses TOTAL_OUTAGE_MW, PLANNED_OUTAGE_MW, FORCED_OUTAGE_MW, CONS_OUTAGE_MW columns from pulse.csv. |
| 9 | **WEM Energy Price** | Line time series | pulse.csv | Energy price time series from WEM. ESS service columns (Regulation, Contingency, RoCoF) are not present in pulse.csv; only energy price is shown. |
| 10 | **DPV vs Demand** | Overlay line chart | distributed-pv_opdemand.csv | Distributed PV generation overlaid against operational demand. DPV can exceed 1,700 MW in SWIS — shows impact of rooftop solar on grid operations. |

---

## Region Configuration

```
NEM Regions: NSW1, QLD1, VIC1, SA1, TAS1
WEM Region:  WA1 (SWIS — South West Interconnected System)
Aggregate:   NEM (all NEM regions), ALL (NEM + WEM)
```

### Region Colors
| Region | Color | Hex |
|--------|-------|-----|
| NSW1 | Denim | #3379bf |
| QLD1 | Red | #d4254e |
| VIC1 | Purple | #6C3078 |
| SA1 | Orange | #f9b067 |
| TAS1 | Green | #467822 |
| WA1 | Burnt Orange | #E67E22 |

### WEM Fuel Type Mapping (to NEM categories)
| WEM Fuel | → NEM Category |
|----------|----------------|
| Wind | Wind |
| Gas | Gas |
| Coal | Coal |
| Solar | Solar |
| Distillate | Liquid Fuel |
| Landfill Gas | Biomass |
| Dual (Gas/Distillate) | Gas |
| Battery | Battery |

---

## Polling & Freshness

| Key Category | Freshness Threshold | Rationale |
|-------------|---------------------|-----------|
| NEM endpoints | 4.5 min | NEM dispatches every 5 min |
| WEM pulse.csv | 25 min | WEM updates every ~30 min |
| WEM generation.csv | 55 min | Daily file, check hourly |
| Static (facilityMeta) | 1 hour | Changes ~monthly |

Poller runs a single `setInterval(60s)` that checks active keys against
their freshness thresholds. Pages register which keys they need on mount
and deregister on unmount. Only actively needed keys are re-fetched.

---

## Error Handling Strategy

1. **Retry**: ky retries once on 5xx/network errors (built-in)
2. **Graceful degradation**: On error, store keeps previous cached data.
   Chart continues showing stale data rather than blanking.
3. **Error banner**: Shown above chart when data is stale. Auto-clears
   on next successful fetch.
4. **AbortController**: Each fetch is cancellable. New fetch for same key
   aborts the previous in-flight request.

---

## Implementation Phases

### Phase 1: Store + API Infrastructure
- Create store atoms, actions, poller
- Refactor AemoApi.js → NemApi.js (add ky, signal support)
- Create WemApi.js + wemTransform.js
- Update config.js with WEM constants

### Phase 2: Chart Lifecycle Fix
- Create ChartController.js
- Refactor all 7 existing pages to use ChartController + store subscriptions
- Wire poller into main.js
- **Verify**: rapid tab switching produces no errors or blank charts

### Phase 3: WEM Integration
- Add WA1 to region config and colors
- Extend Dispatch Overview, Price & Demand, Fuel Mix, Renewable Penetration,
  Average Price with WEM data sources

### Phase 4: New WEM-Only Pages
- WEM Outages page
- ESS Pricing page
- DPV vs Demand page

### Phase 5: Polish
- Loading/error states with stale data preservation
- Update package.json name to "aemovis"
- Full regression test all 10 tabs
