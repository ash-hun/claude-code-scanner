import { describe, it, expect } from 'vitest';
import { detectMechanisms } from '@shared/mechanism-detector';
import type { AnthropicRequestBody } from '@shared/types/capture';
import sampleRequest from '../fixtures/sample-request.json';

describe('detectMechanisms', () => {
  it('null body → 모든 필드 비어있음', () => {
    const det = detectMechanisms(null);
    expect(det.claudeMd).toBeNull();
    expect(det.outputStyle).toBeNull();
    expect(det.slashCommands).toHaveLength(0);
    expect(det.skills).toHaveLength(0);
    expect(det.subAgents).toHaveLength(0);
    expect(det.mcpTools).toHaveLength(0);
    expect(det.fileSystemOps).toHaveLength(0);
  });

  it('빈 body → 모든 필드 비어있음', () => {
    const det = detectMechanisms({} as AnthropicRequestBody);
    expect(det.claudeMd).toBeNull();
    expect(det.outputStyle).toBeNull();
  });

  it('system-reminder → CLAUDE.md 감지', () => {
    const body: AnthropicRequestBody = {
      messages: [{
        role: 'user',
        content: '<system-reminder>\nContents of /path/CLAUDE.md (desc):\n\ncontent\n</system-reminder>\nhello',
      }],
    };
    const det = detectMechanisms(body);
    expect(det.claudeMd).not.toBeNull();
    expect(det.claudeMd).toContain('Contents of');
    expect(det.claudeMdSections).toHaveLength(1);
  });

  it('system 배열 2개 이상 → outputStyle 감지', () => {
    const body: AnthropicRequestBody = {
      system: [
        { type: 'text', text: 'base system' },
        { type: 'text', text: 'output style' },
      ],
      messages: [],
    };
    const det = detectMechanisms(body);
    expect(det.outputStyle).not.toBeNull();
    expect(det.outputStyle).toHaveLength(2);
  });

  it('command-message → slashCommand 감지', () => {
    const body: AnthropicRequestBody = {
      messages: [{
        role: 'user',
        content: '<command-message>commit</command-message>\n/commit',
      }],
    };
    const det = detectMechanisms(body);
    expect(det.slashCommands).toHaveLength(1);
    expect(det.slashCommands[0].tag).toContain('commit');
  });

  it('tool_use Skill → skills 감지', () => {
    const body: AnthropicRequestBody = {
      messages: [{
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'Skill', input: { skill: 'e2e' } }],
      }],
    };
    const det = detectMechanisms(body);
    expect(det.skills).toHaveLength(1);
    expect(det.skills[0].input.skill).toBe('e2e');
  });

  it('tool_use Agent → subAgents 감지', () => {
    const body: AnthropicRequestBody = {
      messages: [{
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu_2', name: 'Agent', input: { description: 'test' } }],
      }],
    };
    const det = detectMechanisms(body);
    expect(det.subAgents).toHaveLength(1);
    expect(det.subAgents[0].name).toBe('Agent');
  });

  it('tool_use mcp__ → mcpTools 감지', () => {
    const body: AnthropicRequestBody = {
      messages: [{
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'tu_3', name: 'mcp__github__create_pr', input: { title: 'PR' } }],
      }],
    };
    const det = detectMechanisms(body);
    expect(det.mcpTools).toHaveLength(1);
    expect(det.mcpTools[0].serverName).toBe('github');
    expect(det.mcpTools[0].toolName).toBe('create_pr');
  });

  it('tool_use Read/Bash → fileSystemOps 감지', () => {
    const body: AnthropicRequestBody = {
      messages: [{
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tu_r', name: 'Read', input: { file_path: '/src/main.ts' } },
          { type: 'tool_use', id: 'tu_b', name: 'Bash', input: { command: 'npm test' } },
        ],
      }],
    };
    const det = detectMechanisms(body);
    expect(det.fileSystemOps).toHaveLength(2);
    expect(det.fileSystemOps[0].type).toBe('read');
    expect(det.fileSystemOps[1].type).toBe('bash');
  });

  it('tool_result → skill 결과 연결', () => {
    const body: AnthropicRequestBody = {
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tu_s1', name: 'Skill', input: { skill: 'commit' } }],
        },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tu_s1', content: 'Done' }],
        },
      ],
    };
    const det = detectMechanisms(body);
    expect(det.skills).toHaveLength(1);
    expect(det.skills[0].result).toBe('Done');
  });

  it('sample fixture — 7가지 메커니즘 통합 감지', () => {
    const det = detectMechanisms(sampleRequest as AnthropicRequestBody);
    expect(det.claudeMd).not.toBeNull();
    expect(det.claudeMdSections.length).toBeGreaterThanOrEqual(4);
    expect(det.outputStyle).not.toBeNull();
    expect(det.slashCommands).toHaveLength(1);
    expect(det.skills).toHaveLength(1);
    expect(det.subAgents).toHaveLength(1);
    expect(det.mcpTools).toHaveLength(1);
    expect(det.fileSystemOps).toHaveLength(2); // Read + Bash
  });
});
