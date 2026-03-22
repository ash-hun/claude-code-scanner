import type { CaptureItem } from '../store/capture-store';
import type { AnthropicContentBlock } from '../../shared/types/capture';

export interface CaptureGroup {
  userMessage: string;
  entries: CaptureItem[];
  totalLatencyMs: number;
  hasError: boolean;
  mainModel: string;
  firstTs: string;
}

/**
 * 캡처 목록을 사용자의 실제 Claude Code 요청 기준으로 그룹핑.
 *
 * 핵심 판별법:
 * - 진짜 사용자 입력 = <system-reminder> 태그가 함께 있는 user 메시지
 *   (Claude Code는 사용자 입력과 함께 항상 CLAUDE.md 등을 주입)
 * - Sub-agent 태스크 = <system-reminder> 없는 독립적 user 메시지
 *
 * 그룹핑 규칙:
 * 1. 새로운 사용자 입력 감지 → 새 그룹
 * 2. 사용자 입력 없음 (sub-agent, tool 후속) → 이전 그룹에 포함
 */
export function groupCaptures(entries: CaptureItem[]): CaptureGroup[] {
  if (entries.length === 0) return [];

  const chronological = [...entries].reverse();
  const groups: CaptureGroup[] = [];
  let currentGroup: CaptureGroup | null = null;

  for (const entry of chronological) {
    const userMsg = extractRealUserInput(entry);

    if (userMsg === null) {
      // Sub-agent, tool 후속, 시스템 호출 → 이전 그룹에 포함
      if (currentGroup) {
        addToGroup(currentGroup, entry);
      } else {
        currentGroup = makeGroup('(system)', entry);
        groups.push(currentGroup);
      }
    } else if (!currentGroup || currentGroup.userMessage !== userMsg) {
      // 새로운 사용자 입력 → 새 그룹
      currentGroup = makeGroup(userMsg, entry);
      groups.push(currentGroup);
    } else {
      // 같은 사용자 입력의 후속 호출
      addToGroup(currentGroup, entry);
    }
  }

  groups.reverse();
  for (const g of groups) g.entries.reverse();
  return groups;
}

function makeGroup(userMessage: string, entry: CaptureItem): CaptureGroup {
  return {
    userMessage,
    entries: [entry],
    totalLatencyMs: entry.response?.latencyMs || 0,
    hasError: (entry.response?.status ?? 200) >= 400,
    mainModel: (entry.request.body?.model as string) || '',
    firstTs: entry.request.ts,
  };
}

function addToGroup(group: CaptureGroup, entry: CaptureItem): void {
  group.entries.push(entry);
  group.totalLatencyMs += entry.response?.latencyMs || 0;
  if ((entry.response?.status ?? 200) >= 400) group.hasError = true;
  // opus 등 메인 모델 우선 표시
  const model = (entry.request.body?.model as string) || '';
  if (model.includes('opus') || !group.mainModel) {
    group.mainModel = model || group.mainModel;
  }
}

function stripSystemTags(text: string): string {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, '')
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, '')
    .replace(/<local-command[\w-]*>[\s\S]*?<\/local-command[\w-]*>/g, '')
    .replace(/<tool-[\w-]*>[\s\S]*?<\/tool-[\w-]*>/g, '')
    .replace(/<user-prompt[\w-]*>[\s\S]*?<\/user-prompt[\w-]*>/g, '')
    .replace(/<ide_[\w-]*>[\s\S]*?<\/ide_[\w-]*>/g, '')
    .replace(/<fast_mode_info>[\s\S]*?<\/fast_mode_info>/g, '')
    .trim();
}

/**
 * 진짜 사용자 입력을 추출. 찾지 못하면 null.
 *
 * 판별 기준:
 * 1. tool_result가 있는 user 메시지 → 건너뜀 (tool 후속)
 * 2. <system-reminder>가 없는 user 메시지 → 건너뜀 (sub-agent 태스크)
 * 3. <system-reminder>가 있는 user 메시지에서 태그 제거 후 남은 텍스트 = 사용자 입력
 */
function extractRealUserInput(item: CaptureItem): string | null {
  const msgs = item.request.body?.messages;
  if (!msgs || msgs.length === 0) return null;

  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role !== 'user') continue;

    const content = msgs[i].content;
    const blocks: AnthropicContentBlock[] = Array.isArray(content)
      ? content as AnthropicContentBlock[]
      : typeof content === 'string'
        ? [{ type: 'text', text: content }]
        : [];

    // tool_result 포함 → 시스템 생성 메시지, 건너뜀
    if (blocks.some(b => b.type === 'tool_result')) continue;

    // 이 메시지의 전체 텍스트를 합산
    const allText = blocks
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text!)
      .join('\n');

    // ★ 핵심: <system-reminder>가 없으면 sub-agent 태스크 → 건너뜀
    if (!allText.includes('<system-reminder>')) continue;

    // system-reminder가 있는 메시지에서 태그 제거 후 순수 입력 추출
    const plain = stripSystemTags(allText);
    if (plain.length > 0) {
      return plain.slice(0, 120);
    }
  }

  return null;
}
