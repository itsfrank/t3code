#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="${SCRIPT_DIR}/node/bin/node"
APP_ROOT="${SCRIPT_DIR}/t3code"
SERVER_ENTRY="${APP_ROOT}/apps/server/dist/index.mjs"
WORKSPACE_PATH="${1:-${PWD}}"
T3CODE_PORT="${T3CODE_PORT:-3773}"
T3CODE_HOST="${T3CODE_HOST:-127.0.0.1}"
T3CODE_HOME="${T3CODE_HOME:-${HOME}/.t3code-remote}"

if [[ ! -x "${NODE_BIN}" ]]; then
	printf 'error: bundled node runtime not found at %s\n' "${NODE_BIN}" >&2
	exit 1
fi

if [[ ! -f "${SERVER_ENTRY}" ]]; then
	printf 'error: server entry not found at %s\n' "${SERVER_ENTRY}" >&2
	exit 1
fi

if [[ ! -d "${WORKSPACE_PATH}" ]]; then
	printf 'error: workspace path does not exist: %s\n' "${WORKSPACE_PATH}" >&2
	exit 1
fi

mkdir -p "${T3CODE_HOME}"

cd "${WORKSPACE_PATH}"

exec "${NODE_BIN}" "${SERVER_ENTRY}" \
	--host "${T3CODE_HOST}" \
	--port "${T3CODE_PORT}" \
	--no-browser
