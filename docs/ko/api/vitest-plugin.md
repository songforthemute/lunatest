# API: @lunatest/vitest-plugin

배포 채널: `next`

이 패키지는 prerelease 채널이므로 설치 시 태그를 명시합니다.

```bash
pnpm add -D @lunatest/vitest-plugin@next
```

## `createLunaVitestPlugin(options?)`

```ts
type LunaVitestPluginOptions = {
  scenarioDir?: string;
};

type LunaVitestPlugin = {
  name: "lunatest-vitest-plugin";
  scenarioDir: string;
};
```

`createLunaVitestPlugin()`은 LunaTest-aware Vitest 설정용 metadata를 반환합니다. `scenarioDir` 기본값은 `"scenarios"`입니다.

```ts
import { createLunaVitestPlugin } from "@lunatest/vitest-plugin";

const luna = createLunaVitestPlugin({ scenarioDir: "scenarios" });
```

현재 release는 Vitest hook을 등록하거나 Lua scenario를 실행하지 않습니다. 반환 metadata를 어떻게 사용할지는 호스트가 결정해야 합니다.

## `toLunaPass(received)`

```ts
type LunaMatcherResult = {
  pass: boolean;
  message: () => string;
};

toLunaPass({ pass: boolean }): LunaMatcherResult;
```

이 helper는 Luna-style result를 Vitest custom matcher 호환 결과로 변환합니다. assertion 문법을 사용하려면 테스트 프레임워크에 직접 등록해야 하며, 패키지가 전역 matcher를 등록하지는 않습니다.
