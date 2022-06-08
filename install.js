import { svc } from "./service";

svc.on('install', function () {
    svc.start();
});

svc.install();