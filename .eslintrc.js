const { readFileSync } = require("fs");
const { resolve } = require("path");

const restrictedZones = [
  "background",
  "contentScript",
  "pageEditor",
  "extensionConsole",
  "sidebar",
  "pageScript",
].map((exporter) => ({
  // All of these files cannot import `from` (exclude self-imports)
  target:
    exporter === "contentScript"
      ? `./src/!(${exporter}|bricks|starterBricks)/**/*` // Temporary: Bricks and starterBricks are implicitly run from CS
      : `./src/!(${exporter})/**/*`,

  // The files above cannot import `from` this folder
  from: `./src/${exporter}`,

  // These can be imported from anywhere
  except: [
    `../${exporter}/messenger`,
    `../${exporter}/types.ts`,
    // `../${exporter}/**/*Types.ts`, // TODO: Globs don't seem to work
    `../${exporter}/pageEditor/types.ts`,
    `../${exporter}/pageEditorTypes.ts`,
    `../${exporter}/runBlockTypes.ts`,
    `../${exporter}/extensionPoints/formStateTypes.ts`,
    `../${exporter}/tabs/editTab/dataPanel/dataPanelTypes.ts`,
  ],

  message: `Cross-context imports break expectations. Shared components should be in shared folders.
  Solution 1: Keep both importing and imported modules in the same context (shared or @/${exporter}).
  Solution 2: Use the Messenger if they are in the correct context.
  Solution 3: Propose a clearly-shared component within the context, like we do for Messenger and *Types files.`,
}));

module.exports = {
  root: true,
  extends: [
    // Full config: https://github.com/pixiebrix/eslint-config-pixiebrix/blob/main/index.js
    "pixiebrix",
  ],
  plugins: ["local-rules", "@shopify"],
  rules: {
    "@shopify/react-hooks-strict-return": "error",
    "@shopify/prefer-module-scope-constants": "error",
    "@shopify/jest/no-snapshots": "warn",
    "local-rules/noNullRtkQueryArgs": "error",
    "local-rules/noInvalidDataTestId": "error",
    "local-rules/noExpressionLiterals": "error",
    "local-rules/notBothLabelAndLockableProps": "error",
    "local-rules/preferNullish": "warn",
    "local-rules/preferNullishable": "warn",
    "import/no-restricted-paths": [
      "warn",
      {
        zones: restrictedZones,
      },
    ],

    // Avoid imports with side effects
    "import/no-unassigned-import": [
      "error",
      {
        allow: [
          "**/*.css",
          "**/*.scss",
          "@/development/*",
          "@/background/messenger/external/api",
          "@/extensionContext", // Must be run before other code
          "@/background/axiosFetch", // Must be run before other code
          "@/telemetry/reportUncaughtErrors",
          "@testing-library/jest-dom",
          "regenerator-runtime/runtime", // Automatic registration
          "@/vendors/hoverintent", // JQuery plugin
          "iframe-resizer/js/iframeResizer.contentWindow", // vendor library imported for side-effect
        ],
      },
    ],
    // TODO: Gradually fix and then drop https://github.com/pixiebrix/eslint-config-pixiebrix/pull/150
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-return": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.property.name='allSettled']",
        message:
          'For safety and convenience, use this instead: import { allSettled } from "@/utils/promiseUtils";',
      },
      {
        message:
          "Bootstrap columns should not be used if there's a single column. Use a plain `div` or drop the wrapper altogether if not needed. You might also consider using one of the classes 'max-550', 'max-750', or 'max-950' to limit the width of the body.",
        selector:
          "JSXElement[openingElement.name.name='Row'] > JSXText:first-child + JSXElement:nth-last-child(2)",
      },
      {
        message:
          "Use the `uuid` module instead because crypto.randomUUID is not available in http: contexts",
        selector: 'MemberExpression > Identifier[name="randomUUID"]',
      },
      {
        message:
          'Use `getExtensionConsoleUrl` instead of `browser.runtime.getURL("options.html")` because it automatically handles paths/routes',
        selector:
          "CallExpression[callee.object.property.name='runtime'][callee.property.name='getURL'][arguments.0.value='options.html']",
      },
      {
        message: "Use `jest.mocked(fn)` instead of `fn as jest.Mock`.",
        selector: "TSAsExpression TSQualifiedName[right.name='Mock']",
      },
      {
        message:
          "Use `jest.mocked(fn)` instead of `fn as jest.MockedFunction`.",
        selector: "TSAsExpression TSQualifiedName[right.name='MockedFunction']",
      },
      {
        message:
          "Unless the code is using .then(), calling `.mockResolvedValue(undefined)` is the same as leaving it out",
        selector:
          "CallExpression[callee.property.name='mockResolvedValue'][arguments.0.name='undefined'][arguments.0.type='Identifier']",
      },
      // NOTE: If you add more rules, add the tests to eslint-local-rules/noRestrictedSyntax.ts
    ],

    // Rules that depend on https://github.com/pixiebrix/pixiebrix-extension/issues/775
    "@typescript-eslint/restrict-template-expressions": "warn",
  },
  overrides: [
    {
      files: ["webpack.*.js", "*.config.js", "scripts/*"],
      // Full config: https://github.com/pixiebrix/eslint-config-pixiebrix/blob/main/development.js
      extends: ["pixiebrix/development"],
      rules: {
        "import/no-restricted-paths": "off",
      },
    },
    {
      files: [
        "*/scripts/*",
        "**/__mocks__/**",
        "**/testUtils/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/testHelpers.*",
        "**/*.stories.tsx",
      ],
      // Full config: https://github.com/pixiebrix/eslint-config-pixiebrix/blob/main/tests.js
      extends: ["pixiebrix/development", "pixiebrix/tests"],
      rules: {
        "unicorn/prefer-spread": "off",
      },
    },
    {
      files: [
        "./src/background/**",
        ...readFileSync(
          resolve(__dirname, "eslint-local-rules/persistBackgroundData.txt"),
          "utf8",
        )
          .split("\n")
          .filter((line) => line.startsWith("./src/")),
      ],
      excludedFiles: ["**/*.test.*", "**/api.ts"],
      rules: {
        "local-rules/persistBackgroundData": "error",
      },
    },
    {
      // Settings for regular ts files that should only apply to react component rests
      files: ["**/!(*.test)*.ts?(x)", "**/*.ts"],
      rules: {
        "testing-library/render-result-naming-convention": "off",
        "testing-library/no-await-sync-queries": "off",
      },
    },
    {
      // These rules should not be enabled for JS files
      files: ["*.js", "*.mjs", "*.cjs"],
      rules: {
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-return": "off",
      },
    },
  ],
};

// `npm run lint:fast` will skip the (slow) import/* rules
// Useful if you're trying to iterate fixes over other rules
if (process.env.ESLINT_NO_IMPORTS) {
  const importRules = Object.keys(require("eslint-plugin-import").rules);
  for (const ruleName of importRules) {
    module.exports.rules[`import/${ruleName}`] = "off";
  }
}
