import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';
import type { BrowserWindow } from 'electron';
import { parseSseStream } from '../shared/sse-parser';
import { IPC } from '../shared/types/ipc';
import { ANTHROPIC_HOST, ANTHROPIC_PORT, PORT_MIN, PORT_MAX } from '../shared/constants';
import type { CaptureRequest, CaptureResponse } from '../shared/types/capture';
import type { ProxyStartResult } from '../shared/types/proxy';
import { saveRequest, saveResponse } from './capture-store';

let proxyServer: http.Server | null = null;
let sessionId: string = Date.now().toString();

export function getProxyServer(): http.Server | null {
  return proxyServer;
}

export function getSessionId(): string {
  return sessionId;
}

export function resetSessionId(): void {
  sessionId = Date.now().toString();
}

/**
 * MITM 프록시 서버 시작.
 * Claude Code CLI의 요청을 가로채어 Anthropic API로 전달하고,
 * 요청/응답을 renderer에 IPC로 전송한다.
 */
export function startProxy(port: number, mainWin: BrowserWindow): Promise<ProxyStartResult> {
  if (!Number.isInteger(port) || port < PORT_MIN || port > PORT_MAX) {
    return Promise.resolve({ error: `Invalid port: must be ${PORT_MIN}–${PORT_MAX}` });
  }

  if (proxyServer) {
    try {
      return Promise.resolve({ running: true, port: proxyServer.address()?.toString().includes(':') ? (proxyServer.address() as { port: number }).port : port });
    } catch {
      return Promise.resolve({ running: true, port });
    }
  }

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const startTime = performance.now();
      const reqId = Date.now();

      req.on('error', () => {
        if (!res.headersSent) res.writeHead(400);
        res.end();
      });

      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const bodyBuf = Buffer.concat(chunks);
        let bodyObj: Record<string, unknown> | null = null;
        try {
          bodyObj = JSON.parse(bodyBuf.toString());
        } catch {
          // JSON이 아닌 요청은 null로 처리
        }

        // 캡처된 요청을 renderer에 전송
        const reqData: CaptureRequest = {
          id: reqId,
          sessionId,
          ts: new Date().toISOString(),
          method: req.method || 'GET',
          path: req.url || '/',
          body: bodyObj as CaptureRequest['body'],
          startTime,
        };

        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send(IPC.PROXY_REQUEST, reqData);
        }

        // DB에 저장
        saveRequest(reqData).catch(() => {});

        // Anthropic API로 포워딩
        const headers = { ...req.headers, host: ANTHROPIC_HOST };
        delete headers['accept-encoding']; // gzip 방지 (파싱 위해)

        const options: https.RequestOptions = {
          hostname: ANTHROPIC_HOST,
          port: ANTHROPIC_PORT,
          path: req.url,
          method: req.method,
          headers,
        };

        const proxyReq = https.request(options, (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);

          const respChunks: Buffer[] = [];
          proxyRes.on('data', (chunk) => {
            respChunks.push(chunk);
            res.write(chunk);
          });

          proxyRes.on('error', () => {
            res.end();
          });

          proxyRes.on('end', () => {
            res.end();

            // 응답 파싱 및 레이턴시 계산 (비동기로 처리)
            setImmediate(() => {
              const latencyMs = Math.round(performance.now() - startTime);
              const respStr = Buffer.concat(respChunks).toString('utf8');

              let respObj: Record<string, unknown> | null = null;
              try {
                respObj = JSON.parse(respStr);
              } catch {
                // SSE 스트림 — JSON.parse 실패 예상됨
              }
              if (!respObj) {
                respObj = parseSseStream(respStr) as Record<string, unknown> | null;
              }

              const respData: CaptureResponse = {
                id: reqId,
                status: proxyRes.statusCode || 0,
                body: (respObj || respStr.slice(0, 4000)) as CaptureResponse['body'],
                latencyMs,
              };

              if (mainWin && !mainWin.isDestroyed()) {
                mainWin.webContents.send(IPC.PROXY_RESPONSE, respData);
              }

              // DB에 저장
              saveResponse(respData).catch(() => {});
            });
          });
        });

        proxyReq.on('error', (err) => {
          const latencyMs = Math.round(performance.now() - startTime);

          if (!res.headersSent) {
            res.writeHead(502, { 'content-type': 'application/json' });
          }
          res.end(JSON.stringify({ error: err.message }));

          if (mainWin && !mainWin.isDestroyed()) {
            mainWin.webContents.send(IPC.PROXY_RESPONSE, {
              id: reqId,
              status: 502,
              body: null,
              latencyMs,
              error: err.message,
            } as CaptureResponse);
          }
        });

        proxyReq.end(bodyBuf);
      });
    });

    server.on('listening', () => {
      proxyServer = server;
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ running: true, port: actualPort });
    });

    let retried = false;
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && !retried) {
        retried = true;
        server.listen(0, '127.0.0.1'); // 랜덤 포트로 재시도
      } else {
        resolve({ error: err.message });
      }
    });

    server.listen(port, '127.0.0.1');
  });
}

/** 프록시 서버 정지 */
export function stopProxy(): Promise<{ stopped: boolean }> {
  if (!proxyServer) return Promise.resolve({ stopped: true });

  const srv = proxyServer;
  proxyServer = null;

  return new Promise((resolve) => {
    srv.close(() => {
      resolve({ stopped: true });
    });
  });
}

/** 프록시 상태 조회 */
export function getProxyStatus(): { running: boolean; port?: number } {
  if (proxyServer) {
    try {
      const addr = proxyServer.address();
      const port = typeof addr === 'object' && addr ? addr.port : undefined;
      return { running: true, port };
    } catch {
      return { running: false };
    }
  }
  return { running: false };
}

/** 앱 종료 시 프록시 정리 */
export function cleanupProxy(): void {
  if (proxyServer) {
    proxyServer.close();
    proxyServer = null;
  }
}
