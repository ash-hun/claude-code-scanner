import { parseClaudeMdSections } from './claude-md-parser';

/** 파싱된 텍스트 조각 */
export interface TextPart {
  type: 'text' | 'injected';
  content: string;
  label?: string;
  cls?: string;
}

/**
 * user 메시지 텍스트를 사용자가 직접 입력한 부분(typed)과
 * Claude Code가 주입한 부분(injected)으로 분리.
 *
 * injected 패턴:
 * - <system-reminder>...</system-reminder>
 * - <command-message>...</command-message>
 */
export function parseUserText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const blockRe = /(<system-reminder>[\s\S]*?<\/system-reminder>|<command-message>[\s\S]*?<\/command-message>)/g;

  let pos = 0;
  let m: RegExpExecArray | null;

  while ((m = blockRe.exec(text)) !== null) {
    if (m.index > pos) {
      const plain = text.slice(pos, m.index).trim();
      if (plain) parts.push({ type: 'text', content: plain });
    }

    const raw = m[0];
    if (raw.startsWith('<system-reminder>')) {
      const inner = raw.slice('<system-reminder>'.length, -'</system-reminder>'.length);

      if (/skills are available/i.test(inner)) {
        parts.push({ type: 'injected', label: '🔧 Skills', content: inner, cls: 'green' });
      } else if (/Contents of /i.test(inner)) {
        const sections = parseClaudeMdSections(inner);
        if (sections.length > 0) {
          for (const s of sections) {
            parts.push({ type: 'injected', label: s.label, content: s.content, cls: s.cls });
          }
        } else {
          parts.push({ type: 'injected', label: '📋 system-reminder', content: inner, cls: 'green' });
        }
      } else {
        parts.push({ type: 'injected', label: '📋 system-reminder', content: inner, cls: 'green' });
      }
    } else {
      const inner = raw.slice('<command-message>'.length, -'</command-message>'.length);
      parts.push({ type: 'injected', label: '⌨ slash command', content: inner, cls: 'yellow' });
    }

    pos = m.index + raw.length;
  }

  if (pos < text.length) {
    const plain = text.slice(pos).trim();
    if (plain) parts.push({ type: 'text', content: plain });
  }

  return parts;
}
