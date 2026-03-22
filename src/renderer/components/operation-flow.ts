import type { CaptureItem } from '../store/capture-store';
import type { AnthropicContentBlock } from '../../shared/types/capture';
import { esc } from '../../shared/sanitize';

interface OpNode {
  index: number;
  type: 'user' | 'assistant' | 'read' | 'write' | 'edit' | 'glob' | 'grep' | 'bash' | 'skill' | 'agent' | 'mcp';
  name: string;
  detail: string;
  result?: string;
  isError?: boolean;
}

const TOOL_TYPE_MAP: Record<string, OpNode['type']> = {
  Read: 'read', Write: 'write', Edit: 'edit', MultiEdit: 'edit',
  Glob: 'glob', Grep: 'grep', Bash: 'bash',
  Skill: 'skill', Task: 'agent', Agent: 'agent',
};

const TYPE_ICONS: Record<string, string> = {
  user: '👤', assistant: '🤖', read: '📄', write: '📝', edit: '✏️',
  glob: '📂', grep: '🔍', bash: '⚡', skill: '🔧', agent: '🤖', mcp: '🔌',
};

function formatDetail(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'Read': return `file_path: ${input.file_path || '?'}${input.limit ? ` (limit: ${input.limit})` : ''}`;
    case 'Write': return `file_path: ${input.file_path || '?'}`;
    case 'Edit': case 'MultiEdit': return `file_path: ${input.file_path || '?'}`;
    case 'Glob': return `pattern: ${input.pattern || '?'}${input.path ? ` in ${input.path}` : ''}`;
    case 'Grep': return `pattern: ${input.pattern || '?'}${input.path ? ` in ${input.path}` : ''}`;
    case 'Bash': return `command: ${String(input.command || '?').slice(0, 120)}`;
    case 'Skill': return `skill: ${input.skill || input.command || '?'}`;
    case 'Agent': case 'Task':
      return `type: ${input.subagent_type || input.type || '?'}\nprompt: ${String(input.prompt || input.description || '?').slice(0, 1000)}`;
    default:
      if (name.startsWith('mcp__')) {
        const parts = name.split('__');
        return `server: ${parts[1] || '?'}\ntool: ${parts.slice(2).join('__') || '?'}\ninput: ${JSON.stringify(input).slice(0, 1000)}`;
      }
      return JSON.stringify(input).slice(0, 1000);
  }
}

function truncResult(s: string): string {
  return s.trim();
}

export function renderOperationFlow(item: CaptureItem): string {
  const body = item.request.body;
  if (!body?.messages) return '';

  const nodes: OpNode[] = [];
  const toolResults = new Map<string, string>();

  // 먼저 tool_result 수집
  for (const msg of body.messages) {
    const contents: AnthropicContentBlock[] = Array.isArray(msg.content)
      ? msg.content as AnthropicContentBlock[]
      : typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : [];
    for (const c of contents) {
      if (c.type === 'tool_result' && c.tool_use_id) {
        const val = typeof c.content === 'string' ? c.content
          : Array.isArray(c.content) ? (c.content as Array<{text?: string}>).map(x => x.text || '').join('') : '';
        toolResults.set(c.tool_use_id, val);
      }
    }
  }

  // 메시지 순회하여 노드 추출
  let idx = 0;
  for (const msg of body.messages) {
    const contents: AnthropicContentBlock[] = Array.isArray(msg.content)
      ? msg.content as AnthropicContentBlock[]
      : typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : [];

    // user 텍스트 (system-reminder 제외한 실제 입력)
    if (msg.role === 'user') {
      for (const c of contents) {
        if (c.type === 'text' && c.text) {
          const plain = c.text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
            .replace(/<command-message>[\s\S]*?<\/command-message>/g, '').trim();
          if (plain && plain.length > 0) {
            nodes.push({ index: ++idx, type: 'user', name: 'USER', detail: plain.slice(0, 1000) });
          }
        }
      }
    }

    // assistant tool_use + 텍스트
    if (msg.role === 'assistant') {
      for (const c of contents) {
        if (c.type === 'text' && c.text && c.text.trim()) {
          nodes.push({ index: ++idx, type: 'assistant', name: 'ASSISTANT', detail: c.text.slice(0, 1000) });
        }
        if (c.type === 'tool_use' && c.name) {
          let opType: OpNode['type'] = TOOL_TYPE_MAP[c.name] || 'mcp';
          if (c.name.startsWith('mcp__')) opType = 'mcp';

          const input = (c.input as Record<string, unknown>) || {};
          const result = c.id ? toolResults.get(c.id) : undefined;

          nodes.push({
            index: ++idx,
            type: opType,
            name: c.name,
            detail: formatDetail(c.name, input),
            result: result ? truncResult(result) : undefined,
          });
        }
      }
    }
  }

  // 응답의 assistant 메시지도 추가
  const respBody = item.response?.body;
  if (respBody && typeof respBody === 'object' && 'content' in respBody) {
    const respContent = (respBody as { content?: AnthropicContentBlock[] }).content || [];
    for (const c of respContent) {
      if (c.type === 'text' && c.text && c.text.trim()) {
        nodes.push({ index: ++idx, type: 'assistant', name: 'ASSISTANT', detail: c.text.slice(0, 300) });
      }
      if (c.type === 'tool_use' && c.name) {
        let opType: OpNode['type'] = TOOL_TYPE_MAP[c.name] || 'mcp';
        if (c.name.startsWith('mcp__')) opType = 'mcp';
        const input = (c.input as Record<string, unknown>) || {};
        nodes.push({ index: ++idx, type: opType, name: c.name, detail: formatDetail(c.name, input) });
      }
    }
  }

  if (nodes.length === 0) return '';

  const nodesHtml = nodes.map(n => {
    if (n.type === 'user' || n.type === 'assistant') {
      return `<div class="op-msg">
        <div class="op-dot ${n.type}"></div>
        <span style="color:${n.type === 'user' ? 'var(--blue)' : 'var(--green)'};font-size:11px;font-weight:600">${n.name}</span>
        <span style="color:var(--dim);font-size:11px;margin-left:8px">${esc(n.detail.slice(0, 100))}${n.detail.length > 100 ? '…' : ''}</span>
      </div>`;
    }

    const displayName = n.name.startsWith('mcp__') ? n.name.split('__').slice(2).join('__') : n.name;
    return `<div class="op-node">
      <div class="op-dot ${n.type}"></div>
      <div class="op-header">
        <span class="op-index">${n.index}.</span>
        <span class="op-name ${n.type}">${TYPE_ICONS[n.type] || '📦'} ${esc(displayName)}</span>
      </div>
      <div class="op-detail">${esc(n.detail)}</div>
      ${n.result ? `<div class="op-result${n.isError ? ' error' : ''}">→ ${esc(n.result)}</div>` : ''}
    </div>`;
  }).join('');

  return `
    <div class="analysis-section">
      <div class="analysis-section-header" data-section-toggle style="color:var(--orange)"><span class="section-toggle">▼</span> ⏱ Operation Flow (${nodes.filter(n => n.type !== 'user' && n.type !== 'assistant').length} ops)</div>
      <div class="analysis-section-body">
        <div class="op-flow">${nodesHtml}</div>
      </div>
    </div>`;
}
