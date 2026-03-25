return {
  protocol = "aave",
  market = {
    reserve = "USDC",
    liquidity = 1000000,
    borrow_apr = 0.041,
    supply_apr = 0.028,
    utilization = 0.68,
  },
  wallet = {
    supplied = {
      USDC = 1000,
    },
    borrowed = {
      ETH = 0.5,
    },
    health_factor = 1.92,
  },
}
