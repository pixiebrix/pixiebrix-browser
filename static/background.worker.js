// Don't include `background.worker.js` in webpack, there's no advantage in doing so
self.importScripts("./grayIconWhileLoading.js", "vendor.js", "./background.js");
