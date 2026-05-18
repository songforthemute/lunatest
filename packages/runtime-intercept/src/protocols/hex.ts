function stripHexPrefix(value: string): string {
  return value.replace(/^0x/i, "");
}

function pad32(value: string): string {
  return stripHexPrefix(value).padStart(64, "0").slice(-64).toLowerCase();
}

export function hexQuantity(value: string | number | bigint): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^0x[0-9a-f]+$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    if (/^[0-9]+$/.test(trimmed)) {
      return `0x${BigInt(trimmed).toString(16)}`;
    }
    return "0x0";
  }

  return `0x${BigInt(value).toString(16)}`;
}

export function uint256Hex(value: string | number | bigint): string {
  return `0x${pad32(BigInt(value).toString(16))}`;
}

export function selector(data: unknown): string | null {
  if (typeof data !== "string" || !/^0x[0-9a-f]*$/i.test(data) || data.length < 10) {
    return null;
  }

  return data.slice(0, 10).toLowerCase();
}

export function wordAt(data: string, index: number): string {
  const raw = stripHexPrefix(data).slice(8);
  return raw.slice(index * 64, (index + 1) * 64).padStart(64, "0").toLowerCase();
}

export function uintFromWord(word: string): bigint {
  const raw = stripHexPrefix(word) || "0";
  return BigInt(`0x${raw}`);
}

export function addressFromWord(word: string): string {
  return `0x${stripHexPrefix(word).slice(-40).toLowerCase()}`;
}

export function wordFromAddress(address: string): string {
  return pad32(stripHexPrefix(address).slice(-40));
}

export function encodeString(value: string): string {
  const encoded = Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const paddedLength = Math.ceil(encoded.length / 64) * 64;

  return `0x${pad32("20")}${pad32(BigInt(value.length).toString(16))}${encoded.padEnd(paddedLength, "0")}`;
}

export function encodeUintArray(values: Array<string | number | bigint>): string {
  return `0x${pad32("20")}${pad32(values.length.toString(16))}${values
    .map((value) => pad32(BigInt(value).toString(16)))
    .join("")}`;
}

export function concatHexWords(words: string[]): string {
  return `0x${words.map((word) => pad32(word)).join("")}`;
}
