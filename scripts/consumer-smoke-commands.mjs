function createDirectNodeInvocation(bin, args) {
  return {
    command: bin.command,
    args: [...bin.args, ...args],
    shell: false,
  };
}

export function createConsumerSmokeCommandPlan({ cliBin, mcpBin, configPath }) {
  return {
    cli: {
      validate: createDirectNodeInvocation(cliBin, ["validate"]),
      run: createDirectNodeInvocation(cliBin, ["run"]),
      coverage: createDirectNodeInvocation(cliBin, ["coverage"]),
      generate: createDirectNodeInvocation(cliBin, ["gen", "--ai"]),
      watch: createDirectNodeInvocation(cliBin, ["watch"]),
      doctor: createDirectNodeInvocation(cliBin, ["doctor"]),
    },
    mcp: {
      default: createDirectNodeInvocation(mcpBin, []),
      project: createDirectNodeInvocation(mcpBin, ["--config", configPath]),
      empty: createDirectNodeInvocation(mcpBin, ["--empty"]),
    },
  };
}
