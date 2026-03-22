import type { AnthropicResponseBody } from './types/capture';

/**
 * SSE 스트림 텍스트를 완전한 Anthropic 메시지 객체로 재조합.
 *
 * message_start → content_block_start → content_block_delta → message_delta
 * 이벤트들을 순서대로 처리하여 하나의 응답 객체를 만든다.
 */
export function parseSseStream(text: string): AnthropicResponseBody | null {
  try {
    let msg: AnthropicResponseBody | null = null;

    function processEvent(data: string): void {
      try {
        const d = JSON.parse(data);

        if (d.type === 'message_start') {
          msg = { ...d.message, _streaming: true };
        }

        if (d.type === 'content_block_start' && msg) {
          if (!msg.content) msg.content = [];
          (msg.content as Record<string, unknown>[])[d.index] = { ...d.content_block };
        }

        if (d.type === 'content_block_delta' && msg) {
          const block = msg.content?.[d.index] as Record<string, unknown> | undefined;
          if (block) {
            if (d.delta.type === 'text_delta') {
              block.text = ((block.text as string) || '') + d.delta.text;
            }
            if (d.delta.type === 'thinking_delta') {
              block.thinking = ((block.thinking as string) || '') + d.delta.thinking;
            }
          }
        }

        if (d.type === 'message_delta' && msg) {
          if (d.delta) Object.assign(msg, d.delta);
          if (d.usage) msg.usage = { ...msg.usage, ...d.usage };
        }
      } catch {
        // 개별 이벤트 파싱 실패는 무시
      }
    }

    const events: { event?: string; data?: string } = {};

    for (const rawLine of text.split('\n')) {
      const line = rawLine.replace(/\r$/, '');
      const m = line.match(/^(event|data):\s?(.*)/);

      if (m) {
        events[m[1] as 'event' | 'data'] = m[2].trimEnd();
      }

      if (line === '' && events.data) {
        processEvent(events.data);
        events.event = undefined;
        events.data = undefined;
      }
    }

    // 마지막 이벤트 처리 (빈 줄 없이 끝날 수 있음)
    if (events.data) processEvent(events.data);

    return msg || null;
  } catch {
    return null;
  }
}
