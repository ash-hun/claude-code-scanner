import type { CaptureRequest, CaptureResponse } from '../shared/types/capture';
import type { ProxyStartResult, ProxyStatus } from '../shared/types/proxy';

export interface ElectronAPI {
  platform: string;

  // 프록시 제어
  proxyStart: (port: number) => Promise<ProxyStartResult>;
  proxyStop: () => Promise<{ stopped: boolean }>;
  proxyStatus: () => Promise<ProxyStatus>;

  // Push 이벤트 수신
  onProxyRequest: (cb: (data: CaptureRequest) => void) => void;
  onProxyResponse: (cb: (data: CaptureResponse) => void) => void;
  offProxy: () => void;

  // DB 영속 저장
  getSessions: () => Promise<Array<Record<string, unknown>>>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearAllCaptures: () => Promise<void>;

  // 내보내기
  exportJson: (opts: { sessionId?: string }) => Promise<{ path?: string; canceled?: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
