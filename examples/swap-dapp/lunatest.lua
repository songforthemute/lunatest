scenario {
  name = "swap_demo_runtime",
  mode = "permissive",

  given = {
    chain = {
      id = 11155111,
      gasPriceGwei = 30,
    },
    chaos = {
      preset = "none",
      slippagePctOverride = 0,
      gasPriceOverrideGwei = 30,
      pendingForMs = 0,
    },
  },

  intercept = {
    routes = {},
    state = {},
    mockResponses = {},
  },

  presets = {
    high_slippage_80 = {
      label = "Slippage 80%",
      description = "극단적 슬리피지 경고/버튼 비활성 정책을 검증합니다.",
      lua = [[
scenario {
  name = "high_slippage_80",
  mode = "permissive",
  given = {
    chaos = {
      preset = "high_slippage_80",
      slippagePctOverride = 80,
    },
  },
}
      ]],
      routeMocks = {},
      statePatch = {
        chaos = {
          preset = "high_slippage_80",
          slippagePctOverride = 80,
        },
      },
    },

    gas_spike_500_gwei = {
      label = "Gas 500 Gwei",
      description = "가스 급등 상태를 재현해 경고/가드 동작을 확인합니다.",
      lua = [[
scenario {
  name = "gas_spike_500_gwei",
  mode = "permissive",
  given = {
    chain = { gasPriceGwei = 500 },
    chaos = {
      preset = "gas_spike_500_gwei",
      gasPriceOverrideGwei = 500,
    },
  },
}
      ]],
      routeMocks = {},
      statePatch = {
        chain = { gasPriceGwei = 500 },
        chaos = {
          preset = "gas_spike_500_gwei",
          gasPriceOverrideGwei = 500,
        },
      },
    },

    pending_10m = {
      label = "Pending 10m",
      description = "트랜잭션 receipt가 10분간 오지 않는 혼잡 상태를 재현합니다.",
      lua = [[
scenario {
  name = "pending_10m",
  mode = "permissive",
  given = {
    chaos = {
      preset = "pending_10m",
      pendingForMs = 600000,
    },
  },
  intercept = {
    routes = {
      { endpointType = "ethereum", method = "eth_sendTransaction", responseKey = "chaos.pending.tx_hash" },
      { endpointType = "ethereum", method = "eth_getTransactionReceipt", responseKey = "chaos.pending.tx_receipt" },
    },
    state = {
      mockResponses = {
        ["chaos.pending.tx_hash"] = { result = "0x7f9a3f8fcb8c2e97a5e5e9845f3c4d4f17a4bc6fcdcae3b5bdf6fd2a0d6f4d91" },
        ["chaos.pending.tx_receipt"] = { result = nil },
      },
    },
  },
}
      ]],
      routeMocks = {
        { endpointType = "ethereum", method = "eth_sendTransaction", responseKey = "chaos.pending.tx_hash" },
        { endpointType = "ethereum", method = "eth_getTransactionReceipt", responseKey = "chaos.pending.tx_receipt" },
      },
      statePatch = {
        chaos = {
          preset = "pending_10m",
          pendingForMs = 600000,
        },
        mockResponses = {
          ["chaos.pending.tx_hash"] = { result = "0x7f9a3f8fcb8c2e97a5e5e9845f3c4d4f17a4bc6fcdcae3b5bdf6fd2a0d6f4d91" },
          ["chaos.pending.tx_receipt"] = { result = nil },
        },
      },
    },
  },
}
