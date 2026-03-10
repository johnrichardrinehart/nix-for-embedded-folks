let
  rev = "89da63c35d8529a5bb70bba15cdd61645289fa11";
  url = "https://github.com/NixOS/nixpkgs/archive/${rev}.tar.gz";
in
builtins.fetchTarball { inherit url; }
