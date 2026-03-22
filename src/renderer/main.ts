import './styles/variables.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/json-tree.css';
import './styles/messages.css';
import './styles/analysis.css';
import './styles/stats.css';
import './styles/landing.css';
import './electron.d.ts';

import type { CaptureRequest, CaptureResponse } from '../shared/types/capture';
import type { TokenUsage } from '../shared/types/capture';
import { captureStore } from './store/capture-store';
import { uiStore, type DetailTab } from './store/ui-store';
import { bus } from './store/event-bus';
import { i18n } from './i18n/index';
import { esc } from '../shared/sanitize';
import { fmtTime, fmtLatency, fmtCost, fmtTokens } from './lib/format';
import { debounce } from './lib/debounce';
import { groupCaptures } from './lib/group-captures';
import { calculateCost } from '../shared/pricing';
import { renderMessagesView } from './components/messages-view';
import { renderRequestView } from './components/request-view';
import { renderResponseView } from './components/response-view';
import { renderAnalysisView } from './components/analysis-view';
import { renderStatsView } from './components/stats-view';

// ─── DOM refs ────────────────────────────────────────────────────────────────
const $ = (id: string) => document.getElementById(id)!;

// ─── i18n 적용 ───────────────────────────────────────────────────────────────
function applyI18n(): void {
  $('captureEmpty').textContent = i18n.t('proxy.noCaptures');
  $('selectRequestText').textContent = i18n.t('proxy.selectRequest');

  document.querySelectorAll<HTMLElement>('.dtab').forEach((tab) => {
    const key = tab.dataset.tab as string;
    tab.textContent = i18n.t('tabs.' + key);
  });

  $('langToggleBtn').textContent = i18n.locale === 'ko' ? 'EN' : '한';
}

// ─── Landing → Main 전환 ─────────────────────────────────────────────────────
function showMainView(): void {
  $('landingPage').style.display = 'none';
  $('mainView').style.display = 'flex';
  $('headerProxyStatus').style.display = 'flex';
  $('settingsBtn').style.display = '';
  updateHeaderProxy();
}

function updateHeaderProxy(): void {
  const dot = $('headerProxyDot');
  const text = $('headerProxyText');
  if (uiStore.proxyRunning) {
    dot.className = 'header-proxy-dot on';
    text.textContent = `Port ${uiStore.proxyPort}`;
    text.style.color = 'var(--green)';
  } else {
    dot.className = 'header-proxy-dot off';
    text.textContent = 'Stopped';
    text.style.color = 'var(--dim)';
  }
}

// ─── 프록시 시작 공통 로직 ────────────────────────────────────────────────────
async function startProxyAndListen(port: number): Promise<boolean> {
  if (!window.electronAPI) return false;

  window.electronAPI.offProxy();
  const result = await window.electronAPI.proxyStart(port);

  if (result.error) {
    alert(i18n.t('proxy.startFail') + result.error);
    return false;
  }

  uiStore.setProxyState(true, result.port);

  window.electronAPI.onProxyRequest((data: CaptureRequest) => {
    captureStore.addRequest(data);
  });
  window.electronAPI.onProxyResponse((data: CaptureResponse) => {
    captureStore.setResponse(data);
  });

  updateHeaderProxy();
  return true;
}

// ─── 캡처 목록 렌더링 (그룹핑) ────────────────────────────────────────────────
const expandedGroups = new Set<number>();

const renderCaptureList = debounce(() => {
  const listEl = $('captureListItems');
  const countEl = $('captureCount');
  const entries = captureStore.entries;

  countEl.textContent = String(entries.length);

  if (entries.length === 0) {
    listEl.innerHTML = `<div class="empty-state">${i18n.t('proxy.noCaptures')}</div>`;
    return;
  }

  const groups = groupCaptures(entries);

  listEl.innerHTML = groups.map((g, gi) => {
    const isExpanded = expandedGroups.has(gi);
    const isSelected = g.entries.some(e => e.request.id === captureStore.selectedId);
    const totalCost = g.entries.reduce((sum, e) => {
      const usage = (e.response?.body as Record<string, unknown> | null)?.usage as TokenUsage | undefined;
      const model = (e.request.body?.model as string) || '';
      return sum + (usage ? calculateCost(usage, model).totalCost : 0);
    }, 0);

    const headerHtml = `<div class="capture-group-header${isSelected ? ' selected' : ''}" data-group="${gi}">
      <div class="capture-group-top">
        ${g.entries.length > 1 ? `<span class="capture-group-expand${isExpanded ? ' open' : ''}">▶</span>` : '<span style="width:16px"></span>'}
        <span class="capture-group-msg">${esc(g.userMessage)}</span>
        ${g.entries.length > 1 ? `<span class="capture-group-badge count">${g.entries.length} calls</span>` : ''}
        ${g.hasError ? '<span class="capture-group-badge error">ERR</span>' : ''}
      </div>
      <div class="capture-group-meta">
        <span class="capture-group-meta-tag" style="color:var(--blue)">${esc(g.mainModel)}</span>
        <span class="capture-group-meta-tag" style="color:var(--orange)">⏱ ${fmtLatency(g.totalLatencyMs)}</span>
        ${totalCost > 0 ? `<span class="capture-group-meta-tag" style="color:var(--yellow)">💰 ${fmtCost(totalCost)}</span>` : ''}
        ${(() => {
          const tokens = g.entries.reduce((s, e) => {
            const u = (e.response?.body as Record<string, unknown> | null)?.usage as TokenUsage | undefined;
            return s + (u ? (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0) : 0);
          }, 0);
          return tokens > 0 ? `<span class="capture-group-meta-tag" style="color:var(--green)">🪙 ${fmtTokens(tokens)}</span>` : '';
        })()}
        <span style="margin-left:auto;font-size:9px;opacity:.6">${fmtTime(g.firstTs)}</span>
      </div>
    </div>`;

    let childrenHtml = '';
    if (g.entries.length > 1) {
      const childItems = g.entries.map((e) => {
        const model = (e.request.body?.model as string) || '';
        const sel = e.request.id === captureStore.selectedId ? ' selected' : '';
        const status = e.response?.status;
        const statusCls = status && status < 400 ? 'ok' : status ? 'err' : '';
        const statusStr = status ? String(status) : '…';
        const latency = e.response?.latencyMs;

        return `<div class="capture-entry${sel}" data-id="${e.request.id}">
          <div style="display:flex;align-items:center;overflow:hidden">
            <span class="capture-method">${esc(e.request.method)}</span>
            <span class="capture-path">${esc(e.request.path)}</span>
            <span class="capture-status ${statusCls}">${statusStr}</span>
            ${latency !== undefined ? `<span class="capture-latency">${fmtLatency(latency)}</span>` : ''}
          </div>
          ${model ? `<div class="capture-model">${esc(model)}</div>` : ''}
        </div>`;
      }).join('');

      childrenHtml = `<div class="capture-group-children${isExpanded ? ' open' : ''}" data-children="${gi}">${childItems}</div>`;
    }

    return `<div class="capture-group">${headerHtml}${childrenHtml}</div>`;
  }).join('');

  listEl.querySelectorAll<HTMLElement>('.capture-group-header').forEach((el) => {
    el.addEventListener('click', () => {
      const gi = Number(el.dataset.group);
      const group = groups[gi];
      if (!group) return;
      if (group.entries.length > 1) {
        if (expandedGroups.has(gi)) expandedGroups.delete(gi);
        else expandedGroups.add(gi);
      }
      captureStore.select(group.entries[0].request.id);
    });
  });

  listEl.querySelectorAll<HTMLElement>('.capture-entry').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      captureStore.select(Number(el.dataset.id));
    });
  });
}, 50);

// ─── 상세 뷰 렌더링 ─────────────────────────────────────────────────────────
function renderDetailView(): void {
  const container = $('detailView');
  const item = captureStore.getSelected();

  if (uiStore.activeTab === 'stats') {
    renderStatsView(container);
    return;
  }

  if (!item) {
    container.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column';
    container.innerHTML = `<div class="empty-state"><span style="font-size:28px">🔍</span><span>${i18n.t('proxy.selectRequest')}</span></div>`;
    return;
  }

  switch (uiStore.activeTab) {
    case 'messages': renderMessagesView(container, item); break;
    case 'request': renderRequestView(container, item); break;
    case 'response': renderResponseView(container, item); break;
    case 'analysis': renderAnalysisView(container, item); break;
  }
}

// ─── 설정 모달 ───────────────────────────────────────────────────────────────
function openSettings(): void {
  const existing = document.querySelector('.settings-overlay');
  if (existing) { existing.remove(); return; }

  const overlay = document.createElement('div');
  overlay.className = 'settings-overlay';
  overlay.innerHTML = `<div class="settings-card">
    <div class="settings-title">
      <span>⚙️ Settings</span>
      <button class="settings-close" id="settingsCloseBtn">✕</button>
    </div>
    <div class="settings-row">
      <label>Proxy Port</label>
      <input type="number" id="settingsPort" value="${uiStore.proxyPort}" min="1024" max="65535">
    </div>
    <div class="settings-row">
      <label>Proxy Status</label>
      <span style="color:${uiStore.proxyRunning ? 'var(--green)' : 'var(--dim)'};font-family:var(--mono);font-size:12px">
        ${uiStore.proxyRunning ? '● Running' : '○ Stopped'}
      </span>
    </div>
    <div class="settings-actions">
      ${uiStore.proxyRunning
        ? '<button class="btn btn-danger" id="settingsStopBtn">Stop Proxy</button>'
        : '<button class="btn btn-primary" id="settingsStartBtn">Start Proxy</button>'}
      <button class="btn btn-secondary" id="settingsClearBtn">Clear All</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  // 닫기
  overlay.querySelector('#settingsCloseBtn')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Stop
  overlay.querySelector('#settingsStopBtn')?.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.proxyStop();
    window.electronAPI.offProxy();
    uiStore.setProxyState(false);
    updateHeaderProxy();
    overlay.remove();
  });

  // Start
  overlay.querySelector('#settingsStartBtn')?.addEventListener('click', async () => {
    const port = parseInt((overlay.querySelector('#settingsPort') as HTMLInputElement).value) || 9002;
    await startProxyAndListen(port);
    overlay.remove();
  });

  // Clear
  overlay.querySelector('#settingsClearBtn')?.addEventListener('click', () => {
    captureStore.clear();
    overlay.remove();
  });
}

// ─── 이벤트 바인딩 ───────────────────────────────────────────────────────────

// Landing page: Start Proxy
$('landingStartBtn').addEventListener('click', async () => {
  const btn = $('landingStartBtn') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Starting...';

  const port = parseInt(($('landingPort') as HTMLInputElement).value) || 9002;
  const ok = await startProxyAndListen(port);

  if (ok) {
    showMainView();
  } else {
    btn.disabled = false;
    btn.textContent = '▶ Start Proxy';
  }
});

// Settings 버튼
$('settingsBtn').addEventListener('click', () => openSettings());

// 탭 전환
document.querySelectorAll<HTMLElement>('.dtab').forEach((tab) => {
  tab.addEventListener('click', () => {
    uiStore.setTab(tab.dataset.tab as DetailTab);
  });
});

// 언어 전환
$('langToggleBtn').addEventListener('click', () => {
  i18n.setLocale(i18n.locale === 'ko' ? 'en' : 'ko');
  uiStore.setLocale(i18n.locale as 'ko' | 'en');
  applyI18n();
  renderCaptureList();
  renderDetailView();
});

// ─── 스토어 이벤트 구독 ──────────────────────────────────────────────────────
bus.on('captures:changed', () => renderCaptureList());
bus.on('captures:selected', () => {
  renderCaptureList();
  renderDetailView();
});
bus.on('ui:tab-changed', (tab: unknown) => {
  document.querySelectorAll<HTMLElement>('.dtab').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  renderDetailView();
});

// ─── 초기화 ──────────────────────────────────────────────────────────────────
if (window.electronAPI?.platform === 'darwin') {
  document.body.classList.add('darwin');
}

applyI18n();

// 프록시 상태 동기화 (이미 실행 중이면 바로 Main View로)
(async () => {
  if (!window.electronAPI?.proxyStatus) return;
  try {
    const st = await window.electronAPI.proxyStatus();
    if (st.running) {
      uiStore.setProxyState(true, st.port);
      window.electronAPI.offProxy();
      window.electronAPI.onProxyRequest((data: CaptureRequest) => captureStore.addRequest(data));
      window.electronAPI.onProxyResponse((data: CaptureResponse) => captureStore.setResponse(data));
      showMainView();
    }
  } catch { /* 무시 */ }
})();
