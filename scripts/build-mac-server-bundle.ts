#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { resolveCatalogDependencies } from "./lib/resolve-catalog.ts";

type BuildArch = "arm64" | "x64";

function parseArgs(argv: string[]) {
  let arch: BuildArch = process.arch === "x64" ? "x64" : "arm64";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--arch") {
      const value = argv[index + 1];
      if (value !== "arm64" && value !== "x64") {
        throw new Error("--arch must be one of: arm64, x64");
      }
      arch = value;
      index += 1;
    }
  }

  return { arch };
}

function parseNodeVersion(engineRange: string): string {
  const match = engineRange.match(/(\d+\.\d+\.\d+)/);
  if (!match) {
    throw new Error(`Could not determine Node version from engines.node='${engineRange}'`);
  }
  return match[1]!;
}

function run(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootPackageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  readonly workspaces: { readonly catalog: Record<string, unknown> };
  readonly engines: { readonly node: string };
};
const serverPackageJson = JSON.parse(
  readFileSync(join(repoRoot, "apps/server/package.json"), "utf8"),
) as {
  readonly version: string;
  readonly dependencies: Record<string, unknown>;
};

const { arch } = parseArgs(process.argv.slice(2));

if ((process.arch === "arm64" ? "arm64" : "x64") !== arch) {
  throw new Error(
    `This script packages native modules for the current host arch (${process.arch}). Run it on a ${arch} Mac to build a ${arch} bundle.`,
  );
}

const nodeVersion = parseNodeVersion(rootPackageJson.engines.node);
const nodeDirName = `node-v${nodeVersion}-darwin-${arch}`;
const nodeArchiveName = `${nodeDirName}.tar.gz`;
const nodeArchiveUrl = `https://nodejs.org/dist/v${nodeVersion}/${nodeArchiveName}`;
const releaseDir = join(repoRoot, "release");
const bundleName = `t3-server-mac-${arch}-v${serverPackageJson.version}`;
const stageRoot = join(tmpdir(), `${bundleName}-${Date.now()}`);
const bundleRoot = join(stageRoot, bundleName);
const appRoot = join(bundleRoot, "app");
const runtimeRoot = join(bundleRoot, "runtime");
const nodeArchivePath = join(stageRoot, nodeArchiveName);
const outputPath = join(releaseDir, `${bundleName}.tar.gz`);

rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(appRoot, { recursive: true });
mkdirSync(runtimeRoot, { recursive: true });
mkdirSync(releaseDir, { recursive: true });

console.log("[mac-server-bundle] Building web + server...");
run("bun", ["run", "build", "--filter=@t3tools/web", "--filter=t3"], repoRoot);

const serverDist = join(repoRoot, "apps/server/dist");
const bundledClient = join(serverDist, "client/index.html");
if (!existsSync(join(serverDist, "index.mjs")) || !existsSync(bundledClient)) {
  throw new Error("Server build output is missing. Expected apps/server/dist with bundled client.");
}

console.log(`[mac-server-bundle] Downloading Node.js ${nodeVersion} for ${arch}...`);
run("curl", ["-LfsS", nodeArchiveUrl, "-o", nodeArchivePath], repoRoot);

console.log("[mac-server-bundle] Extracting Node runtime...");
run("tar", ["-xzf", nodeArchivePath, "-C", runtimeRoot], repoRoot);
renameSync(join(runtimeRoot, nodeDirName), join(runtimeRoot, "node"));

console.log("[mac-server-bundle] Copying server build...");
cpSync(serverDist, join(appRoot, "dist"), { recursive: true });

const packageJson = {
  name: "t3-server-bundle",
  private: true,
  version: serverPackageJson.version,
  type: "module",
  dependencies: resolveCatalogDependencies(
    serverPackageJson.dependencies,
    rootPackageJson.workspaces.catalog,
    "apps/server dependencies",
  ),
};

writeFileSync(join(appRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

console.log("[mac-server-bundle] Installing production dependencies...");
run("bun", ["install", "--production"], appRoot);

writeFileSync(
  join(bundleRoot, "run-t3-server.sh"),
  `#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="\${T3CODE_PORT:-3773}"
exec "$DIR/runtime/node/bin/node" "$DIR/app/dist/index.mjs" --no-browser --host 127.0.0.1 --port "$PORT" "$@"
`,
  { mode: 0o755 },
);

writeFileSync(
  join(bundleRoot, "README.md"),
  `# T3 Code server bundle

Run with:

T3CODE_PORT=3773 ./run-t3-server.sh

Then forward the port over SSH and open http://localhost:3773 locally.
`,
);

console.log("[mac-server-bundle] Creating archive...");
run("tar", ["-czf", outputPath, "-C", stageRoot, bundleName], repoRoot);

console.log(`[mac-server-bundle] Done: ${outputPath}`);
