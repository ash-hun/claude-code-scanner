import type { PricingTable, ModelPricing, CostBreakdown } from './types/pricing';
import type { TokenUsage } from './types/capture';

/** 기본 가격표 (2026-03-22 기준) */
export const DEFAULT_PRICING: PricingTable = {
  lastUpdated: '2026-03-22',
  models: {
    'opus-4-5': { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
    'opus-4-6': { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
    'opus-4-1': { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, cacheWritePerMTok: 18.75 },
    'opus-4-0': { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, cacheWritePerMTok: 18.75 },
    'sonnet': { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75 },
    'haiku': { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
  },
};

/**
 * 모델 문자열에서 가격표 키를 매칭.
 * 예: "claude-sonnet-4-6-20260322" → "sonnet"
 */
export function matchModelPricing(model: string, table: PricingTable = DEFAULT_PRICING): ModelPricing {
  const m = model.toLowerCase();

  // 구체적 패턴 먼저 매칭
  for (const [key, pricing] of Object.entries(table.models)) {
    if (m.includes(key)) return pricing;
  }

  // 기본값: sonnet 가격
  return table.models['sonnet'] || { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75 };
}

/**
 * 토큰 사용량과 모델 정보로 비용 계산.
 */
export function calculateCost(
  usage: TokenUsage,
  model: string,
  table?: PricingTable,
): CostBreakdown {
  const pricing = matchModelPricing(model, table);

  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
  const totalInputTokens = inputTokens + cacheReadTokens + cacheWriteTokens;

  const inputCost = (inputTokens * pricing.inputPerMTok) / 1_000_000;
  const outputCost = (outputTokens * pricing.outputPerMTok) / 1_000_000;
  const cacheReadCost = (cacheReadTokens * pricing.cacheReadPerMTok) / 1_000_000;
  const cacheWriteCost = (cacheWriteTokens * pricing.cacheWritePerMTok) / 1_000_000;
  const totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;

  const cacheHitRate = totalInputTokens > 0
    ? Math.round((cacheReadTokens / totalInputTokens) * 100)
    : 0;

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalInputTokens,
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    totalCost,
    cacheHitRate,
  };
}
