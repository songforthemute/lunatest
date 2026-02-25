import { defineConfig } from "vitepress";

const base = process.env.DOCS_BASE ?? "/";

export default defineConfig({
  title: "LunaTest",
  description: "Deterministic testing SDK for Web3 frontends",
  base,
  cleanUrls: true,
  srcDir: "docs",
  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "Concepts", link: "/concepts/architecture" },
      { text: "Guides", link: "/guides/writing-scenarios" },
      { text: "API", link: "/api/core" },
      { text: "Recipes", link: "/recipes/swap-testing" },
    ],
    sidebar: [
      {
        text: "Start",
        items: [
          { text: "Index", link: "/" },
          { text: "Getting Started", link: "/getting-started" },
          { text: "Wagmi Integration", link: "/wagmi-integration" },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "Architecture", link: "/concepts/architecture" },
          { text: "Determinism", link: "/concepts/determinism" },
          { text: "Mock Provider", link: "/concepts/mock-provider" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Writing Scenarios", link: "/guides/writing-scenarios" },
          { text: "Multi-stage", link: "/guides/multi-stage" },
          { text: "Wagmi Setup", link: "/guides/wagmi-setup" },
          { text: "Ethers Setup", link: "/guides/ethers-setup" },
          { text: "CI Integration", link: "/guides/ci-integration" },
        ],
      },
      {
        text: "API",
        items: [
          { text: "Core", link: "/api/core" },
          { text: "CLI", link: "/api/cli" },
          { text: "MCP", link: "/api/mcp" },
          { text: "React", link: "/api/react" },
        ],
      },
      {
        text: "Recipes",
        items: [
          { text: "Swap Testing", link: "/recipes/swap-testing" },
          { text: "Approval Flow", link: "/recipes/approval-flow" },
          { text: "Error Handling", link: "/recipes/error-handling" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/example/lunatest" }],
  },
});
