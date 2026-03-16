import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(packageRoot, "src", "presets");
const targetRoot = path.join(packageRoot, "dist", "presets");

await mkdir(targetRoot, { recursive: true });
await cp(sourceRoot, targetRoot, { recursive: true });
