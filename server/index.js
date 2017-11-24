'use strict';

const Koa = require('koa');
const app = new Koa();

// Register the router as Koa middleware
import rep from './router';
app.use(rep.middleware());

app.listen(process.env.PORT || 3000);
app.restrict_ips = process.env.IPS ? process.env.IPS.split(',') : [];

export default app;
