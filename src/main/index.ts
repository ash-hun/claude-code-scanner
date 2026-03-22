import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { cleanupProxy } from './proxy-server';
import { ensurePostgres } from './docker-pg';
import { initDB, closeDB } from './db';

let mainWin: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWin;
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 620,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 12, y: 19 } }
      : {}),
    title: 'Claude Code Scanner',
    backgroundColor: '#1e1e1e',
    show: false,
  });

  // 개발 모드: Vite dev server, 프로덕션: 빌드된 파일
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
    // Vite가 아직 준비 안 됐을 때 재시도
    win.webContents.on('did-fail-load', () => {
      setTimeout(() => {
        if (!win.isDestroyed()) win.loadURL('http://localhost:5173');
      }, 1500);
    });
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  win.once('ready-to-show', () => win.show());
  // 안전장치: ready-to-show가 발화하지 않을 경우
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  }, 3000);

  mainWin = win;

  // 외부 링크는 브라우저에서 열기
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  // Docker PostgreSQL 확인/생성 → DB 초기화
  await ensurePostgres();
  await initDB();

  registerIpcHandlers(getMainWindow);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWin && !mainWin.isDestroyed()) {
      mainWin.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  cleanupProxy();
  closeDB();
});
