# API: @lunatest/react

Release channel: `latest`

## Public API

- `createLunaProvider`
- `LunaTestProvider`
- `useLunaProvider`
- `useLunaTest`
- `withLunaWagmiConfig`
- `createEthersAdapter`
- `createWeb3JsAdapter`
- `enableLunaIntercept`
- `bootstrapLunaRuntime`
- `LunaDevtoolsPanel`
- `mountLunaDevtools`

`@lunatest/react/browser` is the recommended entrypoint for browser-only bootstrap and devtools usage.

## `bootstrapLunaRuntime(options?)`

```ts
type LunaBootstrapOptions = {
  enable?: boolean;
  source?: string | URL;
  nodeEnv?: string;
  mountDevtools?: boolean;
  devtoolsTargetId?: string;
  presetRegistry?: PresetRegistry;
  projectPresetSources?: ProjectPresetSources;
  protocolPresetId?: string;
  protocolPresetParams?: Record<string, unknown>;
  walletPresetId?: string;
  walletPresetParams?: Record<string, unknown>;
  walletFallbackMode?: "off" | "manual-toggle";
  walletPreset?: {
    address: string;
    chainId?: string;
    permissions?: Array<LunaWalletPermission | string>;
    assets?: Partial<LunaWalletAssetState>;
  };
  configOverride?: Partial<LunaRuntimeInterceptConfig>;
};

type LunaBootstrapResult = {
  enabled: boolean;
  configLoaded: boolean;
  unmountDevtools?: () => void;
  config?: LuaConfig;
};
```

`bootstrapLunaRuntime()` accepts the full runtime/bootstrap surface currently shipped by the package:

- `source`: Lua config path or URL, defaults to `./lunatest.lua`
- `enable`: explicit on/off override
- `nodeEnv`: environment override for the bootstrap gate
- `mountDevtools` and `devtoolsTargetId`: browser devtools mounting control
- `presetRegistry`: reuse an existing registry instance
- `projectPresetSources`: inject local preset sources without a prebuilt registry
- `protocolPresetId` / `protocolPresetParams`: select and materialize a protocol preset
- `walletPresetId` / `walletPresetParams`: select and materialize a wallet preset
- `walletFallbackMode`: Luna Wallet fallback UI mode
- `walletPreset`: direct wallet session seed
- `configOverride`: partial runtime-intercept config override

Activation precedence is:

1. `enable` if explicitly provided
2. `configOverride.enable`
3. `development` only

If activation is blocked before config loading, the function returns `{ enabled: false, configLoaded: false }` and does not read the Lua source.

The result includes `enabled`, `configLoaded`, optional `config`, and optional `unmountDevtools`.

## Related entrypoints

- `LunaTestProvider` / `useLunaProvider` for React state and provider reuse
- `enableLunaIntercept` when you want to manage intercept activation manually
- `mountLunaDevtools` when you want to mount the devtools panel without `bootstrapLunaRuntime()`

## Minimal example

```tsx
import { LunaTestProvider, useLunaTest } from "@lunatest/react";

function Demo() {
  const { provider } = useLunaTest();
  return <button onClick={() => provider.request({ method: "eth_chainId" })}>check chain</button>;
}

export function App() {
  return (
    <LunaTestProvider options={{ chainId: "0x1" }}>
      <Demo />
    </LunaTestProvider>
  );
}
```
