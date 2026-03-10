---
title: Nix and NiXOS Intro for Embedded Eng
info: |
  Structured Nix/NixOS deck for embedded practitioners.
theme: ./theme
mdc: true
monaco: true
---

> Deck 01/27 · Intro

# Nix and NiXOS Intro for Embedded Eng

From language semantics to NixOS modules, VM tests, caches, and store introspection.

---

> Deck 02/27 · Map

## Presentation Map

1. Intro
2. Nix vs NixOS vs nixpkgs
3. Language Basics
4. devShell
5. Lazy Evaluation
6. Module System + Configurations
7. VM Tests
8. Substituters
9. Useful Embedded Packaging Patterns
10. Introspection

---

> Deck 03/27 · Motivation

## Embedded Workflow Landscape (Why Teams Feel Pain)

Common starting points:

- **Yocto / BitBake**: flexible and production-proven, but steep metadata complexity.
- **Buildroot**: fast bring-up and simpler model, but weaker package graph reuse.
- **Vendor SDK stacks**: quick wins up front, then drift and workstation snowflakes.
- **Ad-hoc Make/CMake + scripts**: easy to begin, hard to reproduce at team scale.

Recurring pain patterns:

- Environment drift between developers and CI
- Slow or unpredictable rebuild times
- Weak artifact provenance and difficult diffing
- Tribal setup knowledge around toolchains and SDKs

---

> Deck 04/27 · Section 1/9: Nix vs NixOS vs nixpkgs · 1/2

## Clear Separation of Concerns

- **Nix**: the language + evaluator + store model.
- **nixpkgs**: a giant function set building packages/options.
- **NixOS**: a module system building full systems on top of nixpkgs.

<div style="margin-top: 1rem">
  <img src="/assets/nix-holy-trinity.svg" alt="Nix holy trinity diagram: Nix, nixpkgs, NixOS" style="max-width: 84%; max-height: 23vh; object-fit: contain;" />
</div>

---

> Deck 05/27 · Section 1/9: Nix vs NixOS vs nixpkgs · 2/2

## Mental Model for Embedded Teams

- You can use Nix + nixpkgs without adopting NixOS.
- NixOS adds host/system management and module composition.
- Flakes can expose package outputs and NixOS configs side-by-side.

```nix
outputs = { self, nixpkgs, ... }: {
  packages.x86_64-linux.fw = ...;
  nixosConfigurations.lab-host = ...;
};
```

---

> Deck 06/27 · Section 2/9: Nix Language Basics · 1/4

## Numeric Operations, Builtins, and Laziness

```nix
let
  flashKiB = 1024;
  usedKiB = 612;
in {
  freeKiB = flashKiB - usedKiB;
  freePct = (flashKiB - usedKiB) * 100 / flashKiB;
  hasElf = builtins.pathExists ./build/firmware.elf;
  lazyDemo = { used = 42; expensive = builtins.abort "not forced"; }.used;
}
```

- Arithmetic is straightforward.
- `builtins.*` provides evaluator primitives.
- Unused values stay unforced unless referenced.

---

> Deck 07/27 · Section 2/9: Nix Language Basics · 2/4

## Functions and String Interpolation

```nix
{ pkgs, board, optimization ? "s" }:
pkgs.stdenv.mkDerivation {
  pname = "fw-${board}";
  CFLAGS = "-O${optimization}";
}
```

- Functions are first-class and curried.
- Defaults (`?`) make interfaces ergonomic.
- `"${...}"` interpolation composes values safely.

---

> Deck 08/27 · Section 2/9: Nix Language Basics · 3/4

## Literals, Attrsets, and Lists

```nix
{
  board = "stm32f429";
  hz = 168000000;
  debug = true;
  probes = [ "stlink-v2" "jlink" ];
  pins = { led = "PA5"; uart_tx = "PA9"; };
}
```

- Attrsets are the core data structure.
- Lists are ordered and immutable.
- Values are pure expressions.

---

> Deck 09/27 · Section 2/9: Nix Language Basics · 4/4

## `let ... in` and `rec`

```nix
let
  clockHz = 168000000;
in {
  timerTicks = clockHz / 1000;
}
```

```nix
rec {
  pname = "firmware";
  version = "1.2.3";
  imageName = "${pname}-${version}.bin";
}
```

- `let ... in` creates local bindings.
- `rec` enables self-reference inside an attrset.

---

> Deck 10/27 · Section 3/9: devShell Features · 1/2

## What `devShell` Solves

- One command (`nix develop`) provisions toolchains, linters, and helpers.
- Team/CI parity improves because all tools are pinned in flake inputs.
- Shell hooks can bootstrap Git hooks, env vars, and guardrails.

```nix
devShells.default = pkgs.mkShell {
  packages = [ pkgs.cmake pkgs.openocd pkgs.gcc-arm-embedded ];
};
```

---

> Deck 11/27 · Section 3/9: devShell Features · 2/2

## Practical `devShell` Patterns

1. Keep shell scope narrow: only dev tools, not runtime closure.
2. Export deterministic vars in `shellHook`.
3. Pair with `direnv`/`nix-direnv` for auto-activation.

```bash
direnv allow
nix develop
```

---

> Deck 12/27 · Section 4/9: Lazy Evaluation · 1/2

## What Laziness Means in Nix

- Expressions are evaluated on demand.
- Unused attributes are not forced.
- This enables large package sets and overlays to remain tractable.

```nix
{
  used = 42;
  expensive = builtins.abort "not forced";
}.used
```

---

> Deck 13/27 · Section 4/9: Lazy Evaluation · 2/2

## Laziness in Day-to-Day Work

- `nix eval` often touches only queried paths.
- Module options are merged lazily until needed.
- Guard expensive logic behind conditionals/options.

```nix
lib.mkIf config.hardware.fpga.enable {
  environment.systemPackages = [ pkgs.yosys pkgs.nextpnr ];
}
```

---

> Deck 14/27 · Section 5/9: NixOS Module System + Configurations · 1/4

## Why NixOS Modules Exist

```nix
{ lib, config, pkgs, ... }:
{
  imports = [
    ./hardware.nix
    ./services.nix
    ./users.nix
  ];
}
```

- They solve composability: many files become one coherent system config.
- They solve conflict resolution: merge semantics are explicit and typed.
- They solve reuse: hardware, roles, and environments can share modules.

---

> Deck 15/27 · Section 5/9: NixOS Module System + Configurations · 2/4

## Module Structure and Scaling

```nix
{ lib, config, pkgs, ... }:
{
  options.myFeature.enable = lib.mkEnableOption "my feature";

  config = lib.mkIf config.myFeature.enable {
    environment.systemPackages = [ pkgs.htop ];
  };
}
```

1. Option typing catches misconfiguration early.
2. Composition allows reusable hardware/profile modules.
3. Evaluation yields a single coherent `config`.

Great fit for board families and per-target deltas.

---

> Deck 16/27 · Section 5/9: NixOS Module System + Configurations · 3/4

## `nixosConfigurations.<name>.config`

- `nixosConfigurations.foo.config` is the evaluated system tree.
- You can inspect it with `nix eval`.
- It contains both user-facing options and build artifacts.

```bash
nix eval .#nixosConfigurations.lab.config.networking.hostName
```

---

> Deck 17/27 · Section 5/9: NixOS Module System + Configurations · 4/4

## `config.system.build.*` Variants

`config.system.build` exposes build targets from one evaluated config.

Examples:

- `config.system.build.toplevel`
- `config.system.build.vm`
- `config.system.build.isoImage`
- `config.system.build.sdImage`

```bash
nix build .#nixosConfigurations.lab.config.system.build.vm
```

---

> Deck 18/27 · Section 6/9: NixOS VM Tests · 1/2

## Test Topology as Code

NixOS tests define machine graphs and assertions in one derivation.

```nix
{ pkgs, ... }:
pkgs.testers.runNixOSTest {
  name = "ssh-smoke";
  nodes.machine = { ... }: { services.openssh.enable = true; };
  testScript = ''machine.wait_for_unit("sshd.service")'';
}
```

---

> Deck 19/27 · Section 6/9: NixOS VM Tests · 2/2

## Why Embedded Teams Should Care

- Validate update paths before touching hardware labs.
- Assert service behavior and artifact wiring in CI.
- Reproduce failures from test derivation hashes.

---

> Deck 20/27 · Section 7/9: Substituters · 1/2

## Binary Caches and Trust

- Substituters avoid rebuilding everything from source.
- Nix verifies content-addressed paths and signatures.
- Configure cache URLs and trusted public keys.

```nix
nix.settings.substituters = [ "https://cache.nixos.org" "https://my-cache.example" ];
nix.settings.trusted-public-keys = [ "my-cache.example:abc123..." ];
```

---

> Deck 21/27 · Section 7/9: Substituters · 2/2

## Embedded Pipeline Strategy

1. Keep a private cache for toolchains and large SDK closures.
2. Pre-build CI outputs and distribute to developers.
3. Use cache metrics to identify cold-start bottlenecks.

---

> Deck 22/27 · Section 8/9: Useful Embedded Packaging Patterns · 1/3

## `pkgs.requireFile` for Proprietary Toolchains

When redistribution is blocked, keep the download step manual but still reproducible.

```nix
pkgs.requireFile {
  name = "STM32CubeProgrammer-lin-v2-17-0.zip";
  sha256 = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  message = ''
    Place vendor archive in your local store:
      nix-store --add-fixed sha256 STM32CubeProgrammer-lin-v2-17-0.zip
  '';
}
```

- Encodes legal boundary in Nix evaluation.
- Gives deterministic hash + filename checks.
- Works well with internal docs for onboarding.

---

> Deck 23/27 · Section 8/9: Useful Embedded Packaging Patterns · 2/3

## Fixed-Output Derivations (FODs)

FODs pin externally fetched bytes by hash, regardless of builder environment.

```nix
stdenv.mkDerivation {
  pname = "vendor-sdk-src";
  version = "2026.1";
  src = fetchurl {
    url = "https://artifacts.example/sdk-2026.1.tar.xz";
    hash = "sha256-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=";
  };
}
```

- Ideal for tarballs, firmware blobs, and vendored archives.
- Cache hit is keyed by expected hash.
- If upstream bytes change, build fails loudly instead of drifting.

---

> Deck 24/27 · Section 8/9: Useful Embedded Packaging Patterns · 3/3

## SBOMs, Patches, and `meta.licenses`

Use package metadata plus source transforms to improve compliance traceability.

```nix
stdenv.mkDerivation {
  pname = "vendor-fw";
  version = "1.0";
  src = fetchFromGitHub { owner = "acme"; repo = "fw"; rev = "v1.0"; hash = "..."; };
  patches = [ ./patches/fix-cve-2026-1234.patch ];
  meta.licenses = [ lib.licenses.bsd3 lib.licenses.mit ];
}
```

- `patches` documents local deltas explicitly.
- `meta.licenses` keeps license intent machine-readable.
- SBOM generation can be derived from closure + metadata in CI.

---

> Deck 25/27 · Section 9/9: Introspection · 1/3

## Interactive: `fetchTarball` vs `fetchFromGitHub`

Pinned revision:

`89da63c35d8529a5bb70bba15cdd61645289fa11`

- `builtins.fetchTarball` evaluates to a realized `/nix/store/...` source path.
- `pkgs.fetchFromGitHub` evaluates to a derivation (`drvPath` + `outPath`).
- Snippets live in:
  - `snippets/fetchtarball-store-path.nix`
  - `snippets/fetchfromgithub-derivation.nix`

<LiveCommandDemo
  title="Fetch Primitive Comparison"
  description="The first action returns a realized store path. The second shows a derivation (drvPath/outPath) from pkgs.fetchFromGitHub."
  mode="modal"
  button-label="Explore / Interact"
  :actions="[
    { id: 'fetchtarball-store-path', label: 'Evaluate fetchTarball', hint: 'Expect /nix/store/... source path.' },
    { id: 'fetchfromgithub-derivation', label: 'Evaluate fetchFromGitHub', hint: 'Expect derivation metadata (drvPath/outPath).' }
  ]"
/>

---

> Deck 26/27 · Section 9/9: Introspection · 2/3

## Derivations and Store Graph Introspection

```bash
nix derivation show .#slides
nix-store --query --requisites ./result
nix-store --query --referrers /nix/store/<path>
nix-diff /nix/store/<old>.drv /nix/store/<new>.drv
```

- `derivation show`: build recipe-level visibility.
- `--requisites` / `--referrers`: closure graph navigation.
- `nix-diff`: why rebuilds happened.

---

> Deck 27/27 · Section 9/9: Introspection · 3/3

## Live Introspection Slice

<LiveCommandDemo
  title="Nix Introspection Quick Actions"
  description="Run small pre-wired checks to inspect this deck's own pinned environment and closure."
  mode="modal"
  button-label="Explore / Interact"
  :actions="[
    { id: 'current-system', label: 'Current system', hint: 'Inspect evaluator host system.' },
    { id: 'slide-tool-versions', label: 'Tool versions', hint: 'Read pinned tool versions from nixpkgs.' },
    { id: 'slide-closure', label: 'Closure size', hint: 'Inspect result closure size.' }
  ]"
/>
