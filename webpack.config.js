/*
 * Copyright (C) 2022 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const path = require("path");
const dotenv = require("dotenv");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WebExtensionTarget = require("webpack-target-webextension");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const WebpackBuildNotifierPlugin = require("webpack-build-notifier");
const TerserPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const CopyPlugin = require("copy-webpack-plugin");
const { uniq, compact, pull } = require("lodash");
const Policy = require("csp-parse");
const mergeWithShared = require("./webpack.sharedConfig.js");

function parseEnv(value) {
  switch (String(value).toLowerCase()) {
    case "undefined":
      return;
    case "null":
      return null;
    case "false":
      return false;
    case "true":
      return true;
    case "":
      return "";
    default:
  }

  return Number.isNaN(Number(value)) ? value : Number(value);
}

// Default ENVs used by webpack
// Note: Default ENVs used by the extension itself should be set in EnvironmentPlugin
const defaults = {
  DEV_NOTIFY: "true",
  DEV_SLIM: "false",
  DEV_REDUX_LOGGER: "true",
  CHROME_EXTENSION_ID: "mpjjildhmpddojocokjkgmlkkkfjnepo",

  // PixieBrix URL to enable connection to for credential exchange
  SERVICE_URL: "https://app.pixiebrix.com",
};

dotenv.config({
  path: process.env.ENV_FILE ?? ".env",
});

for (const [env, defaultValue] of Object.entries(defaults)) {
  if (!process.env[env] || parseEnv(process.env[env]) == null) {
    process.env[env] = defaultValue;
  }
}

console.log("SOURCE_VERSION:", process.env.SOURCE_VERSION);
console.log("SERVICE_URL:", process.env.SERVICE_URL);
console.log("CHROME_EXTENSION_ID:", process.env.CHROME_EXTENSION_ID);
console.log(
  "ROLLBAR_BROWSER_ACCESS_TOKEN:",
  process.env.ROLLBAR_BROWSER_ACCESS_TOKEN
);

if (!process.env.SOURCE_VERSION) {
  process.env.SOURCE_VERSION = require("child_process")
    .execSync("git rev-parse --short HEAD")
    .toString()
    .trim();
}

// Configure sourcemaps
// Disable sourcemaps on CI unless it's a PUBLIC_RELEASE
const produceSourcemap =
  !parseEnv(process.env.CI) || parseEnv(process.env.PUBLIC_RELEASE);

const sourceMapPublicUrl =
  parseEnv(process.env.PUBLIC_RELEASE) &&
  `${process.env.SOURCE_MAP_URL_BASE}/${process.env.SOURCE_MAP_PATH}/`;
console.log(
  "Sourcemaps:",
  sourceMapPublicUrl ? sourceMapPublicUrl : produceSourcemap ? "Local" : "No"
);

function getVersion() {
  // `manifest.json` only supports numbers in the version, so use the semver
  const match = /^(?<version>\d+\.\d+\.\d+)/.exec(
    process.env.npm_package_version
  );
  return match.groups.version;
}

function getVersionName(isProduction) {
  if (process.env.ENVIRONMENT === "staging") {
    // Staging builds (i.e., from CI) are production builds, so check ENVIRONMENT first
    return `${getVersion()}-alpha+${process.env.SOURCE_VERSION}`;
  }

  if (isProduction) {
    return process.env.npm_package_version;
  }

  return `${process.env.npm_package_version}-local+${new Date().toISOString()}`;
}

const isProd = (options) => options.mode === "production";

/**
 * @param {chrome.runtime.Manifest} manifest
 */
function updateManifestToV3(manifest) {
  manifest.manifest_version = 3;

  // Extract host permissions
  pull(manifest.permissions, "https://*.pixiebrix.com/*");
  pull(manifest.optional_permissions, "*://*/*");
  manifest.host_permissions = ["https://*.pixiebrix.com/*", "*://*/*"];
  manifest.permissions.push("scripting");

  // Update format
  manifest.web_accessible_resources = [
    {
      resources: manifest.web_accessible_resources,
      matches: ["*://*/*"],
    },
  ];

  // Rename keys
  manifest.action = manifest.browser_action;
  delete manifest.browser_action;

  // Update CSP format and drop invalid values
  const policy = new Policy(manifest.content_security_policy);
  policy.remove("script-src", "https://apis.google.com");
  policy.remove("script-src", "'unsafe-eval'");
  manifest.content_security_policy = {
    extension_pages: policy.toString(),

    // Set the native default CSP
    // https://developer.chrome.com/docs/extensions/mv3/manifest/sandbox/
    sandbox:
      "sandbox allow-scripts allow-forms allow-popups allow-modals; script-src 'self' 'unsafe-inline' 'unsafe-eval'; child-src 'self';",
  };

  // Replace background script
  manifest.background = {
    service_worker: "background.worker.js",
  };
}

function customizeManifest(manifest, isProduction) {
  manifest.version = getVersion();
  manifest.version_name = getVersionName(isProduction);

  if (!isProduction) {
    manifest.name = "PixieBrix - Development";
  }

  if (process.env.CHROME_MANIFEST_KEY) {
    manifest.key = process.env.CHROME_MANIFEST_KEY;
  }

  const internal = isProduction
    ? []
    : // The port is part of the origin: https://developer.mozilla.org/en-US/docs/Web/API/URL/origin
      [
        "http://127.0.0.1:8000/*",
        "http://127.0.0.1/*",
        "http://localhost/*",
        "http://localhost:8000/*",
      ];

  const policy = new Policy(manifest.content_security_policy);

  policy.add("connect-src", process.env.SERVICE_URL);

  if (!isProduction) {
    // React Dev Tools app. See https://github.com/pixiebrix/pixiebrix-extension/wiki/Development-commands#react-dev-tools
    policy.add("script-src", "http://localhost:8097");
    policy.add("connect-src", "ws://localhost:8097/");
    policy.add("img-src", "https://pixiebrix-marketplace-dev.s3.amazonaws.com");
  }

  manifest.content_security_policy = policy.toString();

  if (process.env.EXTERNALLY_CONNECTABLE) {
    manifest.externally_connectable.matches = uniq([
      ...manifest.externally_connectable.matches,
      ...process.env.EXTERNALLY_CONNECTABLE.split(","),
    ]);
  }

  manifest.content_scripts[0].matches = uniq([
    new URL("*", process.env.SERVICE_URL).href,
    ...manifest.content_scripts[0].matches,
    ...internal,
  ]);

  manifest.externally_connectable.matches = uniq([
    ...manifest.externally_connectable.matches,
    ...internal,
  ]);

  if (process.env.GOOGLE_OAUTH_CLIENT_ID) {
    manifest.oauth2 = {
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      // Don't ask for any scopes up front, instead ask when they're required, e.g., when the user
      // installs a brick for google sheets
      scopes: [""],
    };
  }
}

function mockHeavyDependencies() {
  if (process.env.DEV_SLIM.toLowerCase() === "true") {
    console.warn(
      "Mocking dependencies for development build: @/icons/list, uipath/robot"
    );
    return {
      "@/icons/list": path.resolve("src/__mocks__/@/icons/list"),
      "@uipath/robot": path.resolve("src/__mocks__/@uipath/robot"),
    };
  }
}

module.exports = (env, options) =>
  mergeWithShared({
    node: {
      global: true,
    },

    // Don't use `eval` maps https://stackoverflow.com/a/57460886/402560
    // Explicitly handled by `SourceMapDevToolPlugin` below
    devtool: false,

    output: {
      path: path.resolve("dist"),
      chunkFilename: "bundles/[name].bundle.js",
      environment: {
        dynamicImport: true,
      },
    },

    entry: Object.fromEntries(
      [
        "background/background",
        "contentScript/contentScript",
        "contentScript/browserActionInstantHandler",
        "pageEditor/pageEditor",
        "options/options",
        "sidebar/sidebar",
        "sandbox/sandbox",

        "tinyPages/ephemeralForm",
        "tinyPages/permissionsPopup",

        // Tiny files without imports
        "tinyPages/frame",
        "tinyPages/alert",
        "tinyPages/devtools",

        // The script that gets injected into the host page
        "pageScript/pageScript",
      ].map((name) => [path.basename(name), `./src/${name}`])
    ),

    resolve: {
      alias: {
        ...mockHeavyDependencies(),

        ...(isProd(options) || process.env.DEV_REDUX_LOGGER === "false"
          ? { "redux-logger": false }
          : {}),
      },
    },

    optimization: {
      // Module concatenation mangles class names https://github.com/pixiebrix/pixiebrix-extension/issues/4763
      concatenateModules: false,

      // Chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=1108199
      splitChunks: {
        automaticNameDelimiter: "-",
        cacheGroups: {
          vendors: false,
        },
      },

      minimizer: [
        new TerserPlugin({
          parallel: true,
          terserOptions: {
            // https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions
            // Keep error classnames because we perform name comparison (see selectSpecificError)
            keep_classnames: /.*Error/,
          },
        }),
        new CssMinimizerPlugin(),
      ],
    },

    performance: {
      // Silence warnings because the size includes the sourcemaps
      maxEntrypointSize: 15_120_000,
      maxAssetSize: 15_120_000,
    },
    plugins: compact([
      produceSourcemap &&
        new webpack.SourceMapDevToolPlugin({
          publicPath: sourceMapPublicUrl,

          // The sourcemap will be inlined if `undefined`. Only inlined sourcemaps work locally
          // https://bugs.chromium.org/p/chromium/issues/detail?id=974543
          filename: sourceMapPublicUrl && "[file].map[query]",
        }),

      // Only notifies when watching. `zsh-notify` is suggested for the `build` script
      options.watch &&
        process.env.DEV_NOTIFY !== "false" &&
        new WebpackBuildNotifierPlugin({
          title: "PB Extension",
          showDuration: true,
        }),

      isProd(options) &&
        new BundleAnalyzerPlugin({
          analyzerMode: "static",
          reportFilename: path.resolve("report.html"),
          excludeAssets: /svg-icons/,
        }),

      new NodePolyfillPlugin({
        // Specify the least amount of polyfills because by default it event polyfills `console`
        includeAliases: ["buffer", "Buffer", "http", "https"],
      }),
      new WebExtensionTarget({
        weakRuntimeCheck: true,
      }),
      new webpack.ProvidePlugin({
        $: "jquery",
        jQuery: "jquery",
        browser: "webextension-polyfill",
        process: path.resolve("src/vendors/process.js"),
      }),

      // This will inject the current ENVs into the bundle, if found
      new webpack.EnvironmentPlugin({
        // If not found, these values will be used as defaults
        DEBUG: !isProd(options),
        NODE_DEBUG: false,
        REDUX_DEV_TOOLS: !isProd(options),
        NPM_PACKAGE_VERSION: process.env.npm_package_version,
        ENVIRONMENT: options.mode,
        WEBEXT_MESSENGER_LOGGING: "false",
        ROLLBAR_PUBLIC_PATH: sourceMapPublicUrl ?? "extension://dynamichost/",
        // Record telemetry events in development?
        DEV_EVENT_TELEMETRY: false,

        // If not found, "undefined" will cause the build to fail
        SERVICE_URL: undefined,
        SOURCE_VERSION: undefined,
        CHROME_EXTENSION_ID: undefined,

        // If not found, "null" will leave the ENV unset in the bundle
        ROLLBAR_BROWSER_ACCESS_TOKEN: null,
        GOOGLE_API_KEY: null,
        GOOGLE_APP_ID: null,
      }),

      new MiniCssExtractPlugin({
        chunkFilename: "css/[id].css",
      }),
      new CopyPlugin({
        patterns: [
          {
            from: "src/manifest.json",
            transform(jsonString) {
              const manifest = JSON.parse(jsonString);
              customizeManifest(manifest, isProd(options));
              if (process.env.MV === "3") {
                updateManifestToV3(manifest);
              }

              return JSON.stringify(manifest, null, 4);
            },
          },
          {
            from: "src/*/*.html", // Only one level deep
            to: "[name][ext]", // Flat output, no subfolders
          },
          "static",
        ],
      }),
    ]),
    module: {
      rules: [
        {
          test: /\.s?css$/,
          resourceQuery: { not: [/loadAsUrl/] },
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
        {
          test: /\.scss$/,
          use: [
            {
              loader: "sass-loader",
              options: {
                // Due to warnings in dart-sass https://github.com/pixiebrix/pixiebrix-extension/pull/1070
                implementation: require("node-sass"),
                // The aliases ("@") don't work here
                additionalData:
                  '@import "src/vendors/theme/assets/styles/_colors";',
              },
            },
          ],
        },
      ],
    },
  });
