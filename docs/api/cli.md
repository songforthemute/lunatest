# API: @lunatest/cli

배포 채널: `latest`

CLI는 아래 여섯 가지 흐름을 중심으로 사용합니다.

- `lunatest run --scenario <file|glob>`
- `lunatest watch`
- `lunatest coverage`
- `lunatest gen --ai`
- `lunatest devtools --open`
- `lunatest doctor`

일반적으로 로컬에서는 `run/devtools/doctor`, CI에서는 `coverage`와 `run` 조합을 많이 사용합니다.
