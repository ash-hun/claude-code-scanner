import { describe, it, expect } from 'vitest';
import { parseClaudeMdSections } from '@shared/claude-md-parser';

describe('parseClaudeMdSections', () => {
  it('global CLAUDE.md 단일 섹션', () => {
    const input = `Contents of /Users/ram/.claude/CLAUDE.md (user's private global instructions for all projects):\n\n# Global Rules\ncontent here`;
    const sections = parseClaudeMdSections(input);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('📋 Global CLAUDE.md');
    expect(sections[0].scope).toBe('global');
    expect(sections[0].cls).toBe('green');
    expect(sections[0].content).toContain('# Global Rules');
  });

  it('local CLAUDE.md 단일 섹션', () => {
    const input = `Contents of /project/CLAUDE.md (project instructions, checked into the codebase):\n\n# Project Rules\ncontent`;
    const sections = parseClaudeMdSections(input);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('📋 Local CLAUDE.md');
    expect(sections[0].scope).toBe('local');
    expect(sections[0].cls).toBe('cyan');
  });

  it('global + local 복수 섹션', () => {
    const input = [
      `Contents of /Users/ram/.claude/CLAUDE.md (user's private global instructions for all projects):\n\n# Global\nglobal content`,
      `Contents of /project/CLAUDE.md (project instructions, checked into the codebase):\n\n# Local\nlocal content`,
    ].join('\n\n');
    const sections = parseClaudeMdSections(input);
    expect(sections).toHaveLength(2);
    expect(sections[0].scope).toBe('global');
    expect(sections[1].scope).toBe('local');
  });

  it('global rule 파일', () => {
    const input = `Contents of /Users/ram/.claude/rules/git-rules.md (user's private global instructions for all projects):\n\n# Git Rules\ncontent`;
    const sections = parseClaudeMdSections(input);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('📜 Global Rule: git-rules.md');
    expect(sections[0].scope).toBe('global');
  });

  it('memory 파일', () => {
    const input = `Contents of /Users/ram/.claude/projects/foo/memory/MEMORY.md (user's auto-memory, persists across conversations):\n\n# Memory\ncontent`;
    const sections = parseClaudeMdSections(input);
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('🧠 Memory: MEMORY.md');
  });

  it('4개 섹션 분리', () => {
    const input = [
      `Contents of /Users/ram/.claude/CLAUDE.md (user's private global instructions for all projects):\n\n# Global\ncontent`,
      `Contents of /Users/ram/.claude/rules/git-rules.md (user's private global instructions for all projects):\n\n# Git\ncontent`,
      `Contents of /project/CLAUDE.md (project instructions, checked into the codebase):\n\n# Local\ncontent`,
      `Contents of /Users/ram/.claude/projects/foo/memory/MEMORY.md (user's auto-memory, persists across conversations):\n\n# Memory\ncontent`,
    ].join('\n\n');
    const sections = parseClaudeMdSections(input);
    expect(sections).toHaveLength(4);
    expect(sections[0].label).toBe('📋 Global CLAUDE.md');
    expect(sections[1].label).toBe('📜 Global Rule: git-rules.md');
    expect(sections[2].label).toBe('📋 Local CLAUDE.md');
    expect(sections[3].label).toBe('🧠 Memory: MEMORY.md');
  });

  it('섹션 없으면 빈 배열', () => {
    expect(parseClaudeMdSections('아무 내용 없음')).toHaveLength(0);
  });
});
