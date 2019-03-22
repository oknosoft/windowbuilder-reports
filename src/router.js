'use strict';

module.exports = function (runtime) {

  const {executer, $p} = require('./windowbuilder')(runtime);
  const search  = require('./search')($p, runtime);
  const acc_get  = require('./accumulation/get')($p, runtime);
  const acc_post  = require('./accumulation/post')($p, runtime);
  const acc_delete  = require('./accumulation/delete')($p, runtime);

  const Router = require('koa-better-router');
  const rep = Router({prefix: '/r'});

  rep.loadMethods()
    .get('/', async (ctx, next) => {
      await next();
      ctx.body = `Reports: try out <a href="/r/img">/r/img</a> too`
    })
    .get('/img/:class/:ref', executer)
    .get('/postgres/:db', acc_get)
    .get('/postgres/:db/:path', acc_get)
    .post('/postgres/:db/:path', acc_post)
    .post('/_find', search)
    .delete('/postgres/:db', acc_delete)
    .delete('/postgres/:db/:path', acc_delete);

  return rep;

}
