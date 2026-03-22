import type { CaptureItem } from '../store/capture-store';
import type { TokenUsage } from '../../shared/types/capture';
import { calculateCost } from '../../shared/pricing';
import { fmtTokens, fmtKB, fmtCost, fmtLatency } from '../lib/format';
import { i18n } from '../i18n/index';

export function renderTokenPill(container: HTMLElement, item: CaptureItem): void {
  const body = item.request.body;
  if (!body) { container.innerHTML = ''; return; }

  const bytes = new TextEncoder().encode(JSON.stringify(body)).length;
  const kb = fmtKB(bytes);
  const usage = (item.response?.body as Record<string, unknown> | null)?.usage as TokenUsage | undefined;
  const latency = item.response?.latencyMs;

  let html = `<span class="tt-badge">${kb} KB</span>`;

  if (usage) {
    const model = (body.model as string) || '';
    const cost = calculateCost(usage, model);

    html += `<span class="tt-badge">${i18n.t('token.input')} ${fmtTokens(cost.totalInputTokens)}</span>`;
    html += `<span class="tt-badge">${i18n.t('token.output')} ${fmtTokens(cost.outputTokens)}</span>`;
    if (cost.cacheHitRate > 0) {
      html += `<span class="tt-badge" style="color:var(--green)">${i18n.t('token.cache')} ${cost.cacheHitRate}%</span>`;
    }
    html += `<span class="tt-badge" style="color:var(--yellow)">${fmtCost(cost.totalCost)}</span>`;
  } else {
    const tokens = Math.ceil(bytes / 3.5);
    html += `<span class="tt-badge">~${fmtTokens(tokens)} tok (${i18n.t('token.estimated')})</span>`;
  }

  if (latency !== undefined) {
    html += `<span class="tt-badge" style="color:var(--orange)">${i18n.t('token.latency')} ${fmtLatency(latency)}</span>`;
  }

  container.className = 'token-pill';
  container.innerHTML = html;
}
