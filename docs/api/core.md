# API: @lunatest/core

배포 채널: `latest`

현재 공개 API는 다음 항목입니다.

- `LunaProvider`
- `LunaProviderOptions`
- `loadLunaConfig(source)`
- `@lunatest/core/browser`
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

브라우저 앱에서 Lua config/preset registry를 직접 소비할 때는 `@lunatest/core/browser` subpath를 권장합니다.  
Node 전용 helper인 `loadProjectPresetSources()`는 root `@lunatest/core`에만 남고 browser subpath에서는 노출되지 않습니다.

Local preset diagnostics도 같은 계층에서 확인할 수 있습니다.

- `validateProtocolPresetSource()` / `validateWalletPresetSource()`는 단일 source를 검증합니다.
- `getPresetDiagnostics()`는 registry에 로드된 built-in / project-local preset의 structured diagnostics를 반환합니다.
