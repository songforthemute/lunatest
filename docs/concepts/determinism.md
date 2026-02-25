# Determinism

동일한 입력 시나리오는 항상 동일한 결과를 반환해야 합니다.

핵심 메커니즘:

- `math.random` 고정 시드
- `os.time`/`os.date` 가상 시계
- `io.*`/`os.execute` 차단
- 실행 단위별 VM 격리
