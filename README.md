# Nix For Embedded Folks

An interactive Slidev deck for pitching Nix and NixOS to embedded software teams.

## What is here

- A Slidev presentation authored in Markdown and Vue components
- A small local demo sidecar that executes whitelisted Nix commands during the talk
- A `flake-parts`-based flake with runnable apps, buildable artifacts, and checks
- `git-hooks.nix` plus `treefmt-nix` so formatting and linting run from a pre-commit hook

## Common commands

```bash
nix develop
nix run .#present
nix build .#slides
nix build .#slides-pdf
nix flake check
```

The dev shell installs the pre-commit hook automatically when entered from a Git checkout.

## nix-direnv

With `direnv` and `nix-direnv` installed, run:

```bash
direnv allow
```

The repository `.envrc` will automatically load this flake's default dev shell.
