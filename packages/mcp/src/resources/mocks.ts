export function mocksResource() {
  return {
    uri: "lunatest://mocks",
    content: {
      schema: {
        chain: ["id", "blockNumber"],
        wallet: ["address", "balances", "allowances"],
        events: ["atMs", "type", "payload"],
      },
    },
  };
}
