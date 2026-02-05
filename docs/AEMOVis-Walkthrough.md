---
title: "AEMOVis Walkthrough"
subtitle: "Australian Energy Market Visualisation"
date: "February 2026"
---

# AEMOVis Walkthrough

## Introduction

AEMOVis is a real-time visualisation dashboard for Australia's electricity markets. It draws live data from both the **National Electricity Market (NEM)** — covering NSW, QLD, VIC, SA, and TAS — and the **Wholesale Electricity Market (WEM)** in Western Australia.

The core design principle is that **markets are not first-class citizens — the type of visualisation is**. Each page represents a distinct analytical lens (price trends, fuel mix, renewable penetration, etc.) rather than a single market. Where the same visualisation applies to both NEM and WEM, both data sources are available on the same page, and the **Compare** feature allows multiple regions to be viewed side by side. This lets analysts compare across market boundaries in a single view.

### Key Features

- **10 visualisation pages** covering price, demand, generation, fuel mix, renewables, outlook, and outages
- **Compare mode** on applicable pages — overlay XY charts or display side-by-side pie/donut charts for multiple regions simultaneously
- **Live polling** with 60-second refresh and stale-data guards
- **Responsive layout** for desktop, tablet, and mobile

---

## Table of Contents

1. [Dispatch Overview](#1-dispatch-overview)
2. [Price and Demand](#2-price-and-demand)
3. [Cumulative Price](#3-cumulative-price)
4. [Fuel Mix](#4-fuel-mix)
5. [Renewable Penetration](#5-renewable-penetration)
6. [Average Price](#6-average-price)
7. [7-Day Outlook](#7-7-day-outlook)
8. [WEM Outages](#8-wem-outages)
9. [WEM Energy Price](#9-wem-energy-price)
10. [DPV vs Demand](#10-dpv-vs-demand)

---

## 1. Dispatch Overview

The landing page provides a bird's-eye view of all six NEM regions (NSW, QLD, VIC, SA, TAS) plus WA. Each region card shows the current spot price, demand and generation bars, and interconnector flows. This is the fastest way to assess the state of the entire Australian grid at a glance.

- **Spot price** displayed prominently per region
- **Demand vs generation** horizontal bars show supply-demand balance
- **Interconnector flows** table shows import/export between neighbouring regions
- WA is sourced from the WEM pulse feed; NEM regions from the AEMO dispatch API

![Dispatch Overview](screenshots/01-dispatch-overview.png)

---

## 2. Price and Demand

A dual-axis time-series chart showing spot price ($/MWh, left axis) and demand (MW, right axis) for any selected region. Supports both 5-minute and 30-minute resolution for NEM regions, while WA displays ~4 days of rolling data from the WEM pulse feed.

- **Region selector** — click any region button to switch
- **Timescale selector** — toggle between 5MIN and 30MIN (NEM only)
- **Forecast overlay** — dashed lines show pre-dispatch forecast where available
- **APC marker** — dotted line at the Administered Price Cap threshold (NEM only)
- **KPI row** — current price, demand, forecast values, and APC status

### Compare Mode

Click **Compare** to overlay multiple regions on the same chart. Each region gets a distinct colour. Price lines are solid, demand lines are dashed. Forecast data appears as dotted lines. The APC marker is shown when at least one NEM region is selected.

![Price and Demand — Single Region](screenshots/02-price-demand.png)

![Price and Demand — Compare Mode (NSW vs QLD)](screenshots/02b-price-demand-compare.png)

---

## 3. Cumulative Price

Tracks the running cumulative price sum across the trading day for each NEM region. This is critical for monitoring proximity to the **Cumulative Price Threshold (CPT)**, which triggers Administered Pricing if breached. The chart shows how each region's cumulative price evolves in real time.

- **Per-region cumulative totals** updated every dispatch interval
- **CPT threshold line** marks the trigger level
- WA is not applicable (WEM has a different pricing mechanism)

![Cumulative Price](screenshots/03-cumulative-price.png)

---

## 4. Fuel Mix

A donut chart breaking down current generation by fuel type for the selected region. Fuel types are colour-coded consistently (black coal = dark, wind = teal, solar = gold, gas = orange, hydro = blue, etc.) and ordered by the standard AEMO fuel hierarchy.

- **Region selector** — individual NEM regions, WA, or NEM aggregate
- **Total MW** displayed in the chart centre
- **Legend** with percentage breakdown
- WA fuel mix is derived by joining WEM generation data with facility metadata

### Compare Mode

Click **Compare** to see side-by-side pie charts for multiple regions. Pies are evenly distributed across the width and auto-size — radius shrinks gracefully as more regions are added.

![Fuel Mix — NEM Aggregate](screenshots/04-fuel-mix.png)

![Fuel Mix — Compare Mode (NEM vs NSW)](screenshots/04b-fuel-mix-compare.png)

---

## 5. Renewable Penetration

A donut chart showing the percentage of current generation from renewable sources (wind, solar, hydro, biomass, battery, rooftop PV) versus non-renewable sources. The percentage is displayed prominently in the centre.

- **Region selector** — individual NEM regions, WA, or NEM aggregate
- Renewable classification covers: Wind, Solar, Hydro, Biomass, Battery, Rooftop PV, Distributed PV, Utility-scale Solar, Dpv
- Green/dark colour scheme for clear visual distinction

### Compare Mode

Click **Compare** to see side-by-side donut charts showing renewable penetration for multiple regions simultaneously. Each donut displays its region label and percentage, making cross-regional comparison immediate.

![Renewable Penetration — NEM Aggregate](screenshots/05-renewable-penetration.png)

![Renewable Penetration — Compare Mode (NEM vs SA)](screenshots/05b-renewable-compare.png)

---

## 6. Average Price

Displays the average spot price for each NEM region as a bar chart, derived from the most recent dispatch data. WA average price is included, aligned to the NEM date window (~4 days from the WEM pulse feed).

- **Bar chart** comparing average price across all regions
- Colour-coded by region for quick identification
- Useful for spotting sustained price divergence between states

![Average Price](screenshots/06-average-price.png)

---

## 7. 7-Day Outlook

A tabular view of AEMO's Short Term Projected Assessment of System Adequacy (ST PASA), showing forecast demand, available capacity, and reserve margins for each NEM region over the coming seven days.

- **Daily breakdown** with peak demand forecasts
- **Capacity and reserve** columns highlight potential shortfalls
- Critical for operational planning and market participant decision-making
- NEM only — WEM outlook data is not available via the same API

![7-Day Outlook](screenshots/07-seven-day-outlook.png)

---

## 8. WEM Outages

Displays currently reported generation outages in the Western Australian Wholesale Electricity Market. When outages are active, they are listed with facility name, capacity affected, and outage type. When no outages are reported, a clear status message is shown.

- **Outage list** with facility details and MW impact
- **Total outage MW** summary card
- Sourced from the WEM outage CSV feed
- WEM-only page (NEM outage data uses a different reporting mechanism)

![WEM Outages](screenshots/08-wem-outages.png)

---

## 9. WEM Energy Price

> **Note:** This page is flagged as a duplicate. It overlaps with the Price and Demand page when WA is selected. Flagged for removal in a future update.

A simple time-series chart showing the WEM energy price over the rolling ~4-day window from the pulse feed. The current spot price KPI is displayed above the chart.

![WEM Energy Price (Deprecated)](screenshots/09-wem-energy-price.png)

---

## 10. DPV vs Demand

A dual-axis chart specific to Western Australia, showing the relationship between grid operational demand and distributed photovoltaic (rooftop solar) generation. This is particularly important in WA where rooftop solar penetration is among the highest in the world and significantly impacts grid operations.

- **Operational Demand** (MW, left axis) — total grid demand
- **Distributed PV** (MW, right axis) — estimated rooftop solar output
- **KPI row** — current demand, current DPV, peak DPV, and minimum demand
- The inverse relationship between DPV and demand is clearly visible: as solar output rises during the day, net demand drops
- WEM-only page sourced from the DPV/operational demand CSV feed

![DPV vs Demand](screenshots/10-dpv-vs-demand.png)

---

## Technical Notes

- **Data sources:** NEM data via AEMO's public REST API; WEM data via AEMO's IIS-hosted CSV feeds
- **Polling:** All data atoms refresh on a 60-second interval with freshness guards to avoid redundant fetches
- **Charting:** Built with Apache ECharts for high-performance, interactive visualisations
- **Architecture:** Vanilla JavaScript SPA with nanostores for reactive state management, ky for HTTP, and PapaParse for CSV parsing
- **Compare mode:** Available on Price and Demand, Fuel Mix, and Renewable Penetration pages. XY charts use overlaid series with region-specific colours; pie/donut charts use side-by-side positioning with adaptive sizing
