/**
 * Формирует кещ первого уровня - по датам
 *
 * @module indexer
 *
 * Created by Evgeniy Malyarov on 29.09.2018.
 */

const debug = require('debug')('wb:indexer');

import $p from '../metadata';

const {adapters: {pouch}, doc: {calc_order}, utils} = $p;
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
const search_fields = ['number_doc', 'number_internal', 'client_of_dealer', 'note'];

const indexer = {

  // кеш по дате
  by_date: {},

  _count: 0,

  _ready: false,

  // компаратор сортировки
  sort_fn(a, b) {
    if (a.date < b.date){
      return -1;
    }
    else if (a.date > b.date){
      return 1;
    }
    else{
      return 0;
    }
  },

  // сортирует кеш
  sort() {
    debug('sorting');
    for(const date in indexer.by_date) {
      indexer.by_date[date].sort(indexer.sort_fn);
    }
    indexer._ready = true;
    debug('ready');
  },

  // помещает документ в кеш
  put(indoc, force) {
    const doc = {};
    fields.forEach((fld) => {
      if(indoc.hasOwnProperty(fld)) {
        doc[fld] = indoc[fld];
      }
    });
    const date = doc.date.substr(0,7);
    const arr = indexer.by_date[date];
    if(arr) {
      if(force || !arr.some((row) => {
        if(row._id === doc._id) {
          Object.assign(row, doc);
          return true;
        }
      })){
        arr.push(doc);
        !force && arr.sort(indexer.sort_fn);
      }
    }
    else {
      indexer.by_date[date] = [doc];
    }
  },

  get(from, till, step, desc) {
    if(desc) {
      if(step) {
        let [year, month] = till.split('-');
        month = parseInt(month, 10) - step;
        while (month < 1) {
          year = parseInt(year, 10) - 1;
          month += 12;
        }
        till = `${year}-${month.pad(2)}`;
      }
      if(till < from) {
        return null;
      }
      let res = indexer.by_date[till];
      if(!res) {
        res = [];
      }
      return res;
    }
    else {
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
    }
  },

  // перебирает кеш в диапазоне дат
  find({selector, sort, ref, limit, skip = 0}, {branch}) {

    // извлекаем значения полей фильтра из селектора
    let dfrom, dtill, from, till, search, department, state;
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
        search = row[fld][cond] ? row[fld][cond].toLowerCase().split(' ') : [];
      }
      else if(fld === 'department') {
        department = cond ? row[fld][cond] : row[fld];
      }
      else if(fld === 'state') {
        state = cond ? row[fld][cond] : row[fld];
      }
    }

    if(sort && sort.length && sort[0][Object.keys(sort[0])[0]] === 'desc' || sort === 'desc') {
      sort = 'desc';
    }
    else {
      sort = 'asc';
    }

    const partners = branch.partners._obj.map(({acl_obj}) => acl_obj);
    const divisions = branch.divisions._obj.map(({acl_obj}) => acl_obj);

    let part,
      // выборка диапазона кеша
      step = 0,
      // флаг поиска страницы со ссылкой
      flag = skip === 0 && utils.is_guid(ref),
      // результат поиска строки со ссылкой
      scroll = 0,
      count = 0;

    const docs = [];

    function add(doc) {
      count++;
      if(flag && doc._id.endsWith(ref)) {
        scroll = count - 1;
        flag = false;
      }
      if(skip > 0) {
        skip--;
        return;
      }
      if(limit > 0) {
        limit--;
        docs.push(doc);
      }
    }

    function check(doc) {
      // фильтруем по дате
      if(doc.date < dfrom || doc.date > dtill) {
        return;
      }

      // фильтруем по контрагенту acl
      if(doc.partner && partners.length && !partners.includes(doc.partner)) {
        return;
      }

      // фильтруем по подразделению acl
      if(doc.department && divisions.length && !divisions.includes(doc.department)) {
        return;
      }

      // фильтруем по строке
      let ok = true;
      for(const word of search) {
        if(!word) {
          continue;
        }
        if(!search_fields.some((fld) => {
          const val = doc[fld];
          return val && typeof val === 'string' && val.toLowerCase().includes(word);
        })){
          ok = false;
          break;
        }
      }

      ok && add(doc);
    }

    // получаем очередной кусочек кеша
    while(part = indexer.get(from, till, step, sort === 'desc')) {
      step += 1;
      // фильтруем
      if(sort === 'desc') {
        for(let i = part.length - 1; i >= 0; i--){
          check(part[i]);
        }
      }
      else {
        for(let i = 0; i < part.length; i++){
          check(part[i]);
        }
      }
    }

    return {docs, scroll, flag, count};
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
        debug(`received ${indexer._count}`);
        for(const doc of docs) {
          indexer.put(doc, true);
        }
        debug(`indexed ${indexer._count} ${bookmark.substr(10, 30)}`);
        if(docs.length < 10000) {
          indexer.sort();
        }
        else {
          indexer.init(bookmark);
        }
      });
  },

};

pouch.on('pouch_complete_loaded', indexer.init);

export default indexer;
