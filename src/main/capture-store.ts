import { getPool } from './db';
import { detectMechanisms } from '../shared/mechanism-detector';
import { calculateCost } from '../shared/pricing';
import type { CaptureRequest, CaptureResponse, TokenUsage, AnthropicRequestBody } from '../shared/types/capture';

/**
 * 캡처된 요청을 DB에 저장.
 */
export async function saveRequest(req: CaptureRequest): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  const model = (req.body as AnthropicRequestBody)?.model || null;
  const mechanisms = req.body ? detectMechanisms(req.body) : null;

  try {
    await pool.query(
      `INSERT INTO captures (id, session_id, ts, method, path, request_body, model, mechanisms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [req.id, req.sessionId, req.ts, req.method, req.path,
       JSON.stringify(req.body), model, JSON.stringify(mechanisms)],
    );
  } catch (err) {
    console.error('[DB] saveRequest error:', (err as Error).message);
  }
}

/**
 * 캡처된 응답을 DB에 업데이트.
 */
export async function saveResponse(resp: CaptureResponse): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  // 토큰/비용 계산
  let inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheWrite = 0, cost = 0;
  const body = resp.body as Record<string, unknown> | null;
  const usage = body?.usage as TokenUsage | undefined;

  if (usage) {
    // 모델 정보를 가져오기 위해 DB에서 request_body 조회
    try {
      const result = await getPool()?.query('SELECT model FROM captures WHERE id = $1', [resp.id]);
      const model = result?.rows?.[0]?.model || '';
      const costResult = calculateCost(usage, model);
      inputTokens = costResult.totalInputTokens;
      outputTokens = costResult.outputTokens;
      cacheRead = costResult.cacheReadTokens;
      cacheWrite = costResult.cacheWriteTokens;
      cost = costResult.totalCost;
    } catch { /* 무시 */ }
  }

  try {
    await pool.query(
      `UPDATE captures SET
         response_body = $1, status_code = $2, latency_ms = $3,
         input_tokens = $4, output_tokens = $5,
         cache_read_tokens = $6, cache_write_tokens = $7, cost = $8
       WHERE id = $9`,
      [JSON.stringify(resp.body), resp.status, resp.latencyMs,
       inputTokens, outputTokens, cacheRead, cacheWrite, cost, resp.id],
    );
  } catch (err) {
    console.error('[DB] saveResponse error:', (err as Error).message);
  }
}

/**
 * 세션별 캡처 목록 조회.
 */
export async function listCaptures(opts: { sessionId?: string; limit?: number } = {}) {
  const pool = getPool();
  if (!pool) return [];

  const { sessionId, limit = 500 } = opts;
  let query = 'SELECT * FROM captures';
  const params: unknown[] = [];

  if (sessionId) {
    query += ' WHERE session_id = $1';
    params.push(sessionId);
  }
  query += ' ORDER BY ts DESC LIMIT $' + (params.length + 1);
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * 세션 삭제.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query('DELETE FROM captures WHERE session_id = $1', [sessionId]);
}

/**
 * 전체 삭제.
 */
export async function clearAll(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await pool.query('DELETE FROM captures');
}

/**
 * 히스토리 세션 목록 (Stats용).
 */
export async function getSessionList() {
  const pool = getPool();
  if (!pool) return [];

  const result = await pool.query(`
    SELECT session_id,
           MIN(ts) as start_time,
           COUNT(*) as request_count,
           SUM(cost) as total_cost,
           SUM(input_tokens) as total_input_tokens,
           SUM(output_tokens) as total_output_tokens,
           MODE() WITHIN GROUP (ORDER BY model) as top_model
    FROM captures
    GROUP BY session_id
    ORDER BY MIN(ts) DESC
    LIMIT 50
  `);
  return result.rows;
}
