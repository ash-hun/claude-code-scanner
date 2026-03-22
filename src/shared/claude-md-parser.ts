import type { ClaudeMdSection } from './types/analysis';

/**
 * system-reminder 내부의 CLAUDE.md 텍스트를 섹션별로 파싱.
 *
 * "Contents of /path/to/CLAUDE.md (description):\n\ncontent" 패턴을 감지하여
 * global/local, CLAUDE.md/rules/memory로 분류한다.
 */
export function parseClaudeMdSections(inner: string): ClaudeMdSection[] {
  const re = /Contents of (.+?) \((.+?)\):\n\n([\s\S]*?)(?=\n\nContents of |\s*$)/g;
  const sections: ClaudeMdSection[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(inner)) !== null) {
    const filePath = m[1];
    const desc = m[2];
    const content = m[3].trim();
    const fname = filePath.split('/').pop() || filePath;

    const isGlobal = /global|private global/i.test(desc);
    const isMemory = /memory/i.test(desc) || /\/memory\//.test(filePath);

    let label: string;
    let cls: 'green' | 'cyan';

    if (isMemory) {
      label = '🧠 Memory: ' + fname;
      cls = 'green';
    } else if (/\/rules\//.test(filePath)) {
      label = (isGlobal ? '📜 Global Rule: ' : '📜 Local Rule: ') + fname;
      cls = isGlobal ? 'green' : 'cyan';
    } else if (/CLAUDE\.md$/i.test(filePath)) {
      label = isGlobal ? '📋 Global CLAUDE.md' : '📋 Local CLAUDE.md';
      cls = isGlobal ? 'green' : 'cyan';
    } else {
      label = '📋 ' + fname;
      cls = 'green';
    }

    sections.push({
      label,
      path: filePath,
      content,
      cls,
      scope: isGlobal ? 'global' : 'local',
    });
  }

  return sections;
}
