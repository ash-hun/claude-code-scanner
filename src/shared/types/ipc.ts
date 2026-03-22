import type { CaptureRequest, CaptureResponse } from './capture';
import type { ProxyStartResult, ProxyStatus } from './proxy';

/** IPC 채널 상수 — 단일 소스 */
export const IPC = {
  // Renderer → Main (invoke/handle)
  PROXY_START: 'proxy:start',
  PROXY_STOP: 'proxy:stop',
  PROXY_STATUS: 'proxy:status',

  // Main → Renderer (push)
  PROXY_REQUEST: 'proxy:request',
  PROXY_RESPONSE: 'proxy:response',
  PROXY_ERROR: 'proxy:error',
} as const;

/** Main → Renderer push 이벤트 페이로드 */
export interface MainToRendererEvents {
  [IPC.PROXY_REQUEST]: CaptureRequest;
  [IPC.PROXY_RESPONSE]: CaptureResponse;
  [IPC.PROXY_ERROR]: { id: number; error: string };
}

/** Renderer → Main invoke 핸들러 시그니처 */
export interface RendererToMainHandlers {
  [IPC.PROXY_START]: (config: { port: number }) => ProxyStartResult;
  [IPC.PROXY_STOP]: () => { stopped: boolean };
  [IPC.PROXY_STATUS]: () => ProxyStatus;
}
