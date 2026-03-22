import type { CaptureItem } from '../store/capture-store';
import { renderJsonTree } from './json-tree';
import { renderTokenPill } from './token-pill';
import { i18n } from '../i18n/index';

export function renderRequestView(container: HTMLElement, item: CaptureItem): void {
  container.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column';

  const data = item.request.body;
  if (!data) {
    container.innerHTML = `<div class="empty-state">${i18n.t('proxy.noBody')}</div>`;
    return;
  }

  // Token pill
  const pillEl = document.createElement('div');
  renderTokenPill(pillEl, item);

  // JSON tree
  const treeEl = document.createElement('div');
  treeEl.style.cssText = 'flex:1;overflow:auto';
  renderJsonTree(treeEl, data);

  container.innerHTML = '';
  container.appendChild(pillEl);
  container.appendChild(treeEl);
}
