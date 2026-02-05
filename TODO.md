# AEMOVis — Outstanding Tasks

## Available WEM Data Sources (verified Feb 5 2026)

Only these 4 endpoints return 200 from `data.wa.aemo.com.au`:

| Endpoint | URL | Content |
|---|---|---|
| pulse.csv | `/public/infographic/neartime/pulse.csv` | Price, demand, gen, outages (~4 days rolling, 30-min) |
| generation.csv | `/public/infographic/generation.csv` | Per-facility generation (48 intervals I01-I48) |
| facility-meta-fuelmix.csv | `/public/infographic/facility-meta-fuelmix.csv` | Facility code -> fuel type mapping |
| dpv_opdemand.csv | `/public/infographic/dpvopdemand/distributed-pv_opdemand.csv` | DPV generation vs operational demand |

**All JSON market-data endpoints return 404:**
- ReferenceTradingPrice, EssentialServicesPricing, BalancingSummary, Outages, Forecast — all 404.

## Correct Data Source Mapping

| Page | NEM Source | WA Source | WA Status |
|---|---|---|---|
| Dispatch Overview | elecSummary JSON | pulse.csv (latest row) | DONE - working |
| Price & Demand | priceAndDemand JSON | pulse.csv (time series) | DONE - forecast KPIs now show "N/A" |
| Cumulative Price | cumulativePrice JSON | None (NEM-only mechanism) | DONE - NEM only, correct |
| Fuel Mix | fuelMix JSON | generation.csv + facility-meta | DONE - working |
| Renewable Penetration | fuelMix JSON | generation.csv + facility-meta | DONE - working |
| Average Price | dailyAveragePrices JSON | pulse.csv (daily avg of PRICE) | DONE - WA aligned to NEM dates |
| 7-Day Outlook | sevenDayOutlook JSON | None (no WA forecast data) | DONE - reverted to NEM only |
| WEM Outages | N/A | pulse.csv (outage columns) | DONE - shows "no outages" when all 0 |
| WEM Energy Price | N/A | pulse.csv (energy price only) | DONE - renamed from ESS Pricing |
| DPV vs Demand | N/A | dpv_opdemand.csv | DONE - code verified |

## Remaining Items

### 1. WEM Outages — all values currently 0
All outage columns (TOTAL_OUTAGE_MW, PLANNED_OUTAGE_MW, FORCED_OUTAGE_MW,
CONS_OUTAGE_MW) are genuinely 0 for every row in pulse.csv. WA currently has no outages.
The page shows "No outages currently reported in WEM" with "0 MW Total Outages",
which is correct. When outages do occur, verify the chart renders properly
(can't test until WA actually has outages).

## Completed

1. Full store infrastructure (nanostores atoms, fetchForStore, poller)
2. API layer (NemApi with ky, WemApi with PapaParse, fetcher)
3. ChartController lifecycle fix (eliminated chart race conditions)
4. WA integration for Dispatch Overview, Price & Demand, Fuel Mix, Renewable Penetration
5. WEM-only pages: Outages, WEM Energy Price, DPV vs Demand
6. Fixed all WEM CSV column name mismatches
7. Fixed WA Gen 0 MW (fallback to FORECAST_EOI_MW)
8. Eliminated all ECharts "instance already exists" warnings
9. Fixed `normalisePulse` to filter empty future rows
10. Fixed Price & Demand WA forecast KPIs — shows "N/A" instead of "$0.00" / "0"
11. Reverted 7-Day Outlook to NEM-only
12. Fixed WEM Outages to show "No outages currently reported" when all values are 0
13. Added WA to Average Price using `dailyAveragePrices()` from pulse.csv
14. **Fixed Average Price WA date alignment** — WA bars only show for dates NEM also has
15. **Renamed ESS Pricing → WEM Energy Price** — ESS columns don't exist in pulse.csv
16. **Removed dead code** — `wemReferenceTradingPrice` atom, `getReferenceTradingPrice()` method, `_getJson()` helper
17. **Verified DPV vs Demand** — code, column mappings, and data flow are correct
