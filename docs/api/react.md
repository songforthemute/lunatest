# API: @lunatest/react

배포 채널: `latest`

주요 API:

- `createLunaProvider`
- `LunaTestProvider`
- `useLunaTest`
- `useLunaProvider`
- `withLunaWagmiConfig`
- `createEthersAdapter`
- `createWeb3JsAdapter`
- `enableLunaIntercept`
- `LunaDevtoolsPanel`
- `mountLunaDevtools`

React 앱에서는 `LunaTestProvider` + `useLunaTest` 조합을 기본 패턴으로 사용하고, 개발 서버에서는 `enableLunaIntercept` + `mountLunaDevtools`를 같이 두는 구성을 권장합니다.
