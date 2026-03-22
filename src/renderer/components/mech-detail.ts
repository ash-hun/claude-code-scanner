import type { CaptureItem } from '../store/capture-store';
import type { MechanismDetection } from '../../shared/types/analysis';
import { esc } from '../../shared/sanitize';
import { detectMechanisms } from '../../shared/mechanism-detector';

export function renderMechDetail(item: CaptureItem): string {
  const det = item.mechanisms || (item.request.body ? detectMechanisms(item.request.body) : null);
  if (!det) return '';

  const hasAny = det.claudeMd || det.outputStyle || det.slashCommands.length ||
    det.skills.length || det.subAgents.length || det.mcpTools.length || det.fileSystemOps.length;

  // 칩 바
  const chips = [
    { key: 'cm', label: '📋 CLAUDE.md', found: !!det.claudeMd },
    { key: 'st', label: '🎨 Style', found: !!det.outputStyle },
    { key: 'sc', label: '⌨ Slash Cmd', found: det.slashCommands.length > 0 },
    { key: 'sk', label: '🔧 Skill', found: det.skills.length > 0 },
    { key: 'sa', label: '🤖 Sub-Agent', found: det.subAgents.length > 0 },
    { key: 'mc', label: '🔌 MCP', found: det.mcpTools.length > 0 },
    { key: 'fs', label: `📁 FS Ops: ${det.fileSystemOps.length}`, found: det.fileSystemOps.length > 0 },
  ];

  const chipsHtml = `<div class="mech-chips">${
    chips.map(c => `<span class="mech-chip ${c.key} ${c.found ? 'found' : 'not-found'}">${c.label}</span>`).join('')
  }</div>`;

  if (!hasAny) {
    return `<div class="analysis-section">
      <div class="analysis-section-header" data-section-toggle style="color:var(--green)"><span class="section-toggle">▼</span> 🔬 Mechanism Detection</div>
      <div class="analysis-section-body">
        ${chipsHtml}
        <div class="empty-state" style="padding:12px">감지된 메커니즘 없음</div>
      </div>
    </div>`;
  }

  let detailHtml = '';

  // CLAUDE.md
  if (det.claudeMdSections.length > 0) {
    detailHtml += det.claudeMdSections.map(s => `
      <div class="mech-block cm">
        <div class="mech-block-title" style="color:${s.scope === 'global' ? 'var(--green)' : 'var(--blue)'}">${esc(s.label)}</div>
        <div class="mech-kv"><span class="mech-kv-key">path:</span><span class="mech-kv-val">${esc(s.path)}</span></div>
        <div class="mech-block-content">${esc(s.content.slice(0, 3000))}${s.content.length > 500 ? '…' : ''}</div>
      </div>
    `).join('');
  }

  // Output Style
  if (det.outputStyle && det.outputStyle.length > 1) {
    const extra = det.outputStyle.slice(1).join('\n---\n');
    detailHtml += `<div class="mech-block st">
      <div class="mech-block-title" style="color:var(--blue)">🎨 Output Style</div>
      <div class="mech-block-content">${esc(extra.slice(0, 3000))}</div>
    </div>`;
  }

  // Slash Command → Skill 연결
  if (det.slashCommands.length > 0) {
    for (const cmd of det.slashCommands) {
      detailHtml += `<div class="mech-block sc">
        <div class="mech-block-title" style="color:var(--yellow)">⌨ /${esc(cmd.name)}</div>
        <div class="mech-block-content">${esc(cmd.tag)}</div>
      </div>`;
    }

    // Skill과 연결
    if (det.skills.length > 0) {
      detailHtml += '<div class="mech-flow-arrow">↓ triggers</div>';
    }
  }

  // Skills
  for (const sk of det.skills) {
    const skillName = (sk.input.skill || sk.input.command || 'Skill') as string;
    detailHtml += `<div class="mech-block sk">
      <div class="mech-block-title" style="color:var(--purple)">🔧 Skill: ${esc(skillName)}</div>
      <div class="mech-kv"><span class="mech-kv-key">id:</span><span class="mech-kv-val">${esc(sk.id)}</span></div>
      <div class="mech-kv"><span class="mech-kv-key">input:</span><span class="mech-kv-val">${esc(JSON.stringify(sk.input).slice(0, 2000))}</span></div>
      ${sk.result ? `<div class="mech-kv"><span class="mech-kv-key">result:</span><span class="mech-kv-val" style="color:var(--green)">${esc(sk.result.slice(0, 1000))}</span></div>` : ''}
    </div>`;
  }

  // Sub-Agents
  for (const sa of det.subAgents) {
    detailHtml += `<div class="mech-block sa">
      <div class="mech-block-title" style="color:var(--red)">🤖 ${esc(sa.name)} — Sub-Agent</div>
      <div class="mech-kv"><span class="mech-kv-key">type:</span><span class="mech-kv-val">${esc((sa.input.subagent_type || sa.input.type || '?') as string)}</span></div>
      <div class="mech-kv"><span class="mech-kv-key">prompt:</span><span class="mech-kv-val">${esc(String(sa.input.prompt || sa.input.description || '').slice(0, 2000))}</span></div>
      <div style="font-size:10px;color:var(--dim);margin-top:4px">→ 별도 API 호출 생성 (독립 컨텍스트)</div>
    </div>`;
  }

  // MCP Tools
  for (const mc of det.mcpTools) {
    detailHtml += `<div class="mech-block mc">
      <div class="mech-block-title" style="color:#4ec9dc">🔌 ${esc(mc.toolName)} <span style="opacity:.6">(${esc(mc.serverName)})</span></div>
      <div class="mech-kv"><span class="mech-kv-key">input:</span><span class="mech-kv-val">${esc(JSON.stringify(mc.input).slice(0, 2000))}</span></div>
      ${mc.result ? `<div class="mech-kv"><span class="mech-kv-key">result:</span><span class="mech-kv-val" style="color:var(--green)">${esc(mc.result.slice(0, 1000))}</span></div>` : ''}
    </div>`;
  }

  return `<div class="analysis-section">
    <div class="analysis-section-header" style="color:var(--green)">🔬 Mechanism Detection</div>
    <div class="analysis-section-body">
      ${chipsHtml}
      ${detailHtml}
    </div>
  </div>`;
}
