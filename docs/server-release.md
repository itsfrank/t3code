# Server Release Workflow

This workflow builds standalone server bundles for remote machines and uploads them to a GitHub Release.

Workflow file: `.github/workflows/release-server.yml`

## Trigger

- `workflow_dispatch` only

Inputs:

- `version`: release version, for example `1.2.3` or `v1.2.3`
- `ref`: optional commit, branch, or tag to build from

The workflow creates or updates release tag `vX.Y.Z` and uploads these assets:

- `t3-server-mac-arm64-vX.Y.Z.tar.gz`
- `t3-server-linux-x64-vX.Y.Z.tar.gz`
- `t3-server-win-x64-vX.Y.Z.zip`

## What is bundled

- built server output from `apps/server/dist`
- bundled web client from `apps/server/dist/client`
- matching official Node.js runtime for the target OS and architecture
- production-only dependencies
- platform launcher script

## What is not bundled

Provider CLIs like `codex` and `claude` are not included. Install those separately on the remote machine if you want to use those providers.

## Local build commands

```bash
bun run dist:server:mac
bun run dist:server:linux
bun run dist:server:win
```
