import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(packageRoot, "src", "presets");
const targetRoot = path.join(packageRoot, "dist", "presets");
const wasmoonRoot = path.dirname(fileURLToPath(import.meta.resolve("wasmoon")));
const wasmSource = path.join(wasmoonRoot, "glue.wasm");
const wasmTarget = path.join(packageRoot, "dist", "runtime", "glue.wasm");

await mkdir(targetRoot, { recursive: true });
await cp(sourceRoot, targetRoot, { recursive: true });
await mkdir(path.dirname(wasmTarget), { recursive: true });
await cp(wasmSource, wasmTarget);
