// Chrome MV3 can only register one worker file, so we cannot register "vendors.js" and "background.js" separately.
// Since "vendors.js" is a file generated by webpack and not a real module,
// this worker must be static and not pass through webpack.

self.importScripts(
  "./grayIconWhileLoading.js",
  "./vendors.js",
  "./background.js"
);
