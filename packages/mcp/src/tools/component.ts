type ComponentStateMap = Record<string, string[]>;

type ComponentNode = {
  name: string;
  children?: ComponentNode[];
};

export function createComponentTools(
  tree: ComponentNode[] = [],
  states: ComponentStateMap = {},
) {
  return {
    async tree() {
      return tree;
    },

    async states(name: string) {
      return states[name] ?? [];
    },
  };
}
