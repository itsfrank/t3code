#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH='' cd -- "${SCRIPT_DIR}/.." && pwd)"
OUT_DIR="${OUT_DIR:-${SCRIPT_DIR}/out}"
NODE_VERSION="${NODE_VERSION:-24.13.1}"

mkdir -p "${OUT_DIR}"

docker buildx build \
	--platform linux/amd64 \
	--build-arg "NODE_VERSION=${NODE_VERSION}" \
	--file "${SCRIPT_DIR}/Dockerfile" \
	--output "type=local,dest=${OUT_DIR}" \
	"${REPO_ROOT}"

printf 'Remote bundle written to %s/t3code-remote-linux-x64.tar.gz\n' "${OUT_DIR}"
