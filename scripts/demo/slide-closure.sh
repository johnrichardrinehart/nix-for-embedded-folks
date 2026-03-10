#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

cd "$repo_root"

nix \
  --extra-experimental-features 'nix-command flakes' \
  build \
  --builders '' \
  .#slides >/dev/null

exec nix \
  --extra-experimental-features 'nix-command flakes' \
  path-info \
  -Sh \
  .#slides
