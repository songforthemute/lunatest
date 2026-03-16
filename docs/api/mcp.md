# API: @lunatest/mcp

배포 채널: `latest`

주요 도구 그룹:

- `scenario.*`
- `coverage.*`
- `mock.*`
- `component.*`

기본 제공 리소스 6종, 프롬프트 4종을 함께 제공합니다.

Preset registry 연동 도구:

- `mock.listProtocolPresets`
- `mock.getProtocolPreset`
- `mock.applyProtocolPreset`
- `mock.listWalletPresets`
- `mock.getWalletPreset`
- `mock.applyWalletPreset`
- `mock.listPresetDiagnostics`
- `mock.getPresetDiagnostic`

`mock.listPresetDiagnostics`는 malformed local preset를 structured diagnostic 형태로 반환합니다.
유효하지 않은 preset은 list/apply catalog에는 포함되지 않고 diagnostics로만 노출됩니다.
