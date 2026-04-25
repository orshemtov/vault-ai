import js from "@eslint/js";
import obsidianmdModule from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

const obsidianmd = obsidianmdModule.default ?? obsidianmdModule;

export default [
  {
    ignores: [
      "main.js",
      "node_modules",
      "coverage",
      "eslint.config.mjs",
      ".github/**",
      "package-lock.json",
      "package.json",
      "manifest.json",
      "versions.json",
      "esbuild.config.mjs",
      "spec/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      obsidianmd
    },
    rules: {
      ...tseslint.configs.recommendedTypeChecked[1].rules,
      "obsidianmd/commands/no-plugin-name-in-command-name": "error",
      "obsidianmd/detach-leaves": "error",
      "obsidianmd/settings-tab/no-manual-html-headings": "error",
      "obsidianmd/settings-tab/no-problematic-settings-headings": "error",
      "obsidianmd/ui/sentence-case": ["error", { enforceCamelCaseLower: true }],
      "no-unused-vars": "off",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: true,
            attributes: false,
            inheritedMethods: true,
            properties: true,
            returns: true,
            variables: true
          }
        }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/require-await": "error"
    }
  }
];
