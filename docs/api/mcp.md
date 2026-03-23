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

Coverage / component surface는 실제 scenario metadata와 coverage catalog를 기준으로 동작합니다.

- `coverage.report`
  - `total`
  - `covered`
  - `ratio`
  - `known`
  - `coveredTargets`
  - `missing`
- `coverage.gaps`
  - `feature/state/component` 단위 missing target 목록
- `coverage.suggest`
  - missing target 기준 scenario suggestion 목록
- `component.states(name)`
  - `{ known, covered, missing }`

`resource.get("lunatest://protocols")`는 protocol id 배열이 아니라 preset metadata object 배열을 반환합니다.
