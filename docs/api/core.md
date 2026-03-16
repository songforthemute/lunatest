# API: @lunatest/core

배포 채널: `latest`

현재 공개 API는 다음 항목입니다.

- `LunaProvider`
- `LunaProviderOptions`
- `loadLunaConfig(source)`
- `listProtocolPresets()`
- `getProtocolPreset(id)`
- `materializeProtocolPreset(id, params)`
- `validateProtocolPresetSource(source, context?)`
- `listWalletPresets()`
- `getWalletPreset(id)`
- `materializeWalletPreset(id, params?)`
- `validateWalletPresetSource(source, context?)`
- `getPresetDiagnostics(registry?)`
- `createScenarioRuntime(config)`
- `LuaConfig`
- `RouteMock`

`LunaProvider`는 EIP-1193의 `request/on/removeListener` 패턴을 기준으로 동작합니다.

브라우저 런타임 인터셉트는 [API: @lunatest/runtime-intercept](./runtime-intercept.md) 문서를 참고하세요.

Preset registry는 built-in Lua manifest를 catalog/API로 승격한 계층입니다.  
`materializeProtocolPreset()`은 `walletSession`, `interceptState`, `routeMocks`, `builtinScenarios`를 함께 반환합니다.

Local preset diagnostics도 같은 계층에서 확인할 수 있습니다.

- `validateProtocolPresetSource()` / `validateWalletPresetSource()`는 단일 source를 검증합니다.
- `getPresetDiagnostics()`는 registry에 로드된 built-in / project-local preset의 structured diagnostics를 반환합니다.
