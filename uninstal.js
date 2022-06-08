import { svc } from "./service";

svc.on('uninstall', function () {
    console.log('Uninstall complete.');
});

svc.uninstall();