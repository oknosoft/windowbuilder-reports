/**
 * быстрый поиск заказов
 *
 * @module index
 *
 * Created by Evgeniy Malyarov on 29.09.2018.
 */


module.exports = function($p, log) {

  // const indexer = require('./indexer')($p);
  // $p.adapters.pouch.on('indexer_page', (page) => {
  //   log(`indexed ${page.indexer._count} ${page.bookmark.substr(10, 30)}`);
  // });

  const {utils: {getBody, _find_rows_with_sort}, md} = $p;

  function separate(raw) {
    const {$and} = raw.selector;
    raw.selector = {$and: [], search: ''};
    for(const row of $and) {
      const fld = Object.keys(row)[0];
      const cond = Object.keys(row[fld])[0];
      if(fld === 'date') {
        if(cond === '$lt' || cond === '$lte') {
          raw.selector.dtill = row[fld][cond].replace(String.fromCharCode(65520), '');
        }
        else if(cond === '$gt' || cond === '$gte') {
          raw.selector.dfrom = row[fld][cond];
        }
      }
      else if(fld === 'search') {
        raw.selector.search = (cond ? row[fld][cond] : row[fld]) || '';
      }
      else if(fld === 'class_name') {
        raw.selector.class_name = cond ? row[fld][cond] : row[fld];
      }
      else {
        raw.selector.$and.push(row);
      }
    }
    return md.mgr_by_class_name(raw.selector.class_name);
  }

  function local_rows(mgr, raw) {
    const {selector, sort, ref, limit, skip = 0, fullJSON} = raw;
    const {$and, dfrom, dtill, class_name, search} = selector;
    const select = {};
    if(sort) {
      select._sort = sort;
    }
    if(limit) {
      select._top = limit;
    }
    if(skip) {
      select._skip = skip;
    }
    if(search) {
      const meta = mgr.metadata();
      const fields = meta.input_by_string?.length ? [...meta.input_by_string] : ['name'];
      if(meta.fields.note && !fields.includes('note')) {
        fields.push('note');
      }
      select._search = {
        fields,
        value: search.trim().replace(/\s\s/g, ' ').split(' ').filter(v => v)
      };
    }
    const pre = _find_rows_with_sort.call(mgr, mgr.alatable, select);
    if(fullJSON) {
      pre.docs = pre.docs.map(({ref}) => mgr.get(ref).toJSON());
    }
    return pre;
  }

  return async (req, res) => {
    const selector = JSON.parse(await getBody(req));
    const mgr = separate(selector);
    if(!mgr) {
      const err = new Error('Ошибка в class_name селектора запроса');
      err.status = 403;
      throw err;
    }
    const rows = mgr.metadata().cachable === 'ram' ?
      local_rows(mgr, selector) :
      await $p.accumulation.find(selector, req.user);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(rows));

  }
}
