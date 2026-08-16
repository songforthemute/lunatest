# 검증된 wagmi 스왑 빠른 시작

이 빠른 시작은 LunaTest의 대표 React 여정을 재현합니다. 지갑 연결,
Uniswap V3 quote, 입력 토큰 approve, swap 제출을 실행하고 같은 Lua
시나리오를 Vitest와 Playwright에서 검증합니다.

## 증거 상태

현재 결과는 **packed-artifact proof**이며 registry 인증을 마친 E2 증거가
아닙니다. runner는 workspace 밖의 깨끗한 임시 consumer에 방금 pack한 공개
패키지를 설치합니다. 따라서 리포트의 `certificationEligible`은 `false`입니다.

packed lane을 npm `latest`로 바꿔 실행한 뒤 인증됐다고 표현하면 안 됩니다.
필요한 패키지가 배포되면 Task 9에서 같은 proof를 registry-only resolution으로
실행합니다.

또한 이것은 독립 사용자 검증이 아닙니다. 저장소 작성자가 reference consumer를
구현했습니다. 이후 E3 세션에서 대상 개발자가 작성자 도움 없이 이 문서를 따라갈
수 있는지 측정합니다.

## 지원 reference stack

fixture는 공식 Vite React TypeScript template의 revision
`14454fd8c9a399bc3fdc193e28465b6fcf001e4d`에서 출발했습니다. provenance와
Vite MIT license는 fixture에 보존되어 있습니다.

| 의존성 | 검증 버전 |
| --- | --- |
| Node.js | 24 |
| pnpm | 10.33.4 |
| React / React DOM | 19.2.8 |
| Vite | 8.2.0 |
| TypeScript | 6.0.2 |
| `@wagmi/core` | 3.6.4 |
| `viem` | 2.55.11 |
| Vitest | 4.1.6 |
| Playwright | 1.61.1 |

공개 peer 범위는 이 측정 조합보다 넓습니다. React/React DOM
`^18.3.1 || ^19.0.0`, `@wagmi/core >=3.6.4 <4`, `viem >=2.55.11 <3`입니다.
이 페이지의 전체 여정은 표의 exact version 조합으로만 검증했습니다.

pack lane은 정확한 LunaTest 패키지 이름, 버전, `packed-tarball` source를
리포트에 기록합니다. manifest 버전은 검사한 artifact를 식별하며, 동일한 npm
버전이 이 브랜치의 미배포 변경을 이미 포함한다는 의미가 아닙니다.

## pinned scaffold에서 shared scenario까지

replay는 새 임시 디렉터리에서 immutable npm package `create-vite@9.1.2`의
`react-ts` template을 실행하며 시작합니다. upstream React/Vite baseline을
확인한 뒤 checked-in reference overlay를 다음 순서로 적용합니다.

1. generated manifest와 TypeScript/Vite config를 exact pinned consumer
   manifest와 isolated workspace policy로 교체합니다.
2. starter UI를 `App.tsx`, `journey.ts`, `swap.ts`로 교체합니다.
3. `wagmi.ts`에 Luna composition boundary를 추가하고 `main.tsx`에서 기다립니다.
4. `lunatest.config.json`과 `scenarios/approve-and-swap.lua`를 추가합니다.
5. Vitest adapter, Playwright adapter, shared scenario helper, proof metrics
   helper를 추가합니다.
6. repository fixture가 아니라 이렇게 생성한 디렉터리를 대상으로 packed-artifact
   install과 모든 static/runtime gate를 실행합니다.

overlay는
[`consumer-proof/wagmi-swap`](https://github.com/songforthemute/lunatest/tree/main/consumer-proof/wagmi-swap)에
명시적으로 저장되어 있습니다. 기존 애플리케이션에 적용할 때는 아래 file-role
표를 사용하고 production journey를 reference journey로 교체하지 마세요.

## clean checkout에서 검증

Git, Node.js 24, Corepack 또는 pnpm 10.33.4가 필요합니다. Linux에서는
Playwright 명령이 Chromium system dependency도 설치합니다.

```bash
pnpm install --frozen-lockfile
pnpm --filter @lunatest/e2e-tests exec playwright install --with-deps chromium
pnpm quickstart:wagmi:validate -- --enforce-ci-budget
```

Linux CI job이 같은 install, browser, quickstart 명령을 강제합니다. validator와
proof runner가 다음 clean-room 작업을 수행합니다.

1. pinned official Vite scaffold를 생성하고 ordered overlay를 적용합니다.
2. 모든 공개 LunaTest 패키지를 build하고 pack합니다.
3. 생성된 앱을 repository workspace 밖의 proof 디렉터리로 다시 복사합니다.
4. LunaTest에는 staged tarball만 설치하고 lockfile, override, 버전, 설치
   real path를 감사합니다.
5. typecheck, lint, production Vite build를 실행합니다.
6. 제외되는 warm-up 1회와 측정 Vitest 여정 30회를 실행합니다.
7. 제외되는 warm-up 1회와 fresh browser context에서 측정 Chromium 여정
   30회를 실행합니다.
8. `artifacts/external-consumer-proof/pack.json`을 쓰고 gate 하나라도 red이면
   실패합니다.

성공 출력의 마지막 부분은 다음과 같습니다.

```text
[external-consumer-proof] report=.../artifacts/external-consumer-proof/pack.json
[external-consumer-proof] OK lane=pack packages=8
```

JSON 리포트에서 다음을 확인합니다.

- `passed`는 `true`, `certificationEligible`은 `false`입니다.
- 두 runner 모두 `iterations: 30`, `passed: 30`, `failed: 0`입니다.
- 두 runner가 동일한 fingerprint 하나를 가집니다.
- `network.attemptedCount`는 `0`입니다.
- `failureQuality`와 Playwright p95 10초 강제 budget을 포함한 모든 gate가
  green입니다.

## 애플리케이션에 추가되는 것

reference application은 LunaTest를 composition/test 경계에만 둡니다. 일반
journey 코드는 실제 `@wagmi/core`와 viem action을 사용합니다.

| 파일 | 역할 |
| --- | --- |
| `src/wagmi.ts` | deterministic runtime을 bootstrap하고 같은 synthetic EIP-1193 provider를 Luna wagmi connector와 transport에 전달합니다. |
| `src/main.tsx` | React render 전에 composition root를 기다립니다. |
| `src/swap.ts` | 일반 wagmi/viem read, write, receipt action을 호출하며 LunaTest를 import하지 않습니다. |
| `src/journey.ts` | production connect → quote → approve → swap state machine을 소유합니다. |
| `src/App.tsx` | 사용자 control과 관찰 가능한 상태를 render합니다. |
| `scenarios/approve-and-swap.lua` | 공유 UI, state, transition, absence, coverage 계약을 선언합니다. |
| `tests/journey.test.ts` | Vitest에서 공유 시나리오를 실제 application controller에 연결합니다. |
| `tests/journey.spec.ts` | Playwright에서 같은 scenario ID를 rendered DOM control에 연결합니다. |

정확한 reference file은
[`consumer-proof/wagmi-swap`](https://github.com/songforthemute/lunatest/tree/main/consumer-proof/wagmi-swap)에
있습니다. 기존 앱에 적용할 때 production journey는 유지하고 LunaTest import를
`src/wagmi.ts`, `src/main.tsx`, test adapter에 해당하는 경계로 제한하세요.

공유 시나리오는 다음 경로를 관찰합니다.

```text
disconnected → wallet_connected → quote_ready → approval_required
→ approval_pending → ready_to_swap → swap_pending → swap_confirmed
```

quote `1800`, allowance `1`, input balance `24`, output balance `1800`을
기대합니다. 앱이 quote, allowance, balance를 직접 patch하지 않습니다. built-in
Uniswap V3 preset이 synthetic provider를 통해 protocol request를 처리합니다.

## 측정 결과

2026-08-16에 수행한 Task 8 clean-copy validation run 결과입니다.

| Runner | 측정 성공 | Median | p95 |
| --- | ---: | ---: | ---: |
| Vitest | 30/30 | 3.338 ms | 5.654 ms |
| Playwright | 30/30 | 110.947 ms | 120.793 ms |

두 runner의 fingerprint는
`sha256:143b046c151669494867a2ad534f96abc69e4310be10fca884c291db76bd6a93`로
같았고, 제외된 warm-up까지 포함해 outbound HTTP/WebSocket 시도는 0건이었습니다.

setup 시간은 별도로 보고합니다. package build/pack, clean install, static check,
runner command 시간은 scenario runtime에 포함되지 않습니다. 이번 실행에서는 browser
download와 scaffold acquisition 시간을 측정하지 않았습니다.

pinned scaffold baseline부터 shared journey까지 application file 5개가 변경되었고
non-test application LOC는 net 384입니다. LunaTest integration boundary는 파일
2개, net non-test LOC 65입니다. 이는 reference fixture 측정값이며 모든 앱에 대한
약속이 아닙니다.

“10분 설정” 주장은 하지 않습니다. first pass 시간은 dependency download 제외
규칙을 포함한 E3 사용자 연구를 실제로 수행한 뒤 판단합니다.

## 의도적 실패

proof는 관찰된 output balance를 `1800`에서 `1799`로 바꾸고 진단이 네 필드를
모두 식별하도록 강제합니다.

```text
scenarioId: scenarios/approve-and-swap
path: then_ui.output_balance
expected: 1800
actual: 1799
```

runner가 실행 가능한 field 경로 대신 전체 객체 diff만 반환할 때 green report가
나오는 것을 방지합니다.

## 문제 해결

### Chromium이 없음

Playwright install 명령을 다시 실행하세요. Linux CI에서는 `--with-deps`를
유지합니다. system package가 이미 있는 환경에서는 `playwright install chromium`만
실행해도 됩니다.

### Package isolation 실패

consumer의 workspace link, local `file:` dependency, LunaTest override를
제거하세요. pack lane은 해당 실행에서 생성한 staged tarball만 허용합니다.
registry fallback도 이 lane에서는 실패입니다.

### Outbound access가 보고됨

브라우저는 정확한 local Vite preview origin만 허용합니다. RPC, protocol HTTP,
wallet extension, WebSocket 접근은 차단하고 집계합니다. Node에서는 local Wasm
file loading을 허용하지만 HTTP(S)와 WebSocket 시도는 허용하지 않습니다.

### Footprint가 stale임

application source file이 바뀌면 digest를 직접 수정하지 말고 footprint를 다시
생성하고 검토하세요. runner는 선언된 source file을 hash하고 stale metadata를
거부합니다.

### Runtime p95 실패

10초 gate는 browser 측정 30회의 반올림 전 nearest-rank p95를 사용합니다.
install, browser 시작, page boot, 제외된 warm-up은 이 값에 포함되지 않습니다.
budget을 바꾸기 전에 report의 runner sample을 확인하세요.

### Scenario assertion 실패

scenario ID와 구조화된 mismatch path부터 확인하세요. 두 runner의 source digest가
다르면 각 adapter가 scenario를 복사해 embed하지 않고 project-relative ID로
`scenarios/approve-and-swap.lua`를 읽는지 확인하세요.
