import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PG_CONFIG } from './docker-pg';

let pool: Pool | null = null;

/**
 * PostgreSQL 커넥션 풀 초기화 + 테이블 생성.
 */
export async function initDB(): Promise<boolean> {
  try {
    pool = new Pool({
      ...PG_CONFIG,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // 연결 테스트
    const client = await pool.connect();
    client.release();

    // 스키마 초기화 — 개발(dist/main/main/) + 프로덕션(dist/) 모두 지원
    const candidates = [
      join(__dirname, '..', '..', '..', 'scripts', 'init-db.sql'),  // dev: dist/main/main/ → root
      join(__dirname, '..', '..', 'scripts', 'init-db.sql'),        // prod
      join(__dirname, '..', 'scripts', 'init-db.sql'),
    ];
    let initSql = '';
    for (const p of candidates) {
      try { initSql = readFileSync(p, 'utf8'); break; } catch { /* try next */ }
    }
    if (!initSql) {
      console.warn('[DB] init-db.sql not found, skipping schema init');
      return true;
    }
    await pool.query(initSql);

    console.log('[DB] Database initialized successfully.');
    return true;
  } catch (err) {
    console.error('[DB] Failed to initialize database:', (err as Error).message);
    pool = null;
    return false;
  }
}

/** DB 풀 가져오기 (없으면 null) */
export function getPool(): Pool | null {
  return pool;
}

/** 앱 종료 시 풀 정리 */
export async function closeDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
