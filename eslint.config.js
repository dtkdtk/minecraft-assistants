import js from "@eslint/js";
import globals from "globals";
import tsEslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { includeIgnoreFile } from "@eslint/compat";
import { fileURLToPath } from "node:url";

const filePattern = "{lib,exe}/**/*.{js,mjs,cjs,ts,mts,cts}";

export default defineConfig([
  includeIgnoreFile(fileURLToPath(new URL(".gitignore", import.meta.url))),
  tsEslint.configs.recommended,
  {
    files: [filePattern],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
    }
  },
  {
    files: [filePattern],
    languageOptions: {
      globals: globals.es2020
    }
  },
  {
    files: [filePattern],
    languageOptions: {
      globals: {
        'NodeJS': false,
      }
    }
  },
]);
