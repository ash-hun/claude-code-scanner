/** 프록시 시작 결과 */
export interface ProxyStartResult {
  running?: boolean;
  port?: number;
  error?: string;
}

/** 프록시 상태 */
export interface ProxyStatus {
  running: boolean;
  port?: number;
}
