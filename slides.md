---
title: Nix and NixOS for Embedded Development
info: |
  Interactive slides for pitching reproducible firmware, FPGA, and Linux image workflows.
transition: fade-out
theme: ./theme
mdc: true
monaco: true
---

# Nix and NixOS for Embedded Development

Build STM32 firmware, FPGA toolchains, and custom Linux images from one reproducible graph.

<div class="hero-band">
  <span>STM32 firmware</span>
  <span>FPGA toolchains</span>
  <span>Linux images</span>
  <span>Cross compilation</span>
</div>

---

## Why This Fits Embedded Teams

<div class="card-grid">
  <div class="value-card">
    <h3>One graph, many artifacts</h3>
    <p>Toolchains, SDKs, build helpers, simulators, and final images live in one composable dependency graph.</p>
  </div>
  <div class="value-card">
    <h3>Reproducible environments</h3>
    <p>The same shell drives local development, CI builds, release packaging, and on-stage demos.</p>
  </div>
  <div class="value-card">
    <h3>Traceable upgrades</h3>
    <p>Moving a compiler, BSP, or FPGA toolchain becomes an explicit diff instead of ambient workstation drift.</p>
  </div>
  <div class="value-card">
    <h3>Portable demos</h3>
    <p>This deck is itself a packaged artifact, so the presentation proves the workflow while it explains it.</p>
  </div>
</div>

---

## Concrete Use Cases

<div class="split-panel">
  <div>
    <h3>Firmware</h3>
    <ul>
      <li>Pin cross compilers, OpenOCD, flashing helpers, and test harnesses.</li>
      <li>Package board-specific images and dev shells together.</li>
      <li>Capture debug utilities and documentation generators in the same flake.</li>
    </ul>
  </div>
  <div>
    <h3>Linux and FPGA</h3>
    <ul>
      <li>Assemble custom root filesystems and image pipelines reproducibly.</li>
      <li>Model vendor SDKs and synthesis tools as explicit inputs instead of tribal setup docs.</li>
      <li>Share simulation, lint, and packaging workflows across teams and CI.</li>
    </ul>
  </div>
</div>

---

## How This Deck Works

<div class="architecture-strip">
  <div>
    <strong>Slidev</strong>
    <p>Markdown plus Vue components for the narrative and UI.</p>
  </div>
  <div>
    <strong>Local sidecar</strong>
    <p>A tiny Node server executes whitelisted demo commands on demand.</p>
  </div>
  <div>
    <strong>flake-parts</strong>
    <p>`nix run`, `nix build`, and `nix flake check` all come from the same flake.</p>
  </div>
  <div>
    <strong>treefmt + hooks</strong>
    <p>Formatting and linting are enforced before each commit.</p>
  </div>
</div>

---

## Live Nix Demo

<LiveCommandDemo
  title="Run the thesis live"
  description="These buttons hit a local sidecar, which runs a small whitelist of demo commands inside the repo and streams the result back into the slide."
  :actions="[
    {
      id: 'current-system',
      label: 'Current system',
      hint: 'Ask Nix which host system is actually running this talk.'
    },
    {
      id: 'slide-tool-versions',
      label: 'Pinned slide toolchain',
      hint: 'Inspect the deck tooling directly from the flake input set.'
    },
    {
      id: 'slide-closure',
      label: 'Deck closure size',
      hint: 'Show what the packaged presentation costs in the Nix store.'
    }
  ]"
/>

---

## Decision Matrix

<div class="matrix-table">
  <div class="matrix-row matrix-head">
    <span>Route</span>
    <span>Best at</span>
    <span>Tradeoff</span>
  </div>
  <div class="matrix-row">
    <span>Slidev + sidecar</span>
    <span>Live local demos inside a browser-native slide deck</span>
    <span>Requires a small app layer for command execution</span>
  </div>
  <div class="matrix-row">
    <span>Quarto + reveal.js</span>
    <span>Document-first literate publishing with strong HTML output</span>
    <span>Less natural for arbitrary shell or Nix execution during the talk</span>
  </div>
  <div class="matrix-row">
    <span>Typst + Polylux/Touying</span>
    <span>PDF-first reliability and polished static slides</span>
    <span>Not a native fit for runtime interactivity</span>
  </div>
</div>

---

## Repo Contract

```bash
nix run .#present
nix build .#slides
nix build .#slides-pdf
nix flake check
```

If the presentation itself is reproducible, the pitch becomes harder to dismiss.
