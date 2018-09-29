/**
 * Формирует кещ первого уровня - по датам
 *
 * @module indexer
 *
 * Created by Evgeniy Malyarov on 29.09.2018.
 */

const debug = require('debug')('wb:indexer');

import $p from '../metadata';

const {adapters: {pouch}, doc: {calc_order}} = $p;
const fields = [
  '_id',
  'state',
  'posted',
  'date',
  'number_doc',
  'number_internal',
  'partner',
  'client_of_dealer',
  'doc_amount',
  'obj_delivery_state',
  'department',
  'note'];

const indexer = {

  by_date: new Map(),

  _count: 0,

  // помещает документ в кеш
  put(indoc) {
    const doc = {};
    fields.forEach((fld) => doc[fld] = indoc[fld]);
    const date = parseInt(doc.date.substr(0,7).replace('-', ''), 10);
    if(indexer.by_date.has(date)) {
      const arr = indexer.by_date.get(date);
      if(!arr.some((row) => {
        if(row._id === doc._id) {
          Object.assign(row, doc);
          return true;
        }
      })){
        arr.push(doc);
      }
    }
    else {
      indexer.by_date.set(date, [doc]);
    }
  },

  // перебирает кеш в диапазоне дат
  find(selector) {
    return [];
  },

  // формирует начальный дамп
  init(bookmark) {

    if(!bookmark) {
      calc_order.on('change', indexer.put);
      debug('start');
    }

    pouch.remote.doc.find({
      selector: {
        class_name: calc_order.class_name,
      },
      fields,
      bookmark,
      limit: 10000,
    })
      .then(({bookmark, docs}) => {
        indexer._count += docs.length;
        for(const doc of docs) {
          doc.state !== 'template' && indexer.put(doc);
        }
        debug(`indexed ${indexer._count} ${bookmark.substr(0, 30)}`);
        docs.length === 10000 && indexer.init(bookmark);
      });
  },

};

pouch.on('pouch_complete_loaded', indexer.init);

export default indexer;
