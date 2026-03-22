<div align="center">

<img src="assets/logo.svg" width="80" height="80" alt="Claude Code Scanner Logo">

# Claude Code Scanner

**Claude Code의 실제 API 트래픽을 실시간으로 가로채어 분석하는 모니터링 도구**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

---

Claude Code CLI가 Anthropic API에 **실제로 무엇을 보내는지** 투명하게 보여줍니다.

| 발견 | 설명 |
|---|---|
| 📋 **CLAUDE.md 주입** | 매 요청마다 ~12KB의 CLAUDE.md가 `<system-reminder>`로 주입됨 |
| 📈 **토큰 누적** | 대화가 길어질수록 messages[] 크기가 급격히 증가 (30턴 → 1MB+) |
| 🔧 **Skill/Sub-Agent 흐름** | 하나의 명령이 내부적으로 몇 개의 API 호출을 만드는지 |
| 🔌 **MCP 도구 lazy-loading** | tools[] 배열이 세션 중 동적으로 성장하는 과정 |
| ♻️ **캐시 적중률** | 프롬프트 캐싱이 실제로 얼마나 비용을 절감하는지 |
| 💰 **요청별 비용** | 모델·토큰·캐시 기반 실시간 비용 계산 |

### 설치

#### Homebrew (macOS)

```bash
brew tap ash-hun/claude-code-scanner
brew install --cask claude-code-scanner
```

#### 직접 빌드

```bash
git clone https://github.com/ash-hun/claude-code-scanner.git
cd claude-code-scanner
npm install
npm run build
npm run dist    # → release/ 에 DMG 생성
```

### 필수 요구사항

| 요구사항 | 용도 | 없으면? |
|---------|------|--------|
| **Docker Desktop** | PostgreSQL 자동 생성 (port 9020) | DB 없이 인메모리 모드로 동작 |
| **Node.js 20+** | 직접 빌드 시 필요 | Homebrew 설치 시 불필요 |

### 사용법

```
1. 앱 실행 → Landing Page
2. Start Proxy 클릭 (기본 포트: 9002)
3. 새 터미널에서:

   ANTHROPIC_BASE_URL=http://localhost:9002 claude

4. Claude Code에서 작업 → 앱에서 실시간 캡처
```

### 주요 기능

<table>
<tr>
<td width="50%">

#### 📋 Messages
- **전체 대화** / Claude에게 요청한 지시 / Claude의 응답 필터링
- `<system-reminder>`, Skills, CLAUDE.md 주입을 배지로 구분
- 실시간 검색

</td>
<td width="50%">

#### 📦 Request / Response
- JSON 트리 뷰어 (접기/펼치기, 라인 번호, 토큰 비중)
- 토큰 정보 바: KB, 입출력 토큰, 캐시율, 비용, 레이턴시

</td>
</tr>
<tr>
<td>

#### 🔬 Analysis
- **Request Anatomy** — 구성요소별 바이트/토큰 비중 바 차트
- **Operation Flow** — tool_use 호출 순서 타임라인
- **Mechanism Detection** — 7가지 메커니즘 감지

</td>
<td>

#### 📊 Stats
- 세션 요약 (요청 수, 토큰, 비용, 레이턴시, 캐시율)
- 레이턴시 분포 · 모델 비율 · 메커니즘 빈도
- 컨텍스트 크기 추이 (500KB 초과 시 경고)
- Export JSON · 히스토리 세션 목록

</td>
</tr>
</table>

### 감지하는 7가지 메커니즘

| # | 메커니즘 | 감지 패턴 |
|---|---------|----------|
| 1 | 📋 CLAUDE.md | `<system-reminder>` 내 `Contents of` 패턴 |
| 2 | 🎨 Output Style | `system[]` 배열 2개 이상 |
| 3 | ⌨ Slash Command | `<command-message>` 태그 |
| 4 | 🔧 Skill | `tool_use` name=`Skill` |
| 5 | 🤖 Sub-Agent | `tool_use` name=`Agent`/`Task` |
| 6 | 🔌 MCP Tool | `tool_use` name=`mcp__*` |
| 7 | 📁 FS Operations | `tool_use` name=`Read`/`Write`/`Edit`/`Bash`/`Glob`/`Grep` |

### 아키텍처

```
Claude Code CLI ──→ localhost:9002 (HTTP Proxy) ──→ api.anthropic.com
                          │
                    ┌─────┴─────┐
                    │ 레이턴시 측정 │ ← performance.now()
                    │ 토큰 추적    │ ← usage 파싱
                    │ 메커니즘 감지 │ ← 패턴 분석
                    └─────┬─────┘
                          │ IPC
                    ┌─────┴─────┐
                    │ PostgreSQL │ ← Docker 자동 (port 9020)
                    │ Renderer   │ ← Vite + Vanilla TS
                    └────────────┘
```

### 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|----------|
| Desktop | Electron 33 | macOS 네이티브 titlebar, DMG 배포 |
| Language | TypeScript (strict) | 타입 안전성, shared 모듈 공유 |
| Bundler | Vite 6 | 빌드 없이 HMR, 빠른 번들링 |
| UI | Vanilla TS | 프레임워크 오버헤드 제거, 직접 DOM 제어 |
| Database | PostgreSQL 16 | Docker 자동 생성, 세션 영속 저장 |
| Proxy | Node.js http/https | 외부 의존성 없이 MITM 구현 |
| Test | Vitest (41 tests) | 빠른 실행, shared 모듈 직접 import |
| CI/CD | GitHub Actions | 태그 push → DMG 자동 빌드/릴리즈 |

### 프로젝트 구조

```
src/
├── shared/           # Main·Renderer·Test 공유 순수 TypeScript
│   ├── types/        # capture, analysis, pricing, ipc 타입
│   ├── mechanism-detector.ts   # 7가지 메커니즘 감지
│   ├── sse-parser.ts           # SSE 스트림 재조합
│   ├── pricing.ts              # 모델별 비용 계산
│   └── ...
├── main/             # Electron Main Process
│   ├── proxy-server.ts   # MITM 프록시 + 레이턴시 측정
│   ├── docker-pg.ts      # Docker PostgreSQL 자동 생성
│   ├── capture-store.ts  # DB CRUD
│   └── ...
└── renderer/         # Vite 번들 Renderer
    ├── components/   # analysis-view, stats-view, messages-view 등
    ├── store/        # 이벤트 기반 상태 관리
    ├── i18n/         # 한국어/영어
    └── styles/       # CSS 모듈
```

### 개발

```bash
npm run dev           # Vite HMR + TypeScript watch
npm run dev:electron  # Electron 실행 (별도 터미널)
npm run test:unit     # 41 단위 테스트
npm run build         # 프로덕션 빌드
npm run dist          # DMG 생성
```

### 라이선스

[MIT](LICENSE)

---

## English

### What You Can Discover

Transparently shows what Claude Code CLI **actually sends** to the Anthropic API.

| Discovery | Description |
|---|---|
| 📋 **CLAUDE.md injection** | ~12KB injected via `<system-reminder>` on every request |
| 📈 **Token accumulation** | messages[] grows rapidly (30 turns → 1MB+) |
| 🔧 **Skill/Sub-Agent flow** | How many API calls a single command generates |
| 🔌 **MCP lazy-loading** | tools[] grows dynamically during session |
| ♻️ **Cache hit rate** | How much prompt caching saves |
| 💰 **Per-request cost** | Real-time cost based on model, tokens, cache |

### Installation

#### Homebrew (macOS)

```bash
brew tap ash-hun/claude-code-scanner
brew install --cask claude-code-scanner
```

#### Build from source

```bash
git clone https://github.com/ash-hun/claude-code-scanner.git
cd claude-code-scanner
npm install && npm run build && npm run dist
```

### Prerequisites

| Requirement | Purpose | Without it? |
|------------|---------|-------------|
| **Docker Desktop** | Auto-creates PostgreSQL (port 9020) | Runs in memory-only mode |
| **Node.js 20+** | Building from source | Not needed for Homebrew install |

### Usage

1. Launch app → Landing Page appears
2. Click **Start Proxy** (default port: 9002)
3. In a new terminal:

```bash
ANTHROPIC_BASE_URL=http://localhost:9002 claude
```

4. Use Claude Code normally — traffic is captured in real-time

### Key Features

- **Messages** — Full conversation / Instructions to Claude / Claude responses with badge separation
- **Request/Response** — JSON tree viewer with token weight, cost, latency
- **Analysis** — Request Anatomy + Operation Flow timeline + 7 Mechanism Detection
- **Stats** — Session summary, latency distribution, model usage, context growth, export JSON

### License

[MIT](LICENSE)
