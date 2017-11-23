#!/usr/bin/env node

'use strict';

import Koa from 'koa';
const app = new Koa();

// Register the router as Koa middleware
import rep from './server/router';
app.use(rep.middleware());

app.listen(process.env.PORT || 3000);
app.restrict_ips = process.env.IPS ? process.env.IPS.split(',') : [];

export default app;
