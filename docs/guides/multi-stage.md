# Multi-stage Flow

Approve -> Swap 흐름처럼 여러 단계가 있는 시나리오는 `stages`로 표현합니다.

권장 패턴:

1. 단계 이름은 UI 상태를 반영
2. 단계별 assert는 최소 필수 상태만 선언
3. 타이밍 검증은 `timing_ms`로 분리
