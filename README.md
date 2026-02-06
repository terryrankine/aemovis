# AEMOVis

Australian Energy Market Visualisation — a vanilla JS SPA displaying real-time NEM and WEM electricity data.

## Tech Stack

- **Charts:** [ECharts](https://echarts.apache.org/) with custom AEMO theme
- **State:** [nanostores](https://github.com/nanostores/nanostores) reactive atoms
- **HTTP:** [ky](https://github.com/sindresorhus/ky) for NEM API, native fetch for WEM CSV
- **CSV:** [PapaParse](https://www.papaparse.com/) for WEM data parsing
- **Maps:** [Leaflet](https://leafletjs.com/) for WA Gen Map
- **Build:** [Vite](https://vitejs.dev/)

## Getting Started

```bash
npm install
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build to dist/
npm run test     # Run tests
```

## Data Sources

### NEM (National Electricity Market)

| Endpoint | Atom | Update Frequency | Pages |
|----------|------|------------------|-------|
| `NEM/v1/PWS/NEMDashboard/elecSummary` | `nemElecSummary` | 5 min | Dispatch Overview |
| `NEM/v1/PWS/NEMDashboard/priceAndDemand?timescale=30MIN` | `nemPriceAndDemand30` | 5 min | Price and Demand |
| `NEM/v1/PWS/NEMDashboard/priceAndDemand?timescale=5MIN` | `nemPriceAndDemand5` | 5 min | Price and Demand |
| `NEM/v1/PWS/NEMDashboard/cumulativePrice` | `nemCumulativePrice` | 5 min | Cumulative Price |
| `NEM/v1/PWS/NEMDashboard/marketPriceLimits` | `nemMarketPriceLimits` | 1 hour | Cumulative Price |
| `NEM/v1/PWS/NEMDashboard/fuelMix?type=CURRENT` | `nemFuelMix` | 5 min | Fuel Mix, Renewable Penetration |
| `NEM/v1/PWS/NEMDashboard/dailyAveragePrices?year=YYYY&month=MM` | `getDailyPriceAtom(y,m)` | 1 hour | Average Price |
| `NEM/v1/PWS/NEMDashboard/sevenDayOutlook` | `nemSevenDayOutlook` | 5 min | 7-Day Outlook |

**Base URL:** `https://dashboards.public.aemo.com.au`
**Auth:** `x-api-key` header (public key, same as AEMO website)

### WEM (Wholesale Electricity Market — Western Australia)

| File | Atom | Update Frequency | Pages |
|------|------|------------------|-------|
| `public/infographic/neartime/pulse.csv` | `wemPulse` | 30 min | WEM Outages, WEM Energy Price, WA Dispatch, WA Reserves |
| `public/infographic/generation.csv` | `wemGeneration` | 1 hour | WA Dispatch, WA Reserves, WA Gen Map |
| `public/infographic/facility-meta-fuelmix.csv` | `wemFacilityMeta` | 1 hour | WA Dispatch, WA Reserves, WA Gen Map |
| `public/infographic/dpvopdemand/distributed-pv_opdemand.csv` | `wemDpvDemand` | 30 min | DPV vs Demand |

**Base URL:** `https://data.wa.aemo.com.au`
**Auth:** None (public CORS-enabled)

### Data Storage

All data is stored in nanostores atoms with the shape:
```js
{ data: any, error: string|null, fetchedAt: number, status: 'idle'|'loading'|'ready'|'error' }
```

- **Freshness check:** `fetchIfStale(atom, fetchFn, freshnessMs)` skips fetch if data is recent
- **Graceful degradation:** On error, previous `data` is preserved for display
- **Polling:** 60s interval checks freshness before refetch; pages register/deregister from poller

## Pages

| Page | Route | Data Sources |
|------|-------|--------------|
| Dispatch Overview | `#dispatch` | NEM elecSummary |
| Price and Demand | `#price` | NEM priceAndDemand (5MIN/30MIN) |
| Cumulative Price | `#cumulative` | NEM cumulativePrice, marketPriceLimits |
| Fuel Mix | `#fuelmix` | NEM fuelMix |
| Renewable Penetration | `#renewable` | NEM fuelMix |
| Average Price | `#avgprice` | NEM dailyAveragePrices, WEM pulse |
| 7-Day Outlook | `#outlook` | NEM sevenDayOutlook |
| FCAS Prices | `#fcas` | NEM elecSummary |
| Net Interchange | `#interchange` | NEM elecSummary |
| WEM Outages | `#outages` | WEM pulse |
| WEM Energy Price | `#ess` | WEM pulse |
| DPV vs Demand | `#dpv` | WEM dpvDemand |
| WA Dispatch | `#wadispatch` | WEM pulse, generation, facilityMeta |
| WA Reserves | `#wareserves` | WEM pulse, generation, facilityMeta |
| WA Gen Map | `#wamap` | WEM generation, facilityMeta |

## Architecture

```
┌─────────────┐     ┌─────────────┐
│   NEM API   │     │   WEM CSV   │
│   (JSON)    │     │   (CSV)     │
└──────┬──────┘     └──────┬──────┘
       │                   │
       ▼                   ▼
┌──────────────────────────────────┐
│         nanostores atoms         │
│  { data, error, fetchedAt, ... } │
└──────────────────┬───────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌─────────────┐         ┌─────────────┐
│   Poller    │         │   Pages     │
│  (60s tick) │         │  (render)   │
└─────────────┘         └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │  ECharts    │
                        └─────────────┘
```

**Data flow:** APIs fetch into atoms → pages subscribe to atoms → ChartController renders ECharts.

**Key patterns:**
- `fetchIfStale()` prevents redundant fetches on tab switches
- Poller checks freshness before refetch (doesn't blindly poll)
- ChartController validates DOM exists before painting (handles navigation race)

```
src/
├── api/           # NemApi.js, WemApi.js, config.js
├── store/         # atoms.js, actions.js, poller.js
├── pages/         # Page render functions
├── charts/        # ChartController for ECharts lifecycle
├── theme/         # ECharts theme + color palette
└── utils/         # escHtml for XSS prevention
```

## Known Limitations

- WEM JSON endpoints (ReferenceTradingPrice, EssentialServicesPricing, etc.) return 404 — only CSV files work
- WEM IIS rejects default fetch Accept header; browser-style Accept header required
- WA average price in Average Price page is aligned to NEM dates only (pulse.csv covers ~4 days)
