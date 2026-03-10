let
  rev = "89da63c35d8529a5bb70bba15cdd61645289fa11";
  url = "https://github.com/NixOS/nixpkgs/archive/${rev}.tar.gz";
  pinnedNixpkgsPath = builtins.fetchTarball { inherit url; };
  pkgs = import pinnedNixpkgsPath { system = builtins.currentSystem; };
  pinnedNixpkgsSrcDrv = pkgs.fetchFromGitHub {
    owner = "NixOS";
    repo = "nixpkgs";
    inherit rev;
    hash = pkgs.lib.fakeHash;
  };
in
{
  comparison = {
    fetchTarballPath = pinnedNixpkgsPath;
    fetchFromGitHubType = builtins.typeOf pinnedNixpkgsSrcDrv;
  };
  fetchFromGitHub = {
    inherit (pinnedNixpkgsSrcDrv) drvPath outPath;
  };
}
