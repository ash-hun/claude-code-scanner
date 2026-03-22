import type { CaptureItem } from '../store/capture-store';
import { esc } from '../../shared/sanitize';
import { fmtTokens, fmtKB, fmtCost } from '../lib/format';
import { calculateCost } from '../../shared/pricing';
import type { TokenUsage } from '../../shared/types/capture';

interface SizeEntry { label: string; icon: string; bytes: number; color: string; }

export function renderRequestAnatomy(item: CaptureItem): string {
  const body = item.request.body;
  if (!body) return '<div class="empty-state">No body</div>';

  const totalBytes = new TextEncoder().encode(JSON.stringify(body)).length;
  const totalTokens = Math.ceil(totalBytes / 3.5);

  // 구성요소별 크기 계산
  const systemBytes = body.system ? new TextEncoder().encode(JSON.stringify(body.system)).length : 0;
  const messagesBytes = body.messages ? new TextEncoder().encode(JSON.stringify(body.messages)).length : 0;
  const toolsBytes = body.tools ? new TextEncoder().encode(JSON.stringify(body.tools)).length : 0;
  const otherBytes = Math.max(0, totalBytes - systemBytes - messagesBytes - toolsBytes);

  const bars: SizeEntry[] = [
    { label: 'system[]', icon: '⚙️', bytes: systemBytes, color: 'var(--blue)' },
    { label: 'messages[]', icon: '💬', bytes: messagesBytes, color: 'var(--green)' },
    { label: 'tools[]', icon: '🔧', bytes: toolsBytes, color: 'var(--purple)' },
    { label: 'other', icon: '📋', bytes: otherBytes, color: 'var(--dim)' },
  ].filter(b => b.bytes > 0);

  // 비용 계산
  const usage = (item.response?.body as Record<string, unknown> | null)?.usage as TokenUsage | undefined;
  const model = (body.model as string) || 'unknown';
  const costInfo = usage ? calculateCost(usage, model) : null;

  // 요약 라인
  const summaryHtml = `<div class="anatomy-summary">
    ${fmtKB(totalBytes)} KB · ~${fmtTokens(totalTokens)} tok
    ${costInfo ? ` · <span>${fmtCost(costInfo.totalCost)}</span>` : ''}
    ${model !== 'unknown' ? ` · ${esc(model)}` : ''}
  </div>`;

  // 바 차트
  const barsHtml = bars.map(b => {
    const pct = totalBytes > 0 ? (b.bytes / totalBytes * 100) : 0;
    return `<div class="anatomy-bar-row">
      <span class="anatomy-bar-label">${b.icon} ${esc(b.label)}</span>
      <div class="anatomy-bar-track">
        <div class="anatomy-bar-fill" style="width:${pct}%;background:${b.color}"></div>
      </div>
      <span class="anatomy-bar-value">${fmtKB(b.bytes)} KB</span>
      <span class="anatomy-bar-pct">${pct.toFixed(0)}%</span>
    </div>`;
  }).join('');

  // system[] 상세
  let systemDetail = '';
  if (Array.isArray(body.system) && body.system.length > 0) {
    const sections = body.system.map((s, i) => {
      const sBytes = new TextEncoder().encode(JSON.stringify(s)).length;
      const sPct = totalBytes > 0 ? (sBytes / totalBytes * 100) : 0;
      const text = (s as { text?: string }).text || '';
      let label = `Block ${i}`;
      if (text.includes('Contents of') && text.includes('CLAUDE.md')) label = 'CLAUDE.md + Rules';
      else if (text.includes('skills are available')) label = 'Skills List';
      else if (i === 0) label = 'Base System Prompt';
      else label = `Output Style #${i}`;
      return `<div class="anatomy-detail-row">
        <span class="anatomy-detail-icon">⚙️</span>
        <span class="anatomy-detail-name">${esc(label)}</span>
        <span class="anatomy-detail-size">${fmtKB(sBytes)} KB</span>
        <span class="anatomy-detail-pct">${sPct.toFixed(1)}%</span>
      </div>`;
    }).join('');

    systemDetail = `<div class="anatomy-detail">
      <div class="anatomy-detail-title">system[] 상세</div>
      ${sections}
    </div>`;
  }

  // messages[] 상세
  let msgsDetail = '';
  if (body.messages && body.messages.length > 0) {
    const turnCount = body.messages.length;
    const userMsgs = body.messages.filter(m => m.role === 'user');
    const assistantMsgs = body.messages.filter(m => m.role === 'assistant');

    // system-reminder 주입 크기 추정
    let sysReminderBytes = 0;
    let userTypedBytes = 0;
    for (const m of userMsgs) {
      const text = typeof m.content === 'string' ? m.content : '';
      const contentArr = Array.isArray(m.content) ? m.content : [];
      for (const c of (text ? [{ type: 'text', text }] : contentArr)) {
        if ((c as { type: string; text?: string }).type === 'text' && (c as { text?: string }).text) {
          const t = (c as { text: string }).text;
          const srMatches = t.match(/<system-reminder>[\s\S]*?<\/system-reminder>/g);
          if (srMatches) sysReminderBytes += new TextEncoder().encode(srMatches.join('')).length;
          const plain = t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
          if (plain) userTypedBytes += new TextEncoder().encode(plain).length;
        }
      }
    }
    const assistantBytes = new TextEncoder().encode(JSON.stringify(assistantMsgs)).length;

    msgsDetail = `<div class="anatomy-detail">
      <div class="anatomy-detail-title">messages[] 상세 (${turnCount} messages)</div>
      <div class="anatomy-detail-row">
        <span class="anatomy-detail-icon">📋</span>
        <span class="anatomy-detail-name">system-reminder 주입</span>
        <span class="anatomy-detail-size">${fmtKB(sysReminderBytes)} KB</span>
        <span class="anatomy-detail-pct">${totalBytes > 0 ? (sysReminderBytes / totalBytes * 100).toFixed(1) : 0}%</span>
      </div>
      <div class="anatomy-detail-row">
        <span class="anatomy-detail-icon">👤</span>
        <span class="anatomy-detail-name">사용자 입력 텍스트</span>
        <span class="anatomy-detail-size">${fmtKB(userTypedBytes)} KB</span>
        <span class="anatomy-detail-pct">${totalBytes > 0 ? (userTypedBytes / totalBytes * 100).toFixed(1) : 0}%</span>
      </div>
      <div class="anatomy-detail-row">
        <span class="anatomy-detail-icon">🤖</span>
        <span class="anatomy-detail-name">이전 assistant 응답 (${assistantMsgs.length}개)</span>
        <span class="anatomy-detail-size">${fmtKB(assistantBytes)} KB</span>
        <span class="anatomy-detail-pct">${totalBytes > 0 ? (assistantBytes / totalBytes * 100).toFixed(1) : 0}%</span>
      </div>
    </div>`;
  }

  // tools[] 상세
  let toolsDetail = '';
  if (body.tools && body.tools.length > 0) {
    const builtIn = body.tools.filter(t => !t.name.startsWith('mcp__'));
    const mcp = body.tools.filter(t => t.name.startsWith('mcp__'));

    toolsDetail = `<div class="anatomy-detail">
      <div class="anatomy-detail-title">tools[] 상세 (${body.tools.length} tools)</div>
      <div class="anatomy-detail-row">
        <span class="anatomy-detail-icon">🔧</span>
        <span class="anatomy-detail-name">Built-in (${builtIn.length})</span>
        <span class="anatomy-detail-size">${fmtKB(new TextEncoder().encode(JSON.stringify(builtIn)).length)} KB</span>
        <span class="anatomy-detail-pct"></span>
      </div>
      ${mcp.length > 0 ? `<div class="anatomy-detail-row">
        <span class="anatomy-detail-icon">🔌</span>
        <span class="anatomy-detail-name">MCP (${mcp.length} lazy-loaded)</span>
        <span class="anatomy-detail-size">${fmtKB(new TextEncoder().encode(JSON.stringify(mcp)).length)} KB</span>
        <span class="anatomy-detail-pct"></span>
      </div>` : ''}
    </div>`;
  }

  return `
    <div class="analysis-section">
      <div class="analysis-section-header" data-section-toggle style="color:var(--blue)"><span class="section-toggle">▼</span> 📐 Request Anatomy</div>
      <div class="analysis-section-body">
        ${summaryHtml}
        <div class="anatomy-bar-container">${barsHtml}</div>
        ${systemDetail}
        ${msgsDetail}
        ${toolsDetail}
      </div>
    </div>`;
}
