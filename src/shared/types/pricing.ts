/** 모델별 가격 ($/MTok) */
export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}

/** 가격표 */
export interface PricingTable {
  lastUpdated: string;
  models: Record<string, ModelPricing>;
}

/** 비용 계산 결과 */
export interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalInputTokens: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  totalCost: number;
  cacheHitRate: number;
}
