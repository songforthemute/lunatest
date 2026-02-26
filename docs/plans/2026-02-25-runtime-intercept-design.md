# Runtime Intercept Mode Design (2026-02-25)

## 배경

현재 LunaTest의 네트워크/지갑 인터셉트는 Playwright 테스트 컨텍스트 중심으로 동작합니다.
개발자가 로컬 개발 서버에서 직접 앱을 조작하며 상호작용 테스트를 하려면, 브라우저 런타임에서 동일한 인터셉트 능력이 필요합니다.

이번 설계는 "앱 코드 1줄 추가" 수준으로 개발 환경 인터셉트를 활성화하는 모드를 정의합니다.

## 목표

- 프레임워크 비종속 런타임 인터셉트 엔진 제공
- `lunatest.lua` 기반 선언형 설정
- 개발 환경 기본 활성화 (`NODE_ENV === "development"`)
- `enable?: boolean`이 있으면 해당 값 우선
- 지갑 + HTTP/RPC + WebSocket 프레임 레벨 인터셉트

## 비목표

- 브라우저 확장 기반 자동 주입 (백로그)
- 프로덕션 환경 인터셉트 지원
- 완전 무설정 자동 로딩(번들러 플러그인) v1 지원

## 확정 결정 사항

1. 패키지 구조
- 신규 패키지: `@lunatest/runtime-intercept`
- 이유: React/Playwright와 분리된 순수 브라우저 런타임 계층 유지

2. 설정 방식
- 앱 루트 `lunatest.lua`
- 엔트리 파일(`main.tsx`)에서 명시 import + enable 호출

3. 활성화 우선순위
- `typeof config.enable === "boolean"`이면 해당 값 사용
- 아니면 `NODE_ENV === "development"`일 때만 활성화

4. 인터셉트 범위(v1)
- `window.ethereum`
- `fetch`
- `XMLHttpRequest`
- `WebSocket` (프레임 레벨)

5. 모드
- `strict`: 매핑 없는 요청/프레임 차단
- `permissive`: 매핑 없는 요청/프레임 원본 경로 통과

6. 로깅
- `debug?: boolean` (기본 `false`)

7. 브라우저 확장
- 이번 범위 제외, 백로그로만 기록

## 아키텍처

```text
app root
├─ lunatest.lua
├─ src/main.tsx
│  └─ enableLunaRuntimeIntercept(config)
└─ browser runtime
   ├─ ethereum interceptor
   ├─ fetch/xhr interceptor
   └─ websocket frame interceptor
```

### 패키지 공개 API

- `createLunaRuntimeIntercept(config)`
- `enableLunaRuntimeIntercept(config)`
- `disableLunaRuntimeIntercept()`

### 설정 타입(초안)

```ts
export type LunaRuntimeInterceptConfig = {
  enable?: boolean;
  debug?: boolean;
  intercept: {
    mode?: "strict" | "permissive";
    routing?: {
      rpcEndpoints?: Array<{
        urlPattern: string | RegExp;
        methods?: string[];
        responseKey: string;
      }>;
      httpEndpoints?: Array<{
        urlPattern: string | RegExp;
        method?: string;
        responseKey: string;
      }>;
      wsEndpoints?: Array<{
        urlPattern: string | RegExp;
        responseKey: string;
        match?: string | RegExp;
      }>;
      bypassWsPatterns?: Array<string | RegExp>;
    };
    mockResponses?: Record<string, unknown | ((ctx: unknown) => unknown)>;
  };
};
```

## 데이터 흐름

### 1) 부트스트랩

1. `main.tsx`에서 `lunatest.lua` 로딩
2. `enableLunaRuntimeIntercept(config)` 호출
3. 내부에서 활성화 여부 계산:
   - `config.enable` 명시 -> 우선
   - 미명시 -> `NODE_ENV === "development"`
4. 활성화되면 인터셉터 설치, 비활성이면 `no-op`

### 2) fetch/xhr/rpc

1. 요청 URL/메서드/payload 캡처
2. endpoint 룰 매칭
3. `responseKey`로 `mockResponses` 조회
4. 응답 반환
5. 미매칭 처리:
   - strict: 차단/에러
   - permissive: 원본 네트워크 호출

### 3) WebSocket 프레임

1. `new WebSocket(url)` 시 URL 기준 인터셉트 대상 판별
2. 대상이면 래퍼 소켓 생성
3. `send(frame)` 호출 시 payload 매칭
4. `responseKey` 응답을 `message` 이벤트로 디스패치
5. 미매칭 처리:
   - strict: 에러/close
   - permissive: 원본 소켓으로 전달

## WebSocket 세부 정책

### 기본 bypass

개발 서버 HMR 채널은 기본 bypass 처리:
- `vite-hmr`
- `webpack-hmr`
- `next-hmr`

기본 bypass로 dev server 자체와 충돌하지 않게 하고, 필요 시 설정으로 추가 패턴을 확장합니다.

### 프레임 매칭

- `wsEndpoints[].match`를 사용해 메시지 내용 기준 매칭 가능
- JSON 프레임 우선 파싱, 실패 시 문자열 원문으로 매칭

### 이벤트 지원

- `onmessage` 경로
- `addEventListener("message", ...)` 경로
- `open/error/close` 이벤트 전달

## 안전성/복원성

- 모든 원본 객체 보관 후 `disable`에서 복원
  - `window.ethereum`
  - `window.fetch`
  - `window.XMLHttpRequest`
  - `window.WebSocket`
- 중복 enable 호출은 idempotent 처리
- 설치 상태를 내부 singleton으로 관리

## 디버깅 정책

`debug: true`일 때만 로그 출력:
- 인터셉트 hit/miss
- strict 차단 이벤트
- bypass 규칙 적용 결과
- WS frame 매칭 결과

## 설정 예시

```ts
-- lunatest.lua
import type { LunaRuntimeInterceptConfig } from "@lunatest/runtime-intercept";

const config: LunaRuntimeInterceptConfig = {
  enable: undefined,
  debug: false,
  intercept: {
    mode: "strict",
    routing: {
      rpcEndpoints: [
        { urlPattern: "**/rpc", methods: ["eth_chainId"], responseKey: "rpc.chainId" },
      ],
      httpEndpoints: [
        { urlPattern: "**/api/quote", method: "GET", responseKey: "api.quote" },
      ],
      wsEndpoints: [
        { urlPattern: "wss://stream.local/socket", responseKey: "ws.quote" },
      ],
    },
    mockResponses: {
      "rpc.chainId": { result: "0x1" },
      "api.quote": { status: 200, body: { amountOut: "123.45" } },
      "ws.quote": { type: "QUOTE_UPDATED", payload: { amountOut: "123.40" } },
    },
  },
};

export default config;
```

```ts
// src/main.tsx
import { loadLunaConfig } from "@lunatest/core";
import { enableLunaRuntimeIntercept } from "@lunatest/runtime-intercept";

const config = await loadLunaConfig("./lunatest.lua");
enableLunaRuntimeIntercept(
  {
    intercept: {
      mode: config.mode,
      mockResponses: config.intercept?.mockResponses ?? {},
    },
  },
  process.env.NODE_ENV,
);
```

## 테스트 전략

1. 단위 테스트
- URL/payload/frame 매칭
- strict/permissive 분기
- enable 우선순위(`enable` vs `NODE_ENV`)

2. 통합 테스트
- enable -> 요청/프레임 -> disable 복원
- WS 메시지 디스패치(onmessage/addEventListener)

3. 스모크 예제
- 문서 예제 기반 0→1 워크스루 검증

## 리스크 및 대응

1. WebSocket/HMR 충돌
- 대응: 기본 bypass + 커스텀 bypass 패턴

2. 인터셉트 누락으로 인한 개발 혼란
- 대응: strict 모드 기본 + debug 로그 제공

3. 전역 오염
- 대응: disable 복원 + idempotent enable

## 백로그

- 브라우저 확장 기반 자동 주입 모드
- 번들러 플러그인 자동 로딩
- WS 고급 기능(재연결 시뮬레이션, 지연/드롭 시뮬레이션)
