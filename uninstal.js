const svc = require("./service")

svc.on('uninstall', function () {
    console.log('Uninstall complete.');
});

svc.uninstall();