return {
  manifest = {
    id = "demo_sepolia",
    label = "Demo Sepolia Wallet",
    description = "Seeded Luna Wallet for Sepolia demos.",
    kind = "wallet",
    supportedChains = { 11155111 },
    defaultSession = {
      enabled = false,
      connected = false,
      chainId = "0xaa36a7",
      accounts = { "0x1111111111111111111111111111111111111111" },
      permissions = {},
      assets = {
        nativeBalance = "1",
        tokens = {},
      },
    },
    paramsSchema = {
      {
        key = "address",
        label = "Address",
        type = "address",
        required = true,
        default = "0x1111111111111111111111111111111111111111",
      },
      {
        key = "chainId",
        label = "Chain",
        type = "chainId",
        required = true,
        default = 11155111,
        options = { 11155111 },
      },
      {
        key = "nativeBalance",
        label = "Native Balance",
        type = "string",
        default = "1",
      },
    },
    recommendedControls = { "address", "nativeBalance" },
  },

  materialize = function(params)
    local address = params.address or "0x1111111111111111111111111111111111111111"
    local chainId = tonumber(params.chainId or 11155111)
    local nativeBalance = tostring(params.nativeBalance or "1")

    return {
      resolvedParams = {
        address = address,
        chainId = chainId,
        nativeBalance = nativeBalance,
      },
      defaultSession = {
        chainId = string.format("0x%x", chainId),
        accounts = { address },
        assets = {
          nativeBalance = nativeBalance,
          tokens = {},
        },
      },
    }
  end,
}
