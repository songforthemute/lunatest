# API: @lunatest/core

배포 채널: `latest`

현재 공개 API는 다음 항목입니다.

- `LunaProvider`
- `LunaProviderOptions`
- `loadLunaConfig(source)`
- `createScenarioRuntime(config)`
- `LuaConfig`
- `RouteMock`

`LunaProvider`는 EIP-1193의 `request/on/removeListener` 패턴을 기준으로 동작합니다.

브라우저 런타임 인터셉트는 [API: @lunatest/runtime-intercept](./runtime-intercept.md) 문서를 참고하세요.
