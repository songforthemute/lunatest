# Determinism

같은 입력 시나리오를 넣었을 때는 항상 같은 결과가 나와야 합니다.

핵심 메커니즘:

- `math.random` 고정 시드
- `os.time`/`os.date` 가상 시계
- `io.*`/`os.execute` 차단
- 실행 단위별 VM 격리
