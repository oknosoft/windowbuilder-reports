/**
 * поиск заказов - эмулируем pouchdb._find
 *
 * @module calc_order
 *
 * Created by Evgeniy Malyarov on 29.09.2018.
 */

import indexer from './indexer';

export default async (ctx, next) => {
  indexer.some(0, 1000, (row) => {

  });
}
