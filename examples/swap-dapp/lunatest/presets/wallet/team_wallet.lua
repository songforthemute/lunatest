return {
  manifest = {
    id = "team_wallet",
    label = "Team Wallet (Local)",
    description = "Project-local demo wallet for swap app customization.",
    kind = "wallet",
    supportedChains = { 11155111 },
    defaultSession = {
      enabled = false,
      connected = false,
      chainId = "0xaa36a7",
      accounts = { "0x1111111111111111111111111111111111111111" },
      permissions = {},
      assets = {
        nativeBalance = "2",
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
        key = "nativeBalance",
        label = "Native Balance",
        type = "string",
        default = "2",
      },
    },
    recommendedControls = { "address", "nativeBalance" },
  },

  materialize = function(params)
    local address = tostring(params.address or "0x1111111111111111111111111111111111111111")
    local nativeBalance = tostring(params.nativeBalance or "2")

    return {
      resolvedParams = {
        address = address,
        nativeBalance = nativeBalance,
      },
      defaultSession = {
        accounts = { address },
        assets = {
          nativeBalance = nativeBalance,
          tokens = {},
        },
      },
    }
  end,
}
