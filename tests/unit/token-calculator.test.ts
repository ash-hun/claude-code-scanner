import { describe, it, expect } from 'vitest';
import { calculateCost, matchModelPricing, DEFAULT_PRICING } from '@shared/pricing';
import type { TokenUsage } from '@shared/types/capture';

describe('matchModelPricing', () => {
  it('sonnet 모델 매칭', () => {
    const pricing = matchModelPricing('claude-sonnet-4-6-20260322');
    expect(pricing.inputPerMTok).toBe(3);
    expect(pricing.outputPerMTok).toBe(15);
  });

  it('haiku 모델 매칭', () => {
    const pricing = matchModelPricing('claude-haiku-4-5-20251001');
    expect(pricing.inputPerMTok).toBe(1);
  });

  it('opus-4-6 매칭', () => {
    const pricing = matchModelPricing('claude-opus-4-6-20260301');
    expect(pricing.inputPerMTok).toBe(5);
    expect(pricing.outputPerMTok).toBe(25);
  });

  it('opus-4-1 (이전 세대) 매칭', () => {
    const pricing = matchModelPricing('claude-opus-4-1-20260301');
    expect(pricing.inputPerMTok).toBe(15);
    expect(pricing.outputPerMTok).toBe(75);
  });

  it('알 수 없는 모델 → sonnet 기본값', () => {
    const pricing = matchModelPricing('unknown-model');
    expect(pricing.inputPerMTok).toBe(3);
  });
});

describe('calculateCost', () => {
  it('기본 비용 계산', () => {
    const usage: TokenUsage = {
      input_tokens: 1000,
      output_tokens: 500,
    };
    const cost = calculateCost(usage, 'claude-sonnet-4-6');
    expect(cost.inputTokens).toBe(1000);
    expect(cost.outputTokens).toBe(500);
    expect(cost.totalCost).toBeCloseTo(0.003 + 0.0075, 6);
  });

  it('캐시 포함 비용 계산', () => {
    const usage: TokenUsage = {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 900,
      cache_creation_input_tokens: 0,
    };
    const cost = calculateCost(usage, 'claude-sonnet-4-6');
    expect(cost.cacheReadTokens).toBe(900);
    expect(cost.cacheHitRate).toBe(90);
    expect(cost.cacheReadCost).toBeCloseTo(900 * 0.3 / 1_000_000, 8);
  });

  it('토큰 0 → 비용 0', () => {
    const usage: TokenUsage = { input_tokens: 0, output_tokens: 0 };
    const cost = calculateCost(usage, 'claude-sonnet-4-6');
    expect(cost.totalCost).toBe(0);
    expect(cost.cacheHitRate).toBe(0);
  });

  it('실제 응답 fixture 비용 계산', () => {
    const usage: TokenUsage = {
      input_tokens: 1500,
      output_tokens: 42,
      cache_read_input_tokens: 1200,
      cache_creation_input_tokens: 50,
    };
    const cost = calculateCost(usage, 'claude-sonnet-4-6-20260322');
    expect(cost.totalInputTokens).toBe(1500 + 1200 + 50);
    expect(cost.totalCost).toBeGreaterThan(0);
    expect(cost.cacheHitRate).toBeGreaterThan(0);
  });
});
