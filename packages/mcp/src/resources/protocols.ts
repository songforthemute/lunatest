type ProtocolResourceItem = {
  id: string;
  label: string;
  source: string;
  kind: string;
  supportedChains: number[];
};

export function protocolsResource(protocols: ProtocolResourceItem[]) {
  return {
    uri: "lunatest://protocols",
    content: protocols,
  };
}
