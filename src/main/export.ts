import { writeFileSync } from 'fs';
import { listCaptures } from './capture-store';

/**
 * 캡처 데이터를 JSON으로 내보내기.
 */
export async function exportAsJson(filePath: string, sessionId?: string): Promise<void> {
  const rows = await listCaptures({ sessionId, limit: 10000 });
  writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');
}
