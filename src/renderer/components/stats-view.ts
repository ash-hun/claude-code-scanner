import { computeSessionStats } from '../store/stats-store';
import { fmtTokens, fmtCost, fmtLatency, fmtKB } from '../lib/format';
import { esc } from '../../shared/sanitize';

export function renderStatsView(container: HTMLElement): void {
  container.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column';

  const s = computeSessionStats();

  if (s.totalRequests === 0) {
    container.innerHTML = '<div class="empty-state">No data yet. Start the proxy and send some requests.</div>';
    return;
  }

  // Summary cards
  const summaryHtml = `<div class="stats-grid">
    <div class="stat-card">
      <span class="stat-card-label">📊 총 요청</span>
      <span class="stat-card-value">${s.totalRequests}</span>
    </div>
    <div class="stat-card">
      <span class="stat-card-label">🪙 총 토큰</span>
      <span class="stat-card-value" style="font-size:18px">${fmtTokens(s.totalInputTokens)} in</span>
      <span class="stat-card-sub">${fmtTokens(s.totalOutputTokens)} out</span>
    </div>
    <div class="stat-card">
      <span class="stat-card-label">💰 총 비용</span>
      <span class="stat-card-value" style="color:var(--yellow)">${fmtCost(s.totalCost)}</span>
      <span class="stat-card-sub">${fmtCost(s.costPerRequest)} / req</span>
    </div>
    <div class="stat-card">
      <span class="stat-card-label">⏱ 평균 레이턴시</span>
      <span class="stat-card-value">${fmtLatency(s.avgLatencyMs)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-card-label">♻️ 캐시 적중률</span>
      <span class="stat-card-value" style="color:var(--green)">${s.cacheHitRate}%</span>
    </div>
    <div class="stat-card">
      <span class="stat-card-label">📈 요청당 비용</span>
      <span class="stat-card-value" style="font-size:18px">${fmtCost(s.costPerRequest)}</span>
    </div>
  </div>`;

  // Latency distribution
  const maxLatencyCount = Math.max(...s.latencyBuckets.map(b => b.count), 1);
  const latencyHtml = `<div class="stats-bar-section">
    <div class="stats-bar-header">⏱ Latency Distribution</div>
    <div class="stats-bar-body">
      ${s.latencyBuckets.map(b => `<div class="stats-bar-row">
        <span class="stats-bar-label">${b.label}</span>
        <div class="stats-bar-track">
          <div class="stats-bar-fill" style="width:${b.count / maxLatencyCount * 100}%;background:var(--orange)">${b.count > 0 ? b.count : ''}</div>
        </div>
        <span class="stats-bar-count">${b.count} (${b.pct}%)</span>
      </div>`).join('')}
    </div>
  </div>`;

  // Model usage
  const modelHtml = `<div class="stats-bar-section">
    <div class="stats-bar-header">🤖 Model Usage</div>
    <div class="stats-bar-body">
      ${s.modelUsage.map(m => `<div class="stats-model-row">
        <span class="stats-model-name">${esc(m.model)}</span>
        <div class="stats-bar-track" style="flex:1">
          <div class="stats-bar-fill" style="width:${m.pct}%;background:var(--blue)">${m.count}</div>
        </div>
        <span class="stats-bar-count">${m.count} (${m.pct}%)</span>
      </div>`).join('')}
    </div>
  </div>`;

  // Mechanism frequency
  const mechHtml = `<div class="stats-bar-section">
    <div class="stats-bar-header">🔬 Mechanism Frequency</div>
    <div class="stats-bar-body">
      <div class="stats-mech-grid">
        ${s.mechCounts.map(m => `<div class="stats-mech-item">
          <span>${m.icon}</span>
          <span style="color:var(--dim)">${esc(m.label)}</span>
          <span class="stats-mech-count">${m.count}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>`;

  // Token accumulation
  let accumHtml = '';
  if (s.tokenAccumulation.length > 1) {
    const maxKB = s.maxSizeKB || 1;
    const showEntries = s.tokenAccumulation.filter((_, i, arr) => {
      if (arr.length <= 10) return true;
      const step = Math.ceil(arr.length / 10);
      return i % step === 0 || i === arr.length - 1;
    });

    accumHtml = `<div class="stats-bar-section">
      <div class="stats-bar-header">📈 Context Size Growth</div>
      <div class="stats-bar-body">
        ${showEntries.map(a => `<div class="stats-accum-row">
          <span class="stats-accum-label">Turn ${a.turn}</span>
          <div class="stats-accum-bar">
            <div class="stats-accum-fill" style="width:${a.sizeKB / maxKB * 100}%;background:${a.sizeKB > 500 ? 'var(--red)' : a.sizeKB > 200 ? 'var(--yellow)' : 'var(--blue)'}"></div>
          </div>
          <span class="stats-accum-size">${a.sizeKB} KB</span>
        </div>`).join('')}
        ${s.maxSizeKB > 500 ? '<div class="stats-warning">⚠ 컨텍스트 크기가 500KB를 초과했습니다. 토큰 비용이 급격히 증가할 수 있습니다.</div>' : ''}
      </div>
    </div>`;
  }

  // 내보내기 버튼
  const exportHtml = `<div class="stats-bar-section">
    <div class="stats-bar-header">📦 Export</div>
    <div class="stats-bar-body" style="flex-direction:row;gap:10px">
      <button class="btn btn-secondary" id="exportJsonBtn" style="flex:1">Export JSON</button>
    </div>
  </div>`;

  // 히스토리 세션 (DB에서 로드)
  const historyHtml = `<div class="stats-bar-section">
    <div class="stats-bar-header">📚 History Sessions</div>
    <div class="stats-bar-body" id="historyList">
      <div style="color:var(--dim);font-size:11px;text-align:center">Loading...</div>
    </div>
  </div>`;

  container.style.cssText = 'flex:1;overflow-y:auto;display:block';
  container.innerHTML = `<div class="stats-container">
    ${summaryHtml}
    ${latencyHtml}
    ${modelHtml}
    ${mechHtml}
    ${accumHtml}
    ${exportHtml}
    ${historyHtml}
  </div>`;

  // 내보내기 버튼 이벤트
  document.getElementById('exportJsonBtn')?.addEventListener('click', async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.exportJson({});
    if (result.path) alert('Exported to: ' + result.path);
  });

  // 히스토리 세션 로드 (비동기)
  loadHistory();
}

async function loadHistory(): Promise<void> {
  const listEl = document.getElementById('historyList');
  if (!listEl || !window.electronAPI?.getSessions) {
    if (listEl) listEl.innerHTML = '<div style="color:var(--dim);font-size:11px;text-align:center">DB not connected</div>';
    return;
  }

  try {
    const sessions = await window.electronAPI.getSessions();
    if (!sessions || sessions.length === 0) {
      listEl.innerHTML = '<div style="color:var(--dim);font-size:11px;text-align:center">No history yet</div>';
      return;
    }

    listEl.innerHTML = sessions.map((s: Record<string, unknown>) => {
      const startTime = s.start_time ? new Date(s.start_time as string).toLocaleString('ko-KR') : '?';
      const reqCount = s.request_count || 0;
      const cost = Number(s.total_cost || 0);
      const model = (s.top_model as string) || '?';

      return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px">
        <span style="flex:1;color:var(--text)">${esc(startTime)}</span>
        <span style="color:var(--dim);font-family:var(--mono)">${reqCount} req</span>
        <span style="color:var(--yellow);font-family:var(--mono)">${fmtCost(cost)}</span>
        <span style="color:var(--dim);font-family:var(--mono);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(model)}</span>
      </div>`;
    }).join('');
  } catch (err) {
    listEl.innerHTML = `<div style="color:var(--red);font-size:11px">Error: ${esc(String(err))}</div>`;
  }
}
