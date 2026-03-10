let
  repoRoot = builtins.getEnv "REPO_ROOT";
  flake = builtins.getFlake repoRoot;
  pkgs = import flake.inputs.nixpkgs { system = builtins.currentSystem; };
in
{
  slidev = pkgs.slidev-cli.version;
  quarto = pkgs.quarto.version;
  presenterm = pkgs.presenterm.version;
  typst = pkgs.typst.version;
}
