import js from "@eslint/js";
import globals from "globals";
import tsEslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { includeIgnoreFile } from "@eslint/compat";
import { fileURLToPath } from "node:url";
import { join as pathJoin } from "node:path";

const jsExt = "{js,mjs,cjs,ts,mts,cts}";
const filePatterns = ["./src/**/*." + jsExt];
const ignoredPatterns = ["./test/**/*"];

const gitIgnorePath = pathJoin(fileURLToPath(import.meta.url), "../", ".gitignore");

export default defineConfig([
  includeIgnoreFile(gitIgnorePath),
  ...tsEslint.configs.recommended,
  {
    files: filePatterns,
    ignores: ignoredPatterns,
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {...globals.node, ...globals.es2020, 'NodeJS': false},
    },
  }, {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
      "no-unused-private-class-members": "off",
    }
  },
]);
