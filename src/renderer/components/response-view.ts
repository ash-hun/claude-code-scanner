import type { CaptureItem } from '../store/capture-store';
import { renderJsonTree } from './json-tree';
import { fmtLatency } from '../lib/format';
import { i18n } from '../i18n/index';

export function renderResponseView(container: HTMLElement, item: CaptureItem): void {
  container.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column';

  if (!item.response) {
    container.innerHTML = `<div class="empty-state">${i18n.t('proxy.waitingResponse')}</div>`;
    return;
  }

  const data = item.response.body;
  if (!data) {
    container.innerHTML = `<div class="empty-state">${i18n.t('proxy.noBody')}</div>`;
    return;
  }

  // Latency + status info
  const infoEl = document.createElement('div');
  infoEl.className = 'token-pill';
  const statusColor = item.response.status < 400 ? 'var(--green)' : 'var(--red)';
  infoEl.innerHTML =
    `<span class="tt-badge" style="color:${statusColor}">HTTP ${item.response.status}</span>`
    + `<span class="tt-badge" style="color:var(--orange)">${i18n.t('token.latency')} ${fmtLatency(item.response.latencyMs)}</span>`;

  // JSON tree
  const treeEl = document.createElement('div');
  treeEl.style.cssText = 'flex:1;overflow:auto';
  renderJsonTree(treeEl, data);

  container.innerHTML = '';
  container.appendChild(infoEl);
  container.appendChild(treeEl);
}
