# 라이브 데모

<script setup>
import { withBase } from 'vitepress'
</script>

라이브 데모는 `examples/swap-dapp`를 문서용 deterministic sub-app으로 포함합니다.

- Sepolia RPC 키가 필요 없습니다.
- 브라우저 지갑 확장이 필요 없습니다.
- LunaTest가 seed된 Luna Wallet session을 활성화합니다.
- quote, approve, swap, 런타임 state diff, chaos preset, Lua 편집은 그대로 상호작용할 수 있습니다.

프레임이 좁으면 새 탭에서 여세요:
<a :href="withBase('/examples/swap-dapp/')" target="_blank" rel="noreferrer">라이브 데모 열기</a>.

<div class="live-demo-frame-shell">
  <iframe
    :src="withBase('/examples/swap-dapp/')"
    title="LunaTest deterministic swap live demo"
    loading="lazy"
    class="live-demo-frame"
  ></iframe>
</div>

## 무엇이 Deterministic인가?

문서 빌드는 포함된 앱에 `VITE_LUNATEST_DEMO_MODE=deterministic`을 설정합니다.
이 모드는 Sepolia 형태의 fixture 주소를 제공하고, production 문서 빌드에서도 Luna runtime intercept를 활성화하며, 연결된 Luna Wallet session을 seed합니다.

앱 흐름은 실제 데모와 같습니다.

1. `Connect Wallet` 클릭
2. `Quote` 클릭
3. allowance가 필요하면 `Approve` 클릭
4. `Swap` 클릭
5. chaos preset 적용 또는 Lua 편집으로 runtime state patch

## 실제 Sepolia 흐름

실제 지갑, 실제 RPC endpoint, 실제 Uniswap V3 Sepolia 컨트랙트로 같은 앱을 실행하려면 [Sepolia 스왑 데모 가이드](./swap-demo-sepolia-uniswapv3.md)를 사용하세요.

<style>
.live-demo-frame-shell {
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  box-shadow: 0 18px 44px rgb(0 0 0 / 12%);
  background: var(--vp-c-bg-soft);
}

.live-demo-frame {
  display: block;
  width: 100%;
  min-height: 860px;
  border: 0;
}

@media (max-width: 768px) {
  .live-demo-frame {
    min-height: 980px;
  }
}
</style>
