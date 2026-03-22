/** 세션 통계 */
export interface SessionStats {
  sessionId: string;
  startTime: string;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  modelsUsed: Record<string, number>;
  mechanismCounts: Record<string, number>;
  costOverTime: Array<{ ts: string; cumulativeCost: number }>;
}

/** 히스토리 통계 */
export interface HistoricalStats {
  sessions: Array<{
    sessionId: string;
    startTime: string;
    requestCount: number;
    totalCost: number;
    topModel: string;
  }>;
  allTimeTotalCost: number;
  allTimeTotalRequests: number;
  allTimeTotalTokens: number;
}
