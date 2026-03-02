export type DevtoolsCommandOptions = {
  open: boolean;
};

export function devtoolsCommand(options: DevtoolsCommandOptions): string {
  if (!options.open) {
    return "devtools command requires --open";
  }

  return [
    "Devtools",
    "status=ready",
    "widget=LunaDevtoolsPanel",
    "mount=mountLunaDevtools()",
  ].join("\n");
}
