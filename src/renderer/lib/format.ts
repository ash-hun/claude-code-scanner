/** 토큰 수를 읽기 좋게 포매팅 (1500 → "1.5K", 1500000 → "1.5M") */
export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

/** 바이트를 KB로 포매팅 */
export function fmtKB(bytes: number): string {
  return (bytes / 1024).toFixed(1);
}

/** 비용을 달러 포매팅 */
export function fmtCost(cost: number): string {
  return '$' + cost.toFixed(4);
}

/** 레이턴시 포매팅 */
export function fmtLatency(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
  return ms + 'ms';
}

/** 시간 포매팅 (ISO → HH:MM:SS) */
export function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}
