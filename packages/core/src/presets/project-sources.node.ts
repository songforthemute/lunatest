import type { ProjectPresetSources, PresetSourceInput } from "./registry.js";

async function readPresetDir(
  root: string,
  bucket: Record<string, PresetSourceInput>,
  baseDir = root,
): Promise<void> {
  const { readdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await readPresetDir(absolutePath, bucket, baseDir);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".lua")) {
      continue;
    }

    const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, "/");
    const id = relativePath.replace(/\.lua$/u, "");
    bucket[id] = absolutePath;
  }
}

export async function loadProjectPresetSources(
  projectRoot: string,
): Promise<ProjectPresetSources> {
  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const protocolRoot = path.join(projectRoot, "lunatest", "presets", "protocol");
  const walletRoot = path.join(projectRoot, "lunatest", "presets", "wallet");
  const protocol: Record<string, PresetSourceInput> = {};
  const wallet: Record<string, PresetSourceInput> = {};

  try {
    await fs.access(protocolRoot);
    await readPresetDir(protocolRoot, protocol);
  } catch {
    // ignore missing local protocol preset directory
  }

  try {
    await fs.access(walletRoot);
    await readPresetDir(walletRoot, wallet);
  } catch {
    // ignore missing local wallet preset directory
  }

  return {
    protocol,
    wallet,
  };
}
