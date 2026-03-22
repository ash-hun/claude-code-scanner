import type { AnthropicRequestBody, AnthropicContentBlock } from './types/capture';
import type {
  MechanismDetection,
  SlashCommandInfo,
  SkillInfo,
  SubAgentInfo,
  McpToolInfo,
  FileSystemOp,
} from './types/analysis';
import { parseClaudeMdSections } from './claude-md-parser';

/** File System 도구 이름 매핑 */
const FS_TOOL_MAP: Record<string, FileSystemOp['type']> = {
  Read: 'read',
  Write: 'write',
  Edit: 'edit',
  MultiEdit: 'edit',
  Glob: 'glob',
  Grep: 'grep',
  Bash: 'bash',
};

/**
 * Anthropic API 요청 바디에서 7가지 메커니즘을 감지:
 * 1. CLAUDE.md (system-reminder 주입)
 * 2. Output Style (system[] 추가 블록)
 * 3. Slash Commands (<command-message> 태그)
 * 4. Skills (tool_use name='Skill')
 * 5. Sub-Agents (tool_use name='Task'|'Agent')
 * 6. MCP Tools (tool_use name='mcp__*')
 * 7. File System Ops (Read, Write, Edit, Glob, Grep, Bash)
 */
export function detectMechanisms(body: AnthropicRequestBody | null): MechanismDetection {
  const found: MechanismDetection = {
    claudeMd: null,
    claudeMdSections: [],
    outputStyle: null,
    slashCommands: [],
    skills: [],
    subAgents: [],
    mcpTools: [],
    fileSystemOps: [],
  };

  if (!body) return found;

  // Output Style: system 배열이 2개 이상 텍스트 블록
  if (Array.isArray(body.system) && body.system.length >= 2) {
    found.outputStyle = body.system
      .filter((s) => s.type === 'text')
      .map((s) => s.text);
  }

  // 메시지 스캔
  const msgs = body.messages || [];
  for (const msg of msgs) {
    const contents: AnthropicContentBlock[] = Array.isArray(msg.content)
      ? msg.content
      : typeof msg.content === 'string'
        ? [{ type: 'text', text: msg.content }]
        : [];

    for (const c of contents) {
      // 텍스트 블록 분석
      if (c.type === 'text' && typeof c.text === 'string') {
        // CLAUDE.md: <system-reminder> 내부에 "Contents of" 패턴
        for (const m of c.text.matchAll(/<system-reminder>([\s\S]*?)<\/system-reminder>/g)) {
          const inner = m[1].trim();
          if (/Contents of /i.test(inner)) {
            found.claudeMd = found.claudeMd ? found.claudeMd + '\n\n' + inner : inner;
          }
        }

        // Slash Command: <command-message> 태그
        for (const cmdMatch of c.text.matchAll(/<command-message>([\s\S]*?)<\/command-message>/g)) {
          const tag = cmdMatch[1].trim();
          const nearby = c.text.slice(
            (cmdMatch.index ?? 0) + cmdMatch[0].length,
            (cmdMatch.index ?? 0) + cmdMatch[0].length + 200,
          );
          const cmdNameMatch = nearby.match(/^<command-name>\s*\/(\S+)\s*<\/command-name>/);

          let name: string;
          if (cmdNameMatch) {
            name = cmdNameMatch[1];
          } else {
            const nameMatch =
              tag.match(/^#\s*\/(\S+)/) || tag.match(/^(\S+)\s+is running/);
            name = nameMatch
              ? nameMatch[1]
              : /^\w[\w-]*$/.test(tag)
                ? tag
                : `Cmd ${found.slashCommands.length + 1}`;
          }

          found.slashCommands.push({ name, tag, full: c.text } as SlashCommandInfo);
        }
      }

      // tool_use 블록 분석
      if (c.type === 'tool_use' && c.name) {
        // Skill
        if (c.name === 'Skill') {
          found.skills.push({
            id: c.id!,
            input: (c.input as Record<string, unknown>) || {},
          } as SkillInfo);
        }

        // Sub-Agent
        if (c.name === 'Task' || c.name === 'Agent') {
          found.subAgents.push({
            id: c.id!,
            name: c.name,
            input: (c.input as Record<string, unknown>) || {},
          } as SubAgentInfo);
        }

        // MCP Tool
        if (c.name.startsWith('mcp__')) {
          const parts = c.name.split('__');
          found.mcpTools.push({
            id: c.id!,
            name: c.name,
            serverName: parts[1] || '?',
            toolName: parts.slice(2).join('__') || c.name,
            input: (c.input as Record<string, unknown>) || {},
          } as McpToolInfo);
        }

        // File System Operations
        if (c.name in FS_TOOL_MAP) {
          found.fileSystemOps.push({
            type: FS_TOOL_MAP[c.name],
            toolUseId: c.id!,
            input: (c.input as Record<string, unknown>) || {},
          } as FileSystemOp);
        }
      }

      // tool_result: Skill / MCP 결과 연결
      if (c.type === 'tool_result' && c.tool_use_id) {
        const resultContent =
          typeof c.content === 'string'
            ? c.content
            : Array.isArray(c.content)
              ? c.content.map((x) => (x as { text?: string }).text || '').join('')
              : JSON.stringify(c.content);

        const skill = found.skills.find((s) => s.id === c.tool_use_id);
        if (skill) skill.result = resultContent;

        const mcp = found.mcpTools.find((m) => m.id === c.tool_use_id);
        if (mcp) mcp.result = resultContent;

        const fsOp = found.fileSystemOps.find((f) => f.toolUseId === c.tool_use_id);
        if (fsOp) fsOp.result = resultContent;
      }
    }
  }

  // CLAUDE.md 섹션 파싱
  if (found.claudeMd) {
    found.claudeMdSections = parseClaudeMdSections(found.claudeMd);
  }

  return found;
}
