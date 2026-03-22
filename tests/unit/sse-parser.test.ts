import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseSseStream } from '@shared/sse-parser';

const sseFixture = readFileSync(join(__dirname, '../fixtures/sample-sse-stream.txt'), 'utf8');

describe('parseSseStream', () => {
  it('SSE 스트림을 완전한 메시지 객체로 재조합', () => {
    const msg = parseSseStream(sseFixture);
    expect(msg).not.toBeNull();
    expect(msg!.role).toBe('assistant');
    expect(msg!.model).toBe('claude-sonnet-4-6-20260322');
  });

  it('content_block_delta 텍스트 합산', () => {
    const msg = parseSseStream(sseFixture);
    expect(msg!.content).toHaveLength(1);
    const block = msg!.content![0] as { type: string; text: string };
    expect(block.type).toBe('text');
    expect(block.text).toBe('Hello world');
  });

  it('message_delta에서 stop_reason 추출', () => {
    const msg = parseSseStream(sseFixture);
    expect(msg!.stop_reason).toBe('end_turn');
  });

  it('message_delta에서 usage 병합', () => {
    const msg = parseSseStream(sseFixture);
    expect(msg!.usage).toBeDefined();
    expect(msg!.usage!.output_tokens).toBe(5);
  });

  it('빈 문자열 → null 반환', () => {
    expect(parseSseStream('')).toBeNull();
  });

  it('유효하지 않은 텍스트 → null 반환', () => {
    expect(parseSseStream('not an sse stream')).toBeNull();
  });

  it('thinking_delta 처리', () => {
    const stream = [
      'event: message_start',
      'data: {"type":"message_start","message":{"id":"m1","role":"assistant","content":[],"model":"claude-sonnet-4-6","usage":{"input_tokens":10,"output_tokens":0}}}',
      '',
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me think"}}',
      '',
    ].join('\n');

    const msg = parseSseStream(stream);
    expect(msg).not.toBeNull();
    const block = msg!.content![0] as { thinking: string };
    expect(block.thinking).toBe('Let me think');
  });
});
