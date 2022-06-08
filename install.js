const svc = require("./service")

svc.on('install', function () {
    svc.start();
});

svc.install();