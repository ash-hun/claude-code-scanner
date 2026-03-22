import { describe, it, expect } from 'vitest';
import { esc, escAttr } from '@shared/sanitize';

describe('esc', () => {
  it('HTML 엔티티 이스케이프', () => {
    expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  it('& 이스케이프', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('일반 텍스트는 그대로', () => {
    expect(esc('hello world')).toBe('hello world');
  });

  it('숫자 입력 처리', () => {
    expect(esc(42)).toBe('42');
  });

  it('null/undefined 처리', () => {
    expect(esc(null)).toBe('null');
    expect(esc(undefined)).toBe('undefined');
  });
});

describe('escAttr', () => {
  it('따옴표 추가 이스케이프', () => {
    expect(escAttr('value="test"')).toBe('value=&quot;test&quot;');
  });

  it('HTML + 따옴표 복합', () => {
    expect(escAttr('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;');
  });
});
