'use strict';

// Koa http server
const Koa = require('koa');

// Register the cors as Koa middleware
const cors = require('@koa/cors');

module.exports = function (runtime) {

  // Logger
  const log = require('./logger')(runtime);

  const conf = require('../config/app.settings')()

  // Cluster
  if(runtime && runtime.cluster) {
    // monitors controllable shutdown
    // and starts shutdown proc
    process.on('message', function (msg) {
      log(`Worker received ${msg.event} event`);
      if(msg && msg.event == 'shutdown') runtime.cluster.worker.kill();
    });

    process.on('unhandledRejection', error => {
      // Will print "unhandledRejection err is not defined"
      console.log('unhandledRejection', error.message);
    });
  }

  // экземпляр Koa-приложения
  const app = new Koa();

  // Register the cors as Koa middleware
  app.use(cors({credentials: true, maxAge: 600}));

  // Register the router as Koa middleware
  const rep = require('./router')(runtime);
  app.use(rep.middleware());

  app.listen(conf.server.port);
  app.restrict_ips = process.env.IPS ? process.env.IPS.split(',') : [];
}
