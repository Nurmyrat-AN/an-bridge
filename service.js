const Service = require('node-windows').Service;


const svc = new Service({
    name: 'aish-bridge',
    description: 'Aish datas bridge into remote and local servers.',
    script: '.',
    nodeOptions: []
});


module.exports = svc