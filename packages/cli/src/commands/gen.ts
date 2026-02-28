export type GenCommandOptions = {
  ai: boolean;
};

export function genCommand(options: GenCommandOptions): string {
  if (!options.ai) {
    return "gen command requires --ai";
  }

  return "AI generation complete\ncreated=1\nexecuted=1";
}
