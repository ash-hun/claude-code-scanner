/** CLAUDE.md 섹션 정보 */
export interface ClaudeMdSection {
  label: string;
  path: string;
  content: string;
  cls: 'green' | 'cyan';
  scope: 'global' | 'local';
}

/** Slash Command 정보 */
export interface SlashCommandInfo {
  name: string;
  tag: string;
  full: string;
}

/** Skill 호출 정보 */
export interface SkillInfo {
  id: string;
  input: Record<string, unknown>;
  result?: string;
}

/** Sub-Agent 호출 정보 */
export interface SubAgentInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  childRequestIds?: number[];
}

/** MCP 도구 호출 정보 */
export interface McpToolInfo {
  id: string;
  name: string;
  serverName: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
}

/** File System 오퍼레이션 */
export interface FileSystemOp {
  type: 'read' | 'write' | 'edit' | 'glob' | 'grep' | 'bash';
  toolUseId: string;
  input: Record<string, unknown>;
  result?: string;
}

/** 메커니즘 감지 결과 */
export interface MechanismDetection {
  claudeMd: string | null;
  claudeMdSections: ClaudeMdSection[];
  outputStyle: string[] | null;
  slashCommands: SlashCommandInfo[];
  skills: SkillInfo[];
  subAgents: SubAgentInfo[];
  mcpTools: McpToolInfo[];
  fileSystemOps: FileSystemOp[];
}
