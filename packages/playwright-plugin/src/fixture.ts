export type LunaFixture = {
  injectProvider: () => Promise<void>;
};

export function createLunaFixture(): LunaFixture {
  return {
    async injectProvider() {
      return;
    },
  };
}
