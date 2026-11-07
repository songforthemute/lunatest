# 결정론성

같은 입력 시나리오가 주어지면 LunaTest는 항상 같은 결과를 만들어야 합니다.

핵심 메커니즘은 다음과 같습니다.

- `math.random`의 고정 seed
- `os.time` / `os.date`를 위한 가상 시계
- `io.*` / `os.execute` 차단
- 실행 단위별 VM 격리
