# Multi-stage Flow

Approve -> Swap처럼 단계가 이어지는 시나리오는 `stages`로 표현합니다.

권장 패턴:

1. 단계 이름은 UI 상태를 바로 떠올릴 수 있게 짓기
2. 단계별 assertion은 꼭 필요한 값만 선언하기
3. 타이밍 검증은 `timing_ms`로 분리해 의도를 명확히 하기
