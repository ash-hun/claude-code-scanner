import { execSync, exec } from 'child_process';

const CONTAINER_NAME = 'claude-scanner-pg';
const PG_PORT = 9020;
const PG_USER = 'scanner';
const PG_PASS = 'scanner';
const PG_DB = 'claude_code_scanner';

/**
 * Docker에서 PostgreSQL 컨테이너가 실행 중인지 확인하고,
 * 없으면 자동으로 생성/시작한다.
 */
export async function ensurePostgres(): Promise<void> {
  // Docker 사용 가능 여부 확인
  if (!isDockerAvailable()) {
    console.warn('[DB] Docker not available. Database features disabled.');
    return;
  }

  // 컨테이너 상태 확인
  const status = getContainerStatus();

  if (status === 'running') {
    console.log('[DB] PostgreSQL container already running.');
    return;
  }

  if (status === 'exited' || status === 'created') {
    console.log('[DB] Starting existing PostgreSQL container...');
    execSync(`docker start ${CONTAINER_NAME}`, { stdio: 'pipe' });
    await waitForReady();
    return;
  }

  // 컨테이너가 없으면 새로 생성
  console.log('[DB] Creating PostgreSQL container...');
  try {
    execSync(
      `docker run -d --name ${CONTAINER_NAME} ` +
      `-p ${PG_PORT}:5432 ` +
      `-e POSTGRES_USER=${PG_USER} ` +
      `-e POSTGRES_PASSWORD=${PG_PASS} ` +
      `-e POSTGRES_DB=${PG_DB} ` +
      `-v claude-scanner-pgdata:/var/lib/postgresql/data ` +
      `postgres:16-alpine`,
      { stdio: 'pipe' },
    );
    console.log('[DB] PostgreSQL container created. Waiting for ready...');
    await waitForReady();
  } catch (err) {
    console.error('[DB] Failed to create PostgreSQL container:', (err as Error).message);
  }
}

function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function getContainerStatus(): string | null {
  try {
    const result = execSync(
      `docker inspect -f '{{.State.Status}}' ${CONTAINER_NAME}`,
      { stdio: 'pipe', encoding: 'utf8' },
    ).trim();
    return result;
  } catch {
    return null; // 컨테이너 없음
  }
}

async function waitForReady(maxRetries = 20): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync(
        `docker exec ${CONTAINER_NAME} pg_isready -U ${PG_USER}`,
        { stdio: 'pipe', timeout: 3000 },
      );
      console.log('[DB] PostgreSQL is ready.');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  console.warn('[DB] PostgreSQL did not become ready in time.');
}

export const PG_CONFIG = {
  host: '127.0.0.1',
  port: PG_PORT,
  user: PG_USER,
  password: PG_PASS,
  database: PG_DB,
};
