_: {
  projectRootFile = "flake.nix";

  programs = {
    nixfmt.enable = true;
    prettier.enable = true;
    shellcheck.enable = true;
    shfmt = {
      enable = true;
      indent_size = 2;
    };
  };

  settings = {
    global.excludes = [
      ".direnv/*"
      ".slidev/*"
      ".treefmt-cache/*"
      "dist/*"
      "result/*"
    ];
  };
}
