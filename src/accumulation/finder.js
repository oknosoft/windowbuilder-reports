/**
 *
 *
 * @module finder
 *
 * Created by Evgeniy Malyarov on 23.03.2019.
 */

const fields = [
  'ref',
  '_deleted',
  'posted',
  'date',
  'number_doc',
  'number_internal',
  'partner',
  'client_of_dealer',
  'manager',
  'doc_amount',
  'obj_delivery_state',
  'department',
  'note'];

function truth(conditions, fld, cond) {
  const blank = '00000000-0000-0000-0000-000000000000';

  conditions += ' and ';

  if(cond === true || (cond && cond.hasOwnProperty('$ne') && !cond.$ne)) {
    conditions += `${fld} = true`;
  }
  else if(cond === false || (cond && cond.hasOwnProperty('$ne') && cond.$ne && typeof cond.$ne === 'boolean')) {
    conditions += `${fld} = false`;
  }
  else if(cond && cond.hasOwnProperty('filled')) {
    conditions += `${fld} is not null and ${fld} != ${blank}`;
  }
  else if(cond && cond.hasOwnProperty('nfilled')) {
    conditions += `(${fld} is null or ${fld} = ${blank})`;
  }
  else if(cond && cond.hasOwnProperty('$ne')) {
    conditions += `${fld} != ${cond.$ne}`;
  }
  else if(cond && cond.hasOwnProperty('$in')) {
    const acond = typeof cond.$in === 'string' ? cond.$in.split(',').map((v) => v.trim()) : cond.$in;
    conditions += `${fld} in (${acond.map(v => typeof v !== 'string' || v[0] === `'` || v[0] === `"` ? v : `'${v}'`).join()})`;
  }
  else if(cond && cond.hasOwnProperty('$nin')) {
    const acond = typeof cond.$nin === 'string' ? cond.$nin.split(',').map((v) => v.trim()) : cond.$nin;
    conditions += `${fld} not in (${acond.map(v => typeof v !== 'string' || v[0] === `'` || v[0] === `"` ? v : `'${v}'`).join()})`;
  }
  else {
    conditions += `${fld} = ${cond}`;
  }
}

module.exports = function (Proto) {
  return class Accumulation extends Proto {

    find({selector, sort, ref, limit, skip = 0}, {branch}) {

      if(!this.client) {
        const err = new Error('Индекс прочитн не полностью, повторите запрос позже');
        err.status = 403;
        throw err;
      }

      // извлекаем значения полей фильтра из селектора
      let dfrom, dtill, class_name, search = '', conditions = '';
      for(const row of selector.$and) {
        const fld = Object.keys(row)[0];
        const cond = Object.keys(row[fld])[0];
        if(fld === 'date') {
          if(cond === '$lt' || cond === '$lte') {
            dtill = row[fld][cond];
          }
          else if(cond === '$gt' || cond === '$gte') {
            dfrom = row[fld][cond];
          }
        }
        else if(fld === 'search') {
          search = (cond ? row[fld][cond] : row[fld]) || '';
        }
        else if(fld === 'class_name') {
          class_name = cond ? row[fld][cond] : row[fld];
        }
        else if(fields.includes(fld)) {
          truth(conditions, fld, row[fld]);
        }
      }

      if(sort && sort.length && sort[0][Object.keys(sort[0])[0]] === 'desc' || sort === 'desc') {
        sort = 'desc';
      }
      else {
        sort = 'asc';
      }

      const mgr = this.$p.md.mgr_by_class_name(class_name);
      if(!mgr) {
        const err = new Error('Ошибка в class_name селектора запроса');
        err.status = 403;
        throw err;
      }

      let flag = skip === 0 && this.$p.utils.is_guid(ref);

      if(search) {
        search = `and fts @@ websearch_to_tsquery('${search}')`;
      }

      let sql = `select ${fields.join()} from ${mgr.table_name} where date between $1 and $2 ${conditions} ${search} limit ${limit}`;

      return this.client.query(sql, [dfrom, dtill.replace(String.fromCharCode(65520), '')])
        .then((res) => {
          return {
            docs: res.rows,
            scroll: 0,
            flag,
            count: res.rowCount,
          }
        })
        .catch((err) => {
          this.emit('error', err);
        });
    }
  }
}
