# Sepolia + Uniswap V3 스왑 데모

`examples/swap-dapp`는 LunaTest의 `Real-first` 샘플입니다.

- 기본 경로는 실지갑 + Sepolia 실 트랜잭션입니다.
- 카오스 검증은 프리셋 버튼, Lua 편집으로 런타임 상태를 즉시 바꿔가며 진행합니다.
- CI는 네트워크에 의존하지 않는 테스트만 자동 실행합니다.

## 이 샘플에서 확인할 수 있는 것

1. 토큰 선택, 수량 입력, quote 조회
2. 슬리피지/가스/네트워크/잔액 경고
3. `approve -> swap -> pending -> confirmed/failed` 단계 전이
4. 카오스 프리셋 3종
- `high_slippage_80`
- `gas_spike_500_gwei`
- `pending_10m`

## 사전 준비

- 선택 사항: MetaMask 같은 EIP-1193 지갑
- Sepolia 가스비(ETH)
- Sepolia에서 실제로 존재하는 토큰/풀 주소
- Node 20 이상

## 1) 환경 변수 설정

```bash
cd /Users/joeylee/lunatest
pnpm install
cd examples/swap-dapp
cp .env.example .env.local
```

필수 값:

- `VITE_SEPOLIA_RPC_URL`
- `VITE_UNISWAP_V3_FACTORY`
- `VITE_UNISWAP_V3_ROUTER`
- `VITE_UNISWAP_V3_QUOTER_V2`
- `VITE_TOKEN_IN`
- `VITE_TOKEN_OUT`
- `VITE_POOL_FEE`

누락되거나 형식이 맞지 않으면 앱이 즉시 구성 오류 화면을 보여줍니다.

## 2) 데모 실행

```bash
cd /Users/joeylee/lunatest
pnpm --filter @lunatest/example-swap-dapp dev
```

브라우저에서 다음 순서로 확인합니다.

1. 실지갑이 있다면 `Connect Wallet`
2. 지갑이 없다면 우하단 `LunaTest Devtools`에서 `Enable Luna Wallet`
3. 네트워크가 Sepolia(`11155111`)인지 확인
4. 수량 입력 후 `Quote`
5. 필요한 경우 `Approve`
6. `Swap` 실행 후 `Tx Stepper` 상태 전이 확인

## 3) 카오스 QA 루프

인브라우저 패널에서:

1. 프리셋 선택 (`Slippage 80%`, `Gas 500 Gwei`, `Pending 10m`)
2. `Apply Preset`
3. 경고/버튼/스텝퍼 변화 확인
4. `Luna Wallet`을 켜거나 꺼서 지갑 RPC 하이재킹 동작 확인
5. Lua 텍스트 수정 후 `Apply Lua`
6. `State Diff`로 실제 패치 결과 확인

## 4) 로컬 검증 명령

```bash
pnpm lint
pnpm test
pnpm build
```

자동 테스트는 결정론적으로 동작하며 네트워크 없이도 통과합니다.  
실제 Sepolia 트랜잭션 검증은 수동 스모크 체크로 분리합니다.
