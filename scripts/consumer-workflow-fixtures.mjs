import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const scenarioPath = "scenarios/swap.lua";
const configPath = "lunatest.config.json";
const aiAdapterPath = "adapter.mjs";

const initialScenario = `scenario {
  name = "swap-smoke",
  given = {
    wallet = { connected = true },
    quotePanel = { visible = true },
  },
  when = { action = "swap" },
  then_ui = {
    wallet = { connected = true },
    quotePanel = { visible = true },
  },
  then_state = {
    wallet = { connected = true },
    quotePanel = { visible = true },
  },
  coverage = {
    features = { "swap" },
    states = { "quoteLoaded" },
    components = { "quotePanel" },
  },
}
`;

const updatedScenario = initialScenario.replace("swap-smoke", "swap-smoke-updated");

const aiAdapter = `const chunks = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
const scenario = input.scenarios?.find(
  (item) => typeof item.source === "string" && /scenarios[\\\\/]swap\\.lua$/.test(item.source),
);
if (!scenario || scenario.name !== "swap-smoke") {
  throw new Error("scenario catalog contract mismatch");
}
if (JSON.stringify(scenario.coverage) !== JSON.stringify({
  features: ["swap"],
  states: ["quoteLoaded"],
  components: ["quotePanel"],
})) {
  throw new Error("scenario coverage contract mismatch");
}
if (JSON.stringify(input.coverage?.missing) !== JSON.stringify({
  features: ["approve"],
  states: ["approvalPending"],
  components: ["actionButtonRow"],
})) {
  throw new Error("coverage gap contract mismatch");
}
if (!Array.isArray(input.prompts)) {
  throw new Error("prompt catalog contract mismatch");
}
process.stdout.write(JSON.stringify([
  {
    name: "generated-edge-case",
    lua: "scenario { name = 'generated-edge-case', given = { wallet = { connected = true }, quotePanel = { visible = true } }, when = { action = 'swap' }, then_ui = { wallet = { connected = true }, quotePanel = { visible = true } }, then_state = { wallet = { connected = true }, quotePanel = { visible = true } } }",
    coverage: { features: ["swap"], states: ["quoteLoaded"], components: ["quotePanel"] },
    tags: ["generated", "edge-case"],
  },
]));
`;

export function createConsumerWorkflowFixture() {
  const config = {
    scenarioDir: "scenarios",
    luaConfigPath: "lunatest.lua",
    coverageCatalog: {
      features: ["swap", "approve"],
      states: ["quoteLoaded", "approvalPending"],
      components: ["quotePanel", "actionButtonRow"],
    },
    ai: {
      command: "node",
      args: ["./adapter.mjs"],
    },
  };

  return {
    configPath,
    scenarioPath,
    aiAdapterPath,
    generatedScenarioPath: "scenarios/generated-edge-case.lua",
    updatedScenario,
    files: {
      [configPath]: `${JSON.stringify(config, null, 2)}\n`,
      [scenarioPath]: initialScenario,
      [aiAdapterPath]: aiAdapter,
    },
  };
}

export async function writeConsumerWorkflowFixture(projectDir) {
  const fixture = createConsumerWorkflowFixture();

  await Promise.all(
    Object.entries(fixture.files).map(async ([relativePath, contents]) => {
      const target = join(projectDir, relativePath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents, "utf8");
    }),
  );

  return {
    ...fixture,
    configFile: join(projectDir, fixture.configPath),
    scenarioFile: join(projectDir, fixture.scenarioPath),
    generatedScenarioFile: join(projectDir, fixture.generatedScenarioPath),
  };
}
