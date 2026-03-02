export function protocolsResource(protocols: string[]) {
  return {
    uri: "lunatest://protocols",
    content: protocols,
  };
}
