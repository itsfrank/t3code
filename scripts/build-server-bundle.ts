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
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCatalogDependencies } from "./lib/resolve-catalog.ts";

type BuildPlatform = "mac" | "linux" | "win";
type BuildArch = "arm64" | "x64";

interface ParsedArgs {
  readonly platform: BuildPlatform;
  readonly arch: BuildArch;
  readonly buildVersion: string | undefined;
  readonly outputDir: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let platform: BuildPlatform | undefined;
  let arch: BuildArch | undefined;
  let buildVersion: string | undefined;
  let outputDir = "release";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === "--platform") {
      if (value !== "mac" && value !== "linux" && value !== "win") {
        throw new Error("--platform must be one of: mac, linux, win");
      }
      platform = value;
      index += 1;
      continue;
    }

    if (arg === "--arch") {
      if (value !== "arm64" && value !== "x64") {
        throw new Error("--arch must be one of: arm64, x64");
      }
      arch = value;
      index += 1;
      continue;
    }

    if (arg === "--build-version") {
      if (!value) {
        throw new Error("--build-version requires a value");
      }
      buildVersion = value;
      index += 1;
      continue;
    }

    if (arg === "--output-dir") {
      if (!value) {
        throw new Error("--output-dir requires a value");
      }
      outputDir = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!platform) {
    throw new Error("--platform is required");
  }
  if (!arch) {
    throw new Error("--arch is required");
  }
  if (platform !== "mac" && arch !== "x64") {
    throw new Error(`--arch ${arch} is not supported for ${platform}`);
  }

  return { platform, arch, buildVersion, outputDir };
}

function parseNodeVersion(engineRange: string): string {
  const match = engineRange.match(/(\d+\.\d+\.\d+)/);
  if (!match) {
    throw new Error(`Could not determine Node version from engines.node='${engineRange}'`);
  }
  return match[1]!;
}

function run(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  options?: { readonly shell?: boolean },
) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: options?.shell ?? false,
    env: {
      ...process.env,
      ...env,
    },
  });
}

async function downloadFile(url: string, destinationPath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(destinationPath, bytes);
}

function getHostPlatform(platform: NodeJS.Platform): BuildPlatform {
  switch (platform) {
    case "darwin":
      return "mac";
    case "linux":
      return "linux";
    case "win32":
      return "win";
    default:
      throw new Error(`Unsupported host platform: ${platform}`);
  }
}

function getHostArch(arch: string): BuildArch {
  switch (arch) {
    case "arm64":
      return "arm64";
    case "x64":
      return "x64";
    default:
      throw new Error(`Unsupported host architecture: ${arch}`);
  }
}

function getNodeRuntimeInfo(platform: BuildPlatform, arch: BuildArch, version: string) {
  if (platform === "mac") {
    const dirName = `node-v${version}-darwin-${arch}`;
    return {
      dirName,
      archiveName: `${dirName}.tar.gz`,
      archiveType: "tar.gz" as const,
    };
  }

  if (platform === "linux") {
    const dirName = `node-v${version}-linux-${arch}`;
    return {
      dirName,
      archiveName: `${dirName}.tar.gz`,
      archiveType: "tar.gz" as const,
    };
  }

  const dirName = `node-v${version}-win-${arch}`;
  return {
    dirName,
    archiveName: `${dirName}.zip`,
    archiveType: "zip" as const,
  };
}

function writeLauncher(bundleRoot: string, platform: BuildPlatform) {
  if (platform === "win") {
    writeFileSync(
      join(bundleRoot, "run-t3-server.cmd"),
      [
        "@echo off",
        "setlocal",
        'if "%T3CODE_PORT%"=="" set "T3CODE_PORT=3773"',
        '"%~dp0runtime\\node\\node.exe" "%~dp0app\\dist\\index.mjs" --no-browser --host 127.0.0.1 --port "%T3CODE_PORT%" %*',
        "",
      ].join("\r\n"),
    );
    return;
  }

  writeFileSync(
    join(bundleRoot, "run-t3-server.sh"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'DIR="$(cd "$(dirname "$0")" && pwd)"',
      'PORT="${T3CODE_PORT:-3773}"',
      'exec "$DIR/runtime/node/bin/node" "$DIR/app/dist/index.mjs" --no-browser --host 127.0.0.1 --port "$PORT" "$@"',
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
}

function writeReadme(bundleRoot: string, platform: BuildPlatform, archiveFileName: string) {
  const launcher = platform === "win" ? ".\\run-t3-server.cmd" : "./run-t3-server.sh";
  const unpack =
    platform === "win"
      ? `Expand-Archive ${archiveFileName} -DestinationPath .`
      : `tar -xzf ${archiveFileName}`;
  const extractedDir =
    platform === "win"
      ? archiveFileName.replace(/\.zip$/, "")
      : archiveFileName.replace(/\.tar\.gz$/, "");
  const startCommand =
    platform === "win" ? `$env:T3CODE_PORT=3773; ${launcher}` : `T3CODE_PORT=3773 ${launcher}`;

  writeFileSync(
    join(bundleRoot, "README.md"),
    [
      "# T3 Code server bundle",
      "",
      "This bundle includes the T3 server runtime, Node.js runtime, and production dependencies.",
      "",
      "## Start",
      "",
      platform === "win" ? "```powershell" : "```bash",
      unpack,
      `cd ${extractedDir}`,
      startCommand,
      "```",
      "",
      "Then connect to `http://localhost:3773` through an SSH port-forward if the machine is remote.",
      "",
      "Provider CLIs such as `codex` and `claude` are not bundled and must be installed separately if you want to use those providers.",
      "",
    ].join("\n"),
  );
}

function createArchive(
  stageRoot: string,
  bundleName: string,
  outputPath: string,
  platform: BuildPlatform,
) {
  if (platform === "win") {
    run(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${bundleName}' -DestinationPath '${outputPath}' -Force`,
      ],
      stageRoot,
    );
    return;
  }

  run("tar", ["-czf", outputPath, "-C", stageRoot, bundleName], stageRoot);
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

const { platform, arch, buildVersion, outputDir } = parseArgs(process.argv.slice(2));
const hostPlatform = getHostPlatform(process.platform);
const hostArch = getHostArch(process.arch);

if (hostPlatform !== platform || hostArch !== arch) {
  throw new Error(
    `This script must run on ${platform}/${arch}. Current host is ${hostPlatform}/${hostArch}.`,
  );
}

const appVersion = buildVersion ?? serverPackageJson.version;
const nodeVersion = parseNodeVersion(rootPackageJson.engines.node);
const runtimeInfo = getNodeRuntimeInfo(platform, arch, nodeVersion);
const nodeArchiveUrl = `https://nodejs.org/dist/v${nodeVersion}/${runtimeInfo.archiveName}`;
const releaseDir = join(repoRoot, outputDir);
const platformLabel = platform === "win" ? "win" : platform;
const bundleName = `t3-server-${platformLabel}-${arch}-v${appVersion}`;
const archiveExtension = platform === "win" ? "zip" : "tar.gz";
const stageRoot = join(tmpdir(), `${bundleName}-${Date.now()}`);
const bundleRoot = join(stageRoot, bundleName);
const appRoot = join(bundleRoot, "app");
const runtimeRoot = join(bundleRoot, "runtime");
const nodeArchivePath = join(stageRoot, runtimeInfo.archiveName);
const outputPath = join(releaseDir, `${bundleName}.${archiveExtension}`);

rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(appRoot, { recursive: true });
mkdirSync(runtimeRoot, { recursive: true });
mkdirSync(releaseDir, { recursive: true });

console.log("[server-bundle] Building web + server...");
run("bun", ["run", "build", "--filter=@t3tools/web", "--filter=t3"], repoRoot);

const serverDist = join(repoRoot, "apps/server/dist");
const bundledClient = join(serverDist, "client/index.html");
if (!existsSync(join(serverDist, "index.mjs")) || !existsSync(bundledClient)) {
  throw new Error("Server build output is missing. Expected apps/server/dist with bundled client.");
}

console.log(`[server-bundle] Downloading Node.js ${nodeVersion} for ${platform}/${arch}...`);
await downloadFile(nodeArchiveUrl, nodeArchivePath);

console.log("[server-bundle] Extracting Node runtime...");
if (runtimeInfo.archiveType === "tar.gz") {
  run("tar", ["-xzf", nodeArchivePath, "-C", runtimeRoot], repoRoot);
} else {
  run(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${nodeArchivePath}' -DestinationPath '${runtimeRoot}' -Force`,
    ],
    repoRoot,
  );
}
renameSync(join(runtimeRoot, runtimeInfo.dirName), join(runtimeRoot, "node"));

console.log("[server-bundle] Copying server build...");
cpSync(serverDist, join(appRoot, "dist"), { recursive: true });

const packageJson = {
  name: "t3-server-bundle",
  private: true,
  version: appVersion,
  type: "module",
  dependencies: resolveCatalogDependencies(
    serverPackageJson.dependencies,
    rootPackageJson.workspaces.catalog,
    "apps/server dependencies",
  ),
};

writeFileSync(join(appRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

console.log("[server-bundle] Installing production dependencies...");
run(
  "npm",
  ["install", "--omit=dev"],
  appRoot,
  undefined,
  process.platform === "win32" ? { shell: true } : undefined,
);

writeLauncher(bundleRoot, platform);
writeReadme(bundleRoot, platform, `${bundleName}.${archiveExtension}`);

console.log("[server-bundle] Creating archive...");
createArchive(stageRoot, bundleName, outputPath, platform);

console.log(`[server-bundle] Done: ${outputPath}`);
