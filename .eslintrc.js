module.exports = {
  root: true,
  extends: [
    // Full config: https://github.com/fregante/eslint-config-pixiebrix/blob/main/index.js
    "pixiebrix",
  ],
  rules: {
    // Incorrectly suggests to use `runtime.sendMessage` instead of `browser.runtime.sendMessage`
    "import/no-named-as-default-member": "off",

    // TODO: The rule is currently broken, it should accept `throw unknown` but doesn't
    "@typescript-eslint/no-throw-literal": "off",

    // TODO: Import extended config from app, after improving it
    "@typescript-eslint/naming-convention": "off",

    // The rule is unreasonably slow (90 sec lint -> 5 minutes)
    // https://github.com/pixiebrix/pixiebrix-extension/issues/1080
    "import/no-cycle": "off",

    // Rules that depend on https://github.com/pixiebrix/pixiebrix-extension/issues/775
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/restrict-template-expressions": "warn",
    "@typescript-eslint/no-unnecessary-type-assertion": "warn",

    // Rules to fix and enforce over time
    "no-await-in-loop": "warn",
    "unicorn/consistent-function-scoping": "warn", // Complains about some of the lifted functions
    "unicorn/no-await-expression-member": "warn", // Annoying sometimes, let's try it
    "@typescript-eslint/consistent-type-assertions": "warn",
  },
  ignorePatterns: [
    "node_modules",
    ".idea",
    "dist",
    "artifacts",
    "scripts/bin",
    "src/vendors",
    "src/types/swagger.ts",
    "src/nativeEditor/Overlay.tsx",
    "selenium",
  ],
  overrides: [
    {
      files: [
        "webpack.*.js",
        "*.config.js",
        "test-env.js",
        "**/__mocks__/**",
        "*.test.js",
      ],
      env: {
        node: true,
        jest: true,
      },
      extends: ["pixiebrix/server"],
      rules: {
        // TODO: Import extended config from app, after improving it
        "@typescript-eslint/naming-convention": "off",
      },
    },
    {
      files: ["*.stories.tsx", "**/__mocks__/**"],
      rules: {
        "filenames/match-exported": "off",
        "unicorn/filename-case": "off",
        "import/no-anonymous-default-export": "off",
      },
    },
  ],
};
