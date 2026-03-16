return {
  manifest = {
    id = "empty_wallet",
    label = "Empty Wallet",
    description = "Disconnected or zero-state wallet baseline.",
    kind = "wallet",
    supportedChains = { 1, 11155111 },
    defaultSession = {
      enabled = false,
      connected = false,
      chainId = "0x1",
      accounts = { "0x1111111111111111111111111111111111111111" },
      permissions = {},
      assets = {
        nativeBalance = "0",
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
        default = 1,
        options = { 1, 11155111 },
      },
    },
    recommendedControls = { "address", "chainId" },
  },

  materialize = function(params)
    local address = params.address or "0x1111111111111111111111111111111111111111"
    local chainId = tonumber(params.chainId or 1)

    return {
      resolvedParams = {
        address = address,
        chainId = chainId,
      },
      defaultSession = {
        chainId = string.format("0x%x", chainId),
        accounts = { address },
      },
    }
  end,
}
