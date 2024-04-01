/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

import Policy from "csp-parse";
import { normalizeManifestPermissions } from "webext-permissions";
import { excludeDuplicatePatterns } from "webext-patterns";

function getVersion(env) {
  // `manifest.json` only supports numbers in the version, so use the semver
  const match = /^(?<version>\d+\.\d+\.\d+)/.exec(env.npm_package_version);
  return match.groups.version;
}

function getVersionName(env, isProduction) {
  const mv3 = env.MV === "3" ? "-mv3" : "";
  if (env.ENVIRONMENT === "staging") {
    // Staging builds (i.e., from CI) are production builds, so check ENVIRONMENT first
    return `${getVersion(env)}${mv3}-alpha+${env.SOURCE_VERSION}`;
  }

  if (isProduction) {
    return `${env.npm_package_version}${mv3}`;
  }

  return `${env.npm_package_version}${mv3}-local+${new Date().toISOString()}`;
}

/**
 * @param {chrome.runtime.ManifestV2} manifestV2
 * @returns chrome.runtime.ManifestV3
 */
function updateManifestToV3(manifestV2) {
  const manifest = structuredClone(manifestV2);
  manifest.manifest_version = 3;

  // Extract host permissions
  const { permissions, origins } = normalizeManifestPermissions(manifest);
  manifest.permissions = [...permissions, "scripting"];
  manifest.host_permissions = origins;
  // Sidebar Panel open() is only available in Chrome 116+
  // https://developer.chrome.com/docs/extensions/reference/api/sidePanel#method-open
  manifest.minimum_chrome_version = "116.0";

  // Add sidePanel
  manifest.permissions.push("sidePanel");

  manifest.side_panel = {
    default_path: "sidebar.html",
  };

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

    // https://developer.chrome.com/docs/extensions/mv3/manifest/sandbox/
    sandbox:
      "sandbox allow-scripts allow-forms; script-src 'self' 'unsafe-inline' 'unsafe-eval'; child-src 'self';",
  };

  // Replace background script
  manifest.background = {
    service_worker: "background.worker.js",
    type: "module",
  };

  return manifest;
}

/**
 * Add internal URLs to the content scripts targeting the Admin Console so the Extension can talk to
 * a locally running Admin Console during development.
 *
 * @param {chrome.runtime.Manifest} manifest
 * @param {string[]} internal
 */
function addInternalUrlsToContentScripts(manifest, internal) {
  const ADMIN_CONSOLE_MATCH_PATTERN = "https://*.pixiebrix.com/*";

  for (const [index, contentScript] of Object.entries(
    manifest.content_scripts,
  )) {
    if (contentScript.matches.includes(ADMIN_CONSOLE_MATCH_PATTERN)) {
      manifest.content_scripts[index].matches = excludeDuplicatePatterns([
        ...contentScript.matches,
        ...internal,
      ]);
    }
  }
}

/**
 * @param {chrome.runtime.ManifestV2} manifestV2
 * @returns chrome.runtime.Manifest
 */
function customizeManifest(manifestV2, options = {}) {
  const { isProduction, manifestVersion, env = {} } = options;
  const manifest = structuredClone(manifestV2);
  manifest.version = getVersion(env);
  manifest.version_name = getVersionName(env, isProduction);

  if (!isProduction) {
    manifest.name = "PixieBrix - Development";
  }

  if (env.CHROME_MANIFEST_KEY) {
    manifest.key = env.CHROME_MANIFEST_KEY;
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

  if (!isProduction) {
    policy.add("img-src", "https://pixiebrix-marketplace-dev.s3.amazonaws.com");

    // React Dev Tools app. See https://github.com/pixiebrix/pixiebrix-extension/wiki/Development-commands#react-dev-tools
    policy.add("script-src", "http://localhost:8097");
    policy.add("connect-src", "ws://localhost:8097/");

    // React Refresh (HMR)
    policy.add("connect-src", "ws://127.0.0.1:8080/");
    policy.add("connect-src", "ws://127.0.0.1/");
  }

  manifest.content_security_policy = policy.toString();

  const externallyConnectable = [
    ...manifest.externally_connectable.matches,
    ...(env.EXTERNALLY_CONNECTABLE?.split(",") ?? []),
    ...internal,
  ];

  manifest.externally_connectable.matches = excludeDuplicatePatterns(
    externallyConnectable,
  );

  addInternalUrlsToContentScripts(manifest, internal);

  // HMR support
  if (!isProduction) {
    manifest.web_accessible_resources.push("*.json");
  }

  // Playwright does not support dynamically accepting permissions for extensions, so we need to add all permissions
  // to the manifest. This is only necessary for Playwright tests.
  if (env.REQUIRE_OPTIONAL_PERMISSIONS_IN_MANIFEST) {
    manifest.permissions.push(...manifest.optional_permissions);
  }

  if (manifestVersion === 3) {
    return updateManifestToV3(manifest);
  }

  return manifest;
}

export default customizeManifest;
