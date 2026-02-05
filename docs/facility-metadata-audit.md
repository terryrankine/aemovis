# WA Facility Metadata Coordinate Audit

**Source:** `https://data.wa.aemo.com.au/public/infographic/facility-meta-fuelmix.csv`

**Date:** 2026-02-05

## Summary

| Status | Count |
|--------|-------|
| ✅ Good | 56 |
| ❌ Wrong (Perth CBD) | 4 |
| ⚠️ Missing coords | 11 |
| ⚠️ Unverified | 8 |

## ❌ WRONG COORDINATES (Perth CBD error: -31.95, 115.86)

These facilities are listed at Perth CBD coordinates instead of their actual locations:

| Facility Code | Name | AEMO Coords | Correct Coords | Source |
|--------------|------|-------------|----------------|--------|
| COCKBURN_CCG1 | Cockburn CCGT | -31.95, 115.86 | **-32.200, 115.774** | [GEO](https://globalenergyobservatory.org/geoid/40754) |
| KWINANA_GT2 | Kwinana Gas Turbine 2 | -31.95, 115.86 | **-32.228, 115.773** | [GEO](https://globalenergyobservatory.org/geoid/43253) |
| KWINANA_GT3 | Kwinana Gas Turbine 3 | -31.95, 115.86 | **-32.228, 115.773** | [GEO](https://globalenergyobservatory.org/geoid/43253) |
| PERTHENERGY_KWINANA_GT1 | Kwinana Gas Turbine 1 | -31.95, 115.86 | **-32.228, 115.773** | [GEO](https://globalenergyobservatory.org/geoid/43253) |

**Status:** Fixed in WaGenMap.js with COORD_FIXES override.

## ⚠️ MISSING COORDINATES

These facilities have no lat/lon in metadata (likely not yet commissioned or virtual):

| Facility Code | Name | Notes |
|--------------|------|-------|
| COLLIE_BESS2 | (empty) | Battery storage - future |
| COLLIE_ESR1 | (empty) | Battery storage - future |
| COLLIE_ESR4 | (empty) | Battery storage - future |
| COLLIE_ESR5 | (empty) | Battery storage - future |
| DPV | Distributed PV | Virtual aggregation |
| FLATROCKS_WF1 | (empty) | Future wind farm |
| KWINANA_ESR1 | (empty) | Battery storage |
| KWINANA_ESR2 | (empty) | Battery storage |
| PHOENIX_KWINANA_WTE_G1 | (empty) | Waste to energy - future |
| PRDSO_WALPOLE_HG1 | (empty) | Future |
| SBSOLAR1_CUNDERDIN_PV1 | (empty) | Future solar |

**Status:** Skipped in map (no coords to plot).

## ✅ VERIFIED CORRECT

| Facility Code | Name | AEMO Coords | Verified | Source |
|--------------|------|-------------|----------|--------|
| PINJAR_GT* (9 units) | Pinjar Gas Turbines | -31.56, 115.82 | ✅ -31.558, 115.818 | [Wikipedia](https://en.wikipedia.org/wiki/Pinjar_Power_Station) |
| COLLIE_G1 | Collie G1 | -33.34, 116.26 | ✅ -33.34, 116.26 | [GEM](https://www.gem.wiki/Collie_power_station) |
| MUJA_G7, MUJA_G8 | Muja 7/8 | -33.45, 116.30 | ✅ -33.446, 116.306 | [latitude.to](https://latitude.to/articles-by-country/au/australia/62360/muja-power-station) |
| BW1_BLUEWATERS_G2, BW2_BLUEWATERS_G1 | Bluewaters 1/2 | -33.33, 116.23 | ✅ -33.33, 116.23 | [GEO](https://globalenergyobservatory.org/geoid/40752) |
| KEMERTON_GT11, KEMERTON_GT12 | Kemerton 1/2 | -33.21, 115.76 | ⚠️ -33.16, 115.78 | [GEO](https://globalenergyobservatory.org/geoid/43202) |
| NEWGEN_KWINANA_CCG1 | NewGen Kwinana CCGT | -32.20, 115.77 | ✅ -32.202, 115.773 | [GEO](https://globalenergyobservatory.org/geoid/40755) |
| NEWGEN_NEERABUP_GT1 | Neerabup GT1 | -31.67, 115.80 | ✅ -31.671, 115.802 | [Wikipedia](https://en.wikipedia.org/wiki/Neerabup_Power_Station) |

## ⚠️ POTENTIALLY INCORRECT (needs verification)

| Facility Code | Name | AEMO Coords | Notes |
|--------------|------|-------------|-------|
| KEMERTON_GT11 | Kemerton 1 | -33.21, 115.76 | GEO says -33.16, 115.78 (~5km off) |
| KEMERTON_GT12 | Kemerton 2 | -33.21, 115.76 | GEO says -33.16, 115.78 (~5km off) |
| TESLA_KEMERTON_G1 | Tesla Kemerton | -33.21, 115.76 | Same as Kemerton - may be co-located |

## ✅ ASSUMED CORRECT (reasonable locations, not independently verified)

All other facilities have coordinates that appear reasonable for WA:
- Wind farms in coastal/rural areas
- Solar farms in appropriate sunny regions
- Gas/coal plants in industrial areas
- Landfill gas in Perth metro waste facilities

## 📍 SUGGESTED COORDINATES FOR MISSING FACILITIES

These facilities have no coordinates in AEMO metadata. Suggested coords based on research:

| Facility Code | Name | Suggested Coords | Source / Notes |
|--------------|------|------------------|----------------|
| COLLIE_BESS2 | Collie Battery 2 | **-33.340, 116.260** | Adjacent to Collie Power Station, Boys Home Road |
| COLLIE_ESR1 | Collie ESR 1 | **-33.340, 116.260** | Same site as Collie Power Station |
| COLLIE_ESR4 | Collie ESR 4 | **-33.340, 116.260** | Same site as Collie Power Station |
| COLLIE_ESR5 | Collie ESR 5 | **-33.340, 116.260** | Same site as Collie Power Station |
| FLATROCKS_WF1 | Flat Rocks Wind Farm | **-33.95, 117.05** | ~30km SW of Kojonup, near Flat Rocks Road |
| KWINANA_ESR1 | Kwinana ESR 1 | **-32.228, 115.773** | At Kwinana Power Station site |
| KWINANA_ESR2 | Kwinana ESR 2 | **-32.228, 115.773** | At Kwinana Power Station site |
| PHOENIX_KWINANA_WTE_G1 | Phoenix Kwinana WTE | **-32.210, 115.779** | [Wikipedia](https://en.wikipedia.org/wiki/Kwinana_Waste_to_Energy_Plant) |
| PRDSO_WALPOLE_HG1 | Walpole Hydro | **-34.980, 116.730** | Walpole township area |
| SBSOLAR1_CUNDERDIN_PV1 | Cunderdin Solar Farm | **-31.656, 117.276** | Near Cunderdin township |
| DPV | Distributed PV | N/A | Virtual aggregation - no physical location |

**Notes:**
- Collie batteries are at the decommissioned Collie Power Station site (Synergy's battery storage project)
- Flat Rocks WF location estimated from planning documents (~30km SW of Kojonup)
- Walpole hydro estimated from township location (small run-of-river)
- Phoenix Kwinana WTE is the East Rockingham waste-to-energy plant

## Recommendations

1. **AEMO should fix** the 4 Perth CBD entries (Cockburn, Kwinana GTs)
2. **Kemerton** coords may need minor adjustment (~5km)
3. **Future facilities** should have coords added when commissioned
4. **Consider** adding a data quality flag to the CSV
5. **Add suggested coords** above to WaGenMap.js COORD_FIXES when facilities commission
