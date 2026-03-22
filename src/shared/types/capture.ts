/** Anthropic API 메시지 구조 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | AnthropicContentBlock[];
  tool_use_id?: string;
  [key: string]: unknown;
}

export interface AnthropicSystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: string };
}

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
}

/** Anthropic API 요청 바디 */
export interface AnthropicRequestBody {
  model?: string;
  messages?: AnthropicMessage[];
  system?: AnthropicSystemBlock[] | string;
  max_tokens?: number;
  tools?: AnthropicTool[];
  stream?: boolean;
  [key: string]: unknown;
}

/** Anthropic API 응답 바디 */
export interface AnthropicResponseBody {
  id?: string;
  type?: string;
  role?: string;
  content?: AnthropicContentBlock[];
  model?: string;
  usage?: TokenUsage;
  stop_reason?: string;
  _streaming?: boolean;
  [key: string]: unknown;
}

/** 토큰 사용량 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

/** 캡처된 요청 */
export interface CaptureRequest {
  id: number;
  sessionId: string;
  ts: string;
  method: string;
  path: string;
  body: AnthropicRequestBody | null;
  startTime: number;
}

/** 캡처된 응답 */
export interface CaptureResponse {
  id: number;
  status: number;
  body: AnthropicResponseBody | string | null;
  latencyMs: number;
  error?: string;
}

/** 캡처 엔트리 (요청 + 응답 + 분석) */
export interface CaptureEntry {
  request: CaptureRequest;
  response: CaptureResponse | null;
}
