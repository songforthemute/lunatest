# Sepolia + Uniswap V3 Swap Demo

이 예제는 LunaTest의 `Real-first` 샘플입니다.

- 기본 경로: 실지갑(MetaMask) + Sepolia + 실 트랜잭션
- 카오스 경로: `lunatest.lua` 프리셋/편집으로 런타임 인터셉트 상태 패치
- CI 경로: 네트워크 비의존 테스트만 실행

## 1. 준비

```bash
cd /Users/joeylee/lunatest
pnpm install
cd examples/swap-dapp
cp .env.example .env.local
```

`.env.local` 값을 실제 RPC/토큰 조합에 맞게 수정합니다.

## 2. 실행

```bash
cd /Users/joeylee/lunatest
pnpm --filter @lunatest/example-swap-dapp dev
```

브라우저에서 앱을 열고 지갑 연결 후 아래를 확인합니다.

1. `Quote` 조회
2. `Approve` 전송/확인
3. `Swap` 전송/확인

지갑 확장/앱이 없다면 우하단 `LunaTest Devtools`에서 `Enable Luna Wallet`을 켠 뒤 같은 플로우를 바로 실험할 수 있습니다.

## 3. 카오스 프리셋

- `Slippage 80%`
- `Gas 500 Gwei`
- `Pending 10m`

프리셋 적용 또는 Lua 편집 후 `Apply`를 누르면 런타임 상태가 즉시 반영됩니다.
