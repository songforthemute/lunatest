const DEFAULT_TIMEOUT_MS = 15_000;

const checks = [
  {
    label: "live demo guide",
    path: "guides/live-demo",
    includes: [
      "Live Demo",
      "examples/swap-dapp/",
      "LunaTest deterministic swap live demo",
    ],
  },
  {
    label: "embedded swap demo app",
    path: "examples/swap-dapp/",
    includes: [
      "LunaTest Sepolia Swap Demo",
      "assets/",
    ],
  },
  {
    label: "embedded swap demo Lua source",
    path: "examples/swap-dapp/lunatest.lua",
    includes: [
      "scenario",
      "swap_demo_runtime",
      "pending_10m",
    ],
  },
];

function normalizeBaseUrl(value) {
  const raw = value?.trim();
  if (!raw) {
    throw new Error("DOCS_SITE_URL is required for deployed docs smoke checks.");
  }

  const url = new URL(raw);
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }
  return url;
}

function resolveCheckUrl(baseUrl, path) {
  return new URL(path, baseUrl).href;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function assertIncludes(text, expected, label, url) {
  for (const item of expected) {
    if (!text.includes(item)) {
      throw new Error(`[${label}] ${url} did not include expected text: ${item}`);
    }
  }
}

async function run() {
  const baseUrl = normalizeBaseUrl(process.env.DOCS_SITE_URL);

  for (const check of checks) {
    const url = resolveCheckUrl(baseUrl, check.path);
    const text = await fetchText(url);
    assertIncludes(text, check.includes, check.label, url);
    console.log(`[docs smoke] ok ${check.label}: ${url}`);
  }
}

run().catch((error) => {
  console.error(`[docs smoke] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
