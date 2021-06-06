/*
 * Copyright (C) 2020 Pixie Brix, LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WebExtensionTarget = require("webpack-target-webextension");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

const rootDir = path.resolve(__dirname, "../../");

const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(rootDir, "browsers", process.env.ENV_FILE ?? ".env"),
});

if (!process.env.SOURCE_VERSION) {
  process.env.SOURCE_VERSION = require("child_process")
    .execSync("git rev-parse --short HEAD")
    .toString()
    .trim();
}

const nodeConfig = {
  global: true,
};

module.exports = {
  context: rootDir,
  node: nodeConfig,
  output: {
    // https://github.com/crimx/webpack-target-webextension#usage
    globalObject: "window",
    chunkFilename: "bundles/[name].bundle.js",
  },
  entry: {
    background: path.resolve(rootDir, "src/background"),
    contentScript: path.resolve(rootDir, "src/contentScript"),
    devtools: path.resolve(rootDir, "src/devtools"),
    devtoolsPanel: path.resolve(rootDir, "src/devtoolsPanel"),
    // the script that gets injected into the host page
    script: path.resolve(rootDir, "src/script"),
    frame: path.resolve(rootDir, "src/frame"),
    options: path.resolve(rootDir, "src/options"),
    support: path.resolve(rootDir, "src/support"),
    action: path.resolve(rootDir, "src/action"),
  },
  resolve: {
    // Need to set these fields manually as their default values rely on `web` target.
    // See https://v4.webpack.js.org/configuration/resolve/#resolvemainfields
    mainFields: ["browser", "module", "main"],
    aliasFields: ["browser"],
    alias: {
      "@": path.resolve(rootDir, "src"),
      "@img": path.resolve(rootDir, "img"),
      "@contrib": path.resolve(rootDir, "contrib"),
      "@schemas": path.resolve(rootDir, "schemas"),
      vendors: path.resolve(rootDir, "src/vendors"),
      "@microsoft/applicationinsights-web": path.resolve(
        rootDir,
        "src/contrib/uipath/quietLogger"
      ),

      // An existence check triggers webpack’s warnings https://github.com/handlebars-lang/handlebars.js/issues/953
      handlebars: "handlebars/dist/handlebars.js",
    },
    fallback: {
      fs: false,
    },
    extensions: [".ts", ".tsx", ".jsx", ".js"],
  },

  // https://github.com/webpack/webpack/issues/3017#issuecomment-285954512
  // prevent lodash from overriding window._
  amd: false,

  optimization: {
    // Chrome bug https://bugs.chromium.org/p/chromium/issues/detail?id=1108199
    splitChunks: { automaticNameDelimiter: "-" },
  },

  // Silence new size limit warnings https://github.com/webpack/webpack/issues/3486#issuecomment-646997697
  performance: {
    maxEntrypointSize: 5120000,
    maxAssetSize: 5120000,
  },
  plugins: [
    new NodePolyfillPlugin(),
    new WebExtensionTarget(nodeConfig),
    // https://webpack.js.org/plugins/provide-plugin/
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery",
    }),
    new webpack.DefinePlugin({
      "process.env": {
        ROLLBAR_BROWSER_ACCESS_TOKEN: JSON.stringify(
          process.env.ROLLBAR_BROWSER_ACCESS_TOKEN
        ),
        SERVICE_URL: JSON.stringify(process.env.SERVICE_URL),
        SOURCE_VERSION: JSON.stringify(process.env.SOURCE_VERSION),
        NPM_PACKAGE_VERSION: JSON.stringify(process.env.npm_package_version),
        NODE_ENV: JSON.stringify(process.env.NODE_ENV),
        ENVIRONMENT: JSON.stringify(process.env.ENVIRONMENT),
        SUPPORT_WIDGET_ID: JSON.stringify(process.env.SUPPORT_WIDGET_ID),
      },
    }),
    new MiniCssExtractPlugin({
      chunkFilename: "css/[id].css",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.s?css$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          { loader: "sass-loader", options: { sourceMap: true } },
        ],
      },
      {
        test: /\.tsx?$/,
        use: [
          "babel-loader",
          { loader: "ts-loader?configFile=tsconfig.webpack.json" },
        ],
        exclude: /(node_modules|bower_components)/,
      },
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: ["babel-loader"],
      },
      {
        test: /\.(svg|png|jpg|gif)?$/,
        exclude: /(bootstrap-icons|simple-icons|custom-icons)/,
        type: "asset/resource",
        generator: {
          filename: "img/[name][ext]",
        },
      },
      {
        test: /(bootstrap-icons|simple-icons|custom-icons).*\.svg$/,
        loader: "svg-inline-loader",
      },
      {
        test: /\.(woff(2)?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
        exclude: /(bootstrap-icons|simple-icons)/,
        type: "asset/resource",
        generator: {
          filename: "fonts/[name][ext]",
        },
      },
      {
        test: /\.ya?ml$/,
        type: "json", // Required by Webpack v4
        use: "yaml-loader",
      },
    ],
  },
};
