# 아키텍처

LunaTest는 네 개의 계층으로 구성됩니다.

1. Lua WASM Runtime(Wasmoon)
2. Mock Provider(체인, 지갑, 이벤트 상태)
3. Scenario Engine(Given-When-Then과 multi-stage 흐름)
4. Runner/Reporter(assertion과 출력)

핵심 설계 원칙은 같은 입력이 항상 같은 결과를 만들어야 한다는 것입니다.
