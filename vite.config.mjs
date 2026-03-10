import { fileURLToPath, URL } from "node:url";

export default {
  resolve: {
    alias: {
      "lz-string/libs/lz-string.js": fileURLToPath(
        new URL("./shims/lz-string-default.mjs", import.meta.url),
      ),
    },
  },
};
