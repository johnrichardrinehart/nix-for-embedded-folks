#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

cd "$repo_root"

exec nix \
  --extra-experimental-features 'nix-command flakes' \
  eval \
  --impure \
  --json \
  --expr '
    let
      flake = builtins.getFlake (toString ./.);
      pkgs = import flake.inputs.nixpkgs { system = builtins.currentSystem; };
    in
    {
      slidev = pkgs.slidev-cli.version;
      quarto = pkgs.quarto.version;
      presenterm = pkgs.presenterm.version;
      typst = pkgs.typst.version;
    }
  '
