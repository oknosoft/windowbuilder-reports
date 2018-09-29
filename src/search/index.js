/**
 * быстрый поиск заказов
 *
 * @module index
 *
 * Created by Evgeniy Malyarov on 29.09.2018.
 */

import calc_order from './calc_order';

export default async (ctx, next) => {

  // если указано ограничение по ip - проверяем
  // const {restrict_ips} = ctx.app;
  // const ip = ctx.req.headers['x-real-ip'] || ctx.ip;
  // if(restrict_ips.length && restrict_ips.indexOf(ip) == -1){
  //   ctx.status = 403;
  //   ctx.body = 'ip restricted: ' + ip;
  //   return;
  // }

  // проверяем авторизацию
  // let {authorization, suffix} = ctx.req.headers;
  // if(!authorization || !suffix){
  //   ctx.status = 403;
  //   ctx.body = 'access denied';
  //   return;
  // }

  //console.log(ctx.params);

  try{
    return await calc_order(ctx, next);
  }
  catch(err){
    ctx.status = 500;
    ctx.body = err.stack;
    console.error(err);
  }
}
