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
      { text: "한국어", link: "/ko/" },
      { text: "Library Guide", link: "/guides/library-consumption" },
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
          { text: "한국어 문서", link: "/ko/" },
          { text: "Library Consumption", link: "/guides/library-consumption" },
          { text: "Wagmi Integration", link: "/wagmi-integration" },
        ],
      },
      {
        text: "한국어",
        items: [
          { text: "문서 인덱스", link: "/ko/" },
          { text: "빠른 시작", link: "/ko/getting-started" },
          { text: "라이브러리 소비자 가이드", link: "/ko/guides/library-consumption" },
          { text: "시나리오 예제", link: "/ko/guides/scenario-examples" },
          { text: "React 통합", link: "/ko/guides/react-integration" },
          { text: "MCP stdio", link: "/ko/guides/mcp-stdio" },
          { text: "Playwright 라우팅", link: "/ko/guides/playwright-routing" },
          { text: "CLI 워크플로", link: "/ko/guides/cli-workflow" },
          { text: "API: Core", link: "/ko/api/core" },
          { text: "API: React", link: "/ko/api/react" },
          { text: "API: MCP", link: "/ko/api/mcp" },
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
          { text: "Library Consumption", link: "/guides/library-consumption" },
          { text: "Writing Scenarios", link: "/guides/writing-scenarios" },
          { text: "Multi-stage", link: "/guides/multi-stage" },
          { text: "Wagmi Setup", link: "/guides/wagmi-setup" },
          { text: "Ethers Setup", link: "/guides/ethers-setup" },
          { text: "Web3.js Setup", link: "/guides/web3js-setup" },
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
    socialLinks: [{ icon: "github", link: "https://github.com/songforthemute/lunatest" }],
  },
});
