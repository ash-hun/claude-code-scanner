import { captureStore, type CaptureItem } from './capture-store';
import { calculateCost } from '../../shared/pricing';
import { detectMechanisms } from '../../shared/mechanism-detector';
import type { TokenUsage } from '../../shared/types/capture';

export interface SessionStatsData {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  costPerRequest: number;
  latencyBuckets: { label: string; count: number; pct: number }[];
  modelUsage: { model: string; count: number; pct: number }[];
  mechCounts: { label: string; icon: string; count: number }[];
  tokenAccumulation: { turn: number; sizeKB: number }[];
  maxSizeKB: number;
}

export function computeSessionStats(): SessionStatsData {
  const entries = captureStore.entries;
  const n = entries.length;

  if (n === 0) {
    return {
      totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0,
      totalCacheReadTokens: 0, totalCost: 0, avgLatencyMs: 0,
      cacheHitRate: 0, costPerRequest: 0,
      latencyBuckets: [], modelUsage: [], mechCounts: [], tokenAccumulation: [], maxSizeKB: 0,
    };
  }

  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCost = 0;
  let totalLatency = 0, latencyCount = 0;
  const latencies: number[] = [];
  const models = new Map<string, number>();
  const mechs = { claudeMd: 0, outputStyle: 0, slashCmd: 0, skill: 0, subAgent: 0, mcp: 0, fsOps: 0 };

  const accumulation: { turn: number; sizeKB: number }[] = [];

  // 역순 (entries는 최신 먼저이므로 reverse)
  const reversed = [...entries].reverse();

  for (let i = 0; i < reversed.length; i++) {
    const e = reversed[i];
    const usage = (e.response?.body as Record<string, unknown> | null)?.usage as TokenUsage | undefined;
    const model = (e.request.body?.model as string) || 'unknown';

    if (usage) {
      const cost = calculateCost(usage, model);
      totalInput += cost.totalInputTokens;
      totalOutput += cost.outputTokens;
      totalCacheRead += cost.cacheReadTokens;
      totalCost += cost.totalCost;
    }

    if (e.response?.latencyMs !== undefined) {
      totalLatency += e.response.latencyMs;
      latencyCount++;
      latencies.push(e.response.latencyMs);
    }

    models.set(model, (models.get(model) || 0) + 1);

    // 메커니즘 카운트
    const det = e.mechanisms || (e.request.body ? detectMechanisms(e.request.body) : null);
    if (det) {
      if (det.claudeMd) mechs.claudeMd++;
      if (det.outputStyle) mechs.outputStyle++;
      if (det.slashCommands.length > 0) mechs.slashCmd += det.slashCommands.length;
      if (det.skills.length > 0) mechs.skill += det.skills.length;
      if (det.subAgents.length > 0) mechs.subAgent += det.subAgents.length;
      if (det.mcpTools.length > 0) mechs.mcp += det.mcpTools.length;
      if (det.fileSystemOps.length > 0) mechs.fsOps += det.fileSystemOps.length;
    }

    // 토큰 누적 (요청 크기)
    const bodyBytes = e.request.body ? new TextEncoder().encode(JSON.stringify(e.request.body)).length : 0;
    accumulation.push({ turn: i + 1, sizeKB: Math.round(bodyBytes / 1024 * 10) / 10 });
  }

  // 레이턴시 분포
  const buckets = [
    { label: '0-1s', min: 0, max: 1000, count: 0 },
    { label: '1-3s', min: 1000, max: 3000, count: 0 },
    { label: '3-5s', min: 3000, max: 5000, count: 0 },
    { label: '5s+', min: 5000, max: Infinity, count: 0 },
  ];
  for (const l of latencies) {
    const bucket = buckets.find(b => l >= b.min && l < b.max);
    if (bucket) bucket.count++;
  }
  const latencyBuckets = buckets.map(b => ({
    label: b.label,
    count: b.count,
    pct: latencyCount > 0 ? Math.round(b.count / latencyCount * 100) : 0,
  }));

  // 모델 사용
  const modelUsage = [...models.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([model, count]) => ({ model, count, pct: Math.round(count / n * 100) }));

  // 메커니즘 빈도
  const mechCounts = [
    { label: 'CLAUDE.md', icon: '📋', count: mechs.claudeMd },
    { label: 'Skill', icon: '🔧', count: mechs.skill },
    { label: 'Sub-Agent', icon: '🤖', count: mechs.subAgent },
    { label: 'MCP', icon: '🔌', count: mechs.mcp },
    { label: 'Slash Cmd', icon: '⌨', count: mechs.slashCmd },
    { label: 'FS Ops', icon: '📁', count: mechs.fsOps },
  ];

  const cacheHitRate = totalInput > 0 ? Math.round(totalCacheRead / totalInput * 100) : 0;
  const maxSizeKB = accumulation.length > 0 ? Math.max(...accumulation.map(a => a.sizeKB)) : 0;

  return {
    totalRequests: n,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalCacheReadTokens: totalCacheRead,
    totalCost,
    avgLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
    cacheHitRate,
    costPerRequest: n > 0 ? totalCost / n : 0,
    latencyBuckets,
    modelUsage,
    mechCounts,
    tokenAccumulation: accumulation,
    maxSizeKB,
  };
}
