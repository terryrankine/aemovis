import nemApi from '../api/NemApi.js';
import wemApi from '../api/WemApi.js';
import { ALL_REGIONS, NEM_FRESHNESS, WEM_FRESHNESS } from '../api/config.js';
import { nemElecSummary, wemPulse } from '../store/atoms.js';
import { normalisePulse } from '../api/wemTransform.js';
import { fetchIfStale } from '../store/actions.js';
import { registerPoll } from '../store/poller.js';
import { escHtml } from '../utils/escHtml.js';

function regionLabel(id) {
  return ALL_REGIONS.find(r => r.value === id)?.label ?? id;
}

function fmtPrice(v) {
  return `$${Number(v).toFixed(2)}`;
}

function fmtMW(v) {
  return `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} MW`;
}

function flowClass(v) {
  return Number(v) >= 0 ? 'flow-positive' : 'flow-negative';
}

function renderCard(region) {
  const totalGen = region.scheduledGeneration + region.semischeduledGeneration;
  const maxBar = Math.max(region.totalDemand, totalGen);
  const demandPct = (region.totalDemand / maxBar * 100).toFixed(1);
  const genPct    = (totalGen / maxBar * 100).toFixed(1);

  const icRows = (region.interconnectorFlows || []).map(ic => `
    <tr>
      <td>${escHtml(ic.name)}</td>
      <td class="${flowClass(ic.value)}">${Number(ic.value).toFixed(0)}</td>
      <td>${Number(ic.exportlimit).toFixed(0)}</td>
      <td>${Number(ic.importlimit).toFixed(0)}</td>
    </tr>
  `).join('');

  const icTable = icRows ? `
    <div class="interconnectors">
      <table>
        <thead><tr><th>Interconnector</th><th>Flow</th><th>Export</th><th>Import</th></tr></thead>
        <tbody>${icRows}</tbody>
      </table>
    </div>
  ` : '';

  return `
    <div class="dispatch-card">
      <h3>${regionLabel(region.regionId)}</h3>
      <div class="dispatch-price ${region.priceStatus === 'FIRM' ? 'firm' : ''}">${fmtPrice(region.price)}</div>
      <div style="font-size:0.7rem;color:var(--slate-400);margin-bottom:0.5rem">${region.priceStatus}</div>
      <div class="bar-row">
        <span style="width:70px">Demand</span>
        <div class="bar-track"><div class="bar-fill demand" style="width:${demandPct}%"></div></div>
        <span>${fmtMW(region.totalDemand)}</span>
      </div>
      <div class="bar-row">
        <span style="width:70px">Gen</span>
        <div class="bar-track"><div class="bar-fill generation" style="width:${genPct}%"></div></div>
        <span>${fmtMW(totalGen)}</span>
      </div>
      ${icTable}
    </div>
  `;
}

function paint(container, nemState, wemState) {
  const nemLoading = nemState.status === 'loading' && !nemState.data;
  const wemLoading = wemState.status === 'loading' && !wemState.data;

  if (nemLoading && wemLoading) {
    container.innerHTML = '<div class="loading">Loading dispatch data...</div>';
    return;
  }

  const allSummary = [];

  if (nemState.data?.summary) {
    allSummary.push(...nemState.data.summary);
  }

  if (wemState.data) {
    const { summary } = normalisePulse(wemState.data);
    if (summary) allSummary.push(summary);
  }

  if (allSummary.length === 0) {
    const err = nemState.error || wemState.error;
    if (err) {
      container.innerHTML = `<div class="error-msg">Error: ${escHtml(err)}</div>`;
    }
    return;
  }

  const ts = allSummary[0]?.settlementDate;
  const time = ts ? new Date(ts).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  const errors = [nemState.error, wemState.error].filter(Boolean);
  const errorBanner = errors.length > 0
    ? `<div class="error-msg" style="margin-bottom:1rem">Data may be stale: ${escHtml(errors.join('; '))}</div>`
    : '';

  container.innerHTML = `
    <div class="page-header">
      <h2>Dispatch Overview</h2>
      <span style="font-size:0.8rem;color:var(--slate-600)">${time}</span>
    </div>
    ${errorBanner}
    <div class="dispatch-grid">${allSummary.map(renderCard).join('')}</div>
  `;
}

const fetchElecSummary = (signal) => nemApi.getElecSummary(signal);
const fetchPulse = (signal) => wemApi.getPulse(signal);

export function renderDispatchOverview(container, cleanupFns) {
  paint(container, nemElecSummary.get(), wemPulse.get());

  const repaint = () => paint(container, nemElecSummary.get(), wemPulse.get());

  const unsub1 = nemElecSummary.subscribe(repaint);
  const unsub2 = wemPulse.subscribe(repaint);

  fetchIfStale(nemElecSummary, fetchElecSummary, NEM_FRESHNESS);
  fetchIfStale(wemPulse, fetchPulse, WEM_FRESHNESS);

  const unregPoll1 = registerPoll('nem:elecSummary', nemElecSummary, fetchElecSummary, NEM_FRESHNESS);
  const unregPoll2 = registerPoll('wem:pulse', wemPulse, fetchPulse, WEM_FRESHNESS);

  cleanupFns.push(() => {
    unsub1();
    unsub2();
    unregPoll1();
    unregPoll2();
  });
}
