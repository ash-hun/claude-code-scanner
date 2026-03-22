import { ipcMain, BrowserWindow, dialog } from 'electron';
import { IPC } from '../shared/types/ipc';
import { DEFAULT_PROXY_PORT } from '../shared/constants';
import { startProxy, stopProxy, getProxyStatus } from './proxy-server';
import { listCaptures, deleteSession, clearAll, getSessionList } from './capture-store';
import { exportAsJson } from './export';

/**
 * 모든 IPC 핸들러 등록.
 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // 프록시 제어
  ipcMain.handle(IPC.PROXY_START, async (_event, config: { port: number }) => {
    const win = getMainWindow();
    if (!win) return { error: 'No main window' };
    return startProxy(config.port || DEFAULT_PROXY_PORT, win);
  });

  ipcMain.handle(IPC.PROXY_STOP, async () => {
    return stopProxy();
  });

  ipcMain.handle(IPC.PROXY_STATUS, async () => {
    return getProxyStatus();
  });

  // 캡처 영속 저장
  ipcMain.handle('captures:list', async (_event, opts) => {
    return listCaptures(opts || {});
  });

  ipcMain.handle('captures:delete-session', async (_event, sessionId: string) => {
    await deleteSession(sessionId);
  });

  ipcMain.handle('captures:clear-all', async () => {
    await clearAll();
  });

  // 히스토리 세션 목록
  ipcMain.handle('captures:sessions', async () => {
    return getSessionList();
  });

  // 내보내기
  ipcMain.handle('export:json', async (_event, opts: { sessionId?: string }) => {
    const win = getMainWindow();
    if (!win) return { error: 'No window' };

    const result = await dialog.showSaveDialog(win, {
      title: 'Export as JSON',
      defaultPath: `claude-scanner-export-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };

    await exportAsJson(result.filePath, opts.sessionId);
    return { path: result.filePath };
  });

}
