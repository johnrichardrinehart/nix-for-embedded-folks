#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

cd "$repo_root"
export REPO_ROOT="$repo_root"

exec nix \
  --extra-experimental-features 'nix-command flakes' \
  eval \
  --impure \
  --json \
  --file "$repo_root/snippets/slide-tool-versions.nix"
