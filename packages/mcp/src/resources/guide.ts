export function guideResource() {
  return {
    uri: "lunatest://guide",
    content: {
      title: "LunaTest Scenario Guide",
      sections: [
        "Define given state first",
        "Describe action in when.action",
        "Assert ui/state deterministically",
      ],
    },
  };
}
