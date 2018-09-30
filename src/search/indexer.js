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
const search_fields = ['number_doc', 'client_of_dealer', 'note'];

const indexer = {

  by_date: {},

  _count: 0,

  // помещает документ в кеш
  put(indoc) {
    const doc = {};
    fields.forEach((fld) => {
      if(indoc.hasOwnProperty(fld)) {
        doc[fld] = indoc[fld];
      }
    });
    const date = doc.date.substr(0,7);
    const arr = indexer.by_date[date]
    if(arr) {
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
      indexer.by_date[date] = [doc];
    }
  },

  get(from, till, step) {
    if(step) {
      let [year, month] = from.split('-');
      month = parseInt(month, 10) + step;
      while (month > 12) {
        year = parseInt(year, 10) + 1;
        month -= 12;
      }
      from = `${year}-${month.pad(2)}`;
    }
    if(from > till) {
      return null;
    }
    let res = indexer.by_date[from];
    if(!res) {
      res = [];
    }
    return res;
  },

  // перебирает кеш в диапазоне дат
  find({selector, limit, skip = 0}) {
    let dfrom, dtill, from, till, search;
    for(const row of selector.$and) {
      const fld = Object.keys(row)[0];
      const cond = Object.keys(row[fld])[0];
      if(fld === 'date') {
        if(cond === '$lt' || cond === '$lte') {
          dtill = row[fld][cond];
          till = dtill.substr(0,7);
        }
        else if(cond === '$gt' || cond === '$gte') {
          dfrom = row[fld][cond];
          from = dfrom.substr(0,7);
        }
      }
      else if(fld === 'search') {
        search = row[fld][cond].toLowerCase().split(' ');
      }
    }

    let part, step = 0;
    const res = [];
    function add(doc) {
      if(skip > 0) {
        skip--;
        return true;
      }
      if(limit > 0) {
        limit--;
        res.push(doc);
        return true;
      }
    }

    // получаем очередной кусочек кеша
    while(part = indexer.get(from, till, step)) {
      step += 1;
      // фильтруем
      for(const doc of part) {

        // фильтруем по дате
        if(doc.date < dfrom || doc.date > dtill) {
          continue;
        }

        // фильтруем по строке
        let ok = true;
        for(const word of search) {
          if(!word) {
            continue;
          }
          if(!search_fields.some((fld) => doc[fld] && doc[fld].toLowerCase().includes(word))){
            ok = false;
            break;
          }
        }

        if(ok && !add(doc)) {
          return res;
        }
      }
    }

    return res;
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
