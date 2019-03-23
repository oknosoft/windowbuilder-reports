/**
 * быстрый поиск заказов
 *
 * @module index
 *
 * Created by Evgeniy Malyarov on 29.09.2018.
 */

const auth = require('../auth');

function json(ctx) {
  return new Promise((resolve, reject) => {
    let rawData = '';
    ctx.req.on('data', (chunk) => { rawData += chunk; });
    ctx.req.on('end', () => {
      try {
        resolve(ctx._json = JSON.parse(rawData));
      }
      catch (err) {
        ctx.status = 500;
        ctx.body = err.message;
        reject(err);
      }
    });
  });
}



module.exports = function($p, runtime) {

  const log = require('../logger')(runtime);
  // const indexer = require('./indexer')($p);
  // $p.adapters.pouch.on('indexer_page', (page) => {
  //   log(`indexed ${page.indexer._count} ${page.bookmark.substr(10, 30)}`);
  // });

  return async (ctx, next) => {

    // проверяем ограничение по ip и авторизацию
    await auth(ctx, $p)
      .then(() => json(ctx))
      .catch(() => null);

    if(ctx._json && ctx._auth) {
      try{
        ctx.body = await $p.accumulation.find(ctx._json, ctx._auth);
        ctx.status = 200;
      }
      catch(err){
        ctx.status = err.status || 500;
        ctx.body = err.message;
        console.error(err);
      }
    }

  }
}
