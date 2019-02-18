'use strict';

module.exports = function (runtime) {

  const {executer, $p} = require('./builder')(runtime);
  const search  = require('./search')($p, runtime);

  const Router = require('koa-better-router');
  const rep = Router({prefix: '/r'});

  rep.loadMethods()
    .get('/', async (ctx, next) => {
      await next();
      ctx.body = `Reports: try out <a href="/r/img">/r/img</a> too`
    })
    .get('/img/:class/:ref', executer)
    .post('/_find', search);

  return rep;

}
