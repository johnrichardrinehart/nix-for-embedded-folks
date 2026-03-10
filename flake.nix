{
  description = "Interactive Slidev deck for pitching Nix and NixOS to embedded developers";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/89da63c35d8529a5bb70bba15cdd61645289fa11";
    flake-parts.url = "github:hercules-ci/flake-parts";
    treefmt-nix.url = "github:numtide/treefmt-nix";
    git-hooks-nix.url = "github:cachix/git-hooks.nix";
  };

  outputs =
    inputs@{
      flake-parts,
      git-hooks-nix,
      treefmt-nix,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];

      perSystem =
        { pkgs, system, ... }:
        let
          inherit (pkgs) lib;

          projectName = "nix-for-embedded-folks";
          version = "0.1.0";
          playwrightChromiumRevision = "1208";
          sourceExcludes = [
            ".direnv"
            ".git"
            ".slidev"
            ".treefmt-cache"
            "dist"
            "result"
          ];

          source = lib.cleanSourceWith {
            src = ./.;
            filter =
              path: _type:
              let
                baseName = builtins.baseNameOf path;
              in
              !(lib.elem baseName sourceExcludes);
          };

          treefmtEval = treefmt-nix.lib.evalModule pkgs ./treefmt.nix;
          presentRuntimeInputs = with pkgs; [
            esbuild
            nodejs
            slidev-cli
          ];
          mkApp = description: program: {
            type = "app";
            inherit program;
            meta.description = description;
          };

          preCommitCheck = git-hooks-nix.lib.${system}.run {
            src = source;
            hooks = {
              deadnix.enable = true;
              statix.enable = true;
              treefmt = {
                enable = true;
                name = "treefmt";
                entry = "${treefmtEval.config.build.wrapper}/bin/treefmt --fail-on-change";
                pass_filenames = false;
                always_run = true;
              };
            };
          };

          demoServer = pkgs.stdenvNoCC.mkDerivation {
            pname = "${projectName}-demo-server";
            inherit version;
            src = source;
            nativeBuildInputs = [ pkgs.esbuild ];

            buildPhase = ''
              runHook preBuild

              mkdir -p build
              esbuild demo-server/src/index.ts \
                --bundle \
                --format=esm \
                --platform=node \
                --target=node20 \
                --outfile=build/demo-server.mjs

              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              mkdir -p $out/bin $out/libexec
              cp build/demo-server.mjs $out/libexec/demo-server.mjs

              cat > $out/bin/nix-for-embedded-folks-demo-server <<EOF
              #!/usr/bin/env bash
              set -euo pipefail
              export REPO_ROOT="''${REPO_ROOT:-$PWD}"
              exec ${pkgs.nodejs}/bin/node $out/libexec/demo-server.mjs
              EOF

              chmod +x $out/bin/nix-for-embedded-folks-demo-server

              runHook postInstall
            '';
          };

          presentScript = pkgs.writeShellApplication {
            name = "${projectName}-present";
            runtimeInputs = presentRuntimeInputs;
            text = builtins.readFile ./scripts/present;
          };

          enterSlideBuildTree = ''
            export HOME="$TMPDIR/home"
            mkdir -p "$HOME"
            cp -r "$src" source
            chmod -R u+w source
            cd source
          '';

          mkSlideArtifact =
            {
              name,
              nativeBuildInputs ? [ pkgs.slidev-cli ],
              buildCommand,
              installCommand,
            }:
            pkgs.stdenvNoCC.mkDerivation {
              pname = "${projectName}-${name}";
              inherit version nativeBuildInputs;
              src = source;

              buildPhase = ''
                runHook preBuild
                ${enterSlideBuildTree}
                ${buildCommand}
                runHook postBuild
              '';

              installPhase = ''
                runHook preInstall
                ${installCommand}
                runHook postInstall
              '';
            };

          slides = mkSlideArtifact {
            name = "slides";
            buildCommand = ''
              slidev build slides.md --out dist
            '';
            installCommand = ''
              mkdir -p $out/share/slides
              cp -r dist/. $out/share/slides/
            '';
          };

          slidesPdf = mkSlideArtifact {
            name = "slides-pdf";
            nativeBuildInputs = [
              pkgs.chromium
              pkgs.slidev-cli
            ];
            buildCommand = ''
              export PLAYWRIGHT_BROWSERS_PATH="$TMPDIR/playwright-browsers"
              export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
              mkdir -p "$PLAYWRIGHT_BROWSERS_PATH/chromium-${playwrightChromiumRevision}/chrome-linux"
              mkdir -p "$PLAYWRIGHT_BROWSERS_PATH/chromium_headless_shell-${playwrightChromiumRevision}/chrome-headless-shell-linux64"
              ln -s ${pkgs.chromium}/bin/chromium \
                "$PLAYWRIGHT_BROWSERS_PATH/chromium-${playwrightChromiumRevision}/chrome-linux/chrome"
              ln -s ${pkgs.chromium}/bin/chromium \
                "$PLAYWRIGHT_BROWSERS_PATH/chromium_headless_shell-${playwrightChromiumRevision}/chrome-headless-shell-linux64/chrome-headless-shell"
              slidev export slides.md --output slides.pdf
            '';
            installCommand = ''
              mkdir -p $out
              cp slides.pdf $out/slides.pdf
            '';
          };

          presentApp = mkApp "Run the Slidev presentation with the local demo sidecar" "${presentScript}/bin/${projectName}-present";
          demoServerApp = mkApp "Run the local command demo sidecar" "${demoServer}/bin/${projectName}-demo-server";
        in
        {
          formatter = treefmtEval.config.build.wrapper;

          packages = {
            default = slides;
            inherit slides;
            "demo-server" = demoServer;
            "slides-pdf" = slidesPdf;
          };

          apps = {
            default = presentApp;
            present = presentApp;
            "demo-server" = demoServerApp;
          };

          checks = {
            formatting = treefmtEval.config.build.check source;
            pre-commit = preCommitCheck;
            inherit slides;
            "demo-server" = demoServer;
          };

          devShells.default = pkgs.mkShell {
            packages = [
              pkgs.chromium
              treefmtEval.config.build.wrapper
            ]
            ++ presentRuntimeInputs
            ++ preCommitCheck.enabledPackages;

            shellHook = ''
              ${preCommitCheck.shellHook}
              export REPO_ROOT=$PWD
            '';
          };
        };
    };
}
