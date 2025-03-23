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
  'organization',
  'department',
  'partner',
  'client_of_dealer',
  'manager',
  'doc_amount',
  'amount_internal',
  'amount_operation',
  'obj_delivery_state',
  'category',
  'note'];
const blank = '00000000-0000-0000-0000-000000000000';

function apply_rls($and, branch) {
  if(!branch || branch.empty()) return;

  // по подразделению
  let filter;
  if(!$and.some((row) => {
    const fld = Object.keys(row)[0];
    if(fld === 'department') {
      const cond = row[fld];
      filter = row;
      if(cond.$in) {
        const acond = typeof cond.$in === 'string' ? cond.$in.split(',').map((v) => v.trim()) : cond.$in;
        cond.$in = acond.filter(acl_obj => branch.divisions.find({acl_obj}));
        return true;
      }
      else if(cond.$eq) {
        const acond = [cond.$eq];
        delete cond.$eq;
        cond.$in = acond.filter(acl_obj => branch.divisions.find({acl_obj}));
        return true;
      }
    }
  })) {
    if(!filter) {
      $and.push({department: {$in: branch.divisions._obj.map(v => v.acl_obj)}});
    }
    else {
      filter.department = {$in: branch.divisions._obj.map(v => v.acl_obj)};
    }
  }

  // по контрагенту
  filter = undefined;
  if(!$and.some((row) => {
    const fld = Object.keys(row)[0];
    if(fld === 'partner') {
      const cond = row[fld];
      filter = row;
      if(cond.$in) {
        const acond = typeof cond.$in === 'string' ? cond.$in.split(',').map((v) => v.trim()) : cond.$in;
        cond.$in = acond.filter(acl_obj => branch.partners.find({acl_obj}));
        return true;
      }
      else if(cond.$eq) {
        const acond = [cond.$eq];
        delete cond.$eq;
        cond.$in = acond.filter(acl_obj => branch.partners.find({acl_obj}));
        return true;
      }
    }
  })) {
    if(!filter) {
      $and.push({partner: {$in: branch.partners._obj.map(v => v.acl_obj)}});
    }
    else {
      filter.partner = {$in: branch.partners._obj.map(v => v.acl_obj)};
    }
  }
}

module.exports = function (Proto) {
  return class Accumulation extends Proto {

    find({selector, sort, ref, limit, skip = 0}, {branch}) {

      if(!this.client || !this.client._connected) {
        const err = new Error('Индекс прочитан не полностью, повторите запрос позже');
        err.status = 403;
        throw err;
      }

      const {$and} = selector;
      // если указан отдел абонента, принудительно дополняем селектор
      apply_rls($and, branch);

      let dfrom, dtill, class_name, search = '', conditions = '';

      function truth(fld, cond) {

        if(cond === true || (cond && cond.hasOwnProperty('$ne') && !cond.$ne)) {
          conditions += ` and ${fld} = true`;
        }
        else if(cond === false || (cond && cond.hasOwnProperty('$ne') && cond.$ne && typeof cond.$ne === 'boolean')) {
          conditions += ` and ${fld} = false`;
        }
        else if(cond?.hasOwnProperty('filled')) {
          conditions += ` and ${fld} is not null and ${fld} != ${blank}`;
        }
        else if(cond?.hasOwnProperty('nfilled')) {
          conditions += ` and (${fld} is null or ${fld} = ${blank})`;
        }
        else if(cond?.hasOwnProperty('$ne')) {
          conditions += ` and ${fld} != ${cond.$ne}`;
        }
        else if(cond?.hasOwnProperty('$in')) {
          const acond = (typeof cond.$in === 'string' ? cond.$in.split(',').map((v) => v.trim()) : cond.$in).filter(v => v);
          if(acond.length) {
            conditions += ` and ${fld} in (${acond.map(v => typeof v !== 'string' || v[0] === `'` || v[0] === `"` ? v : `'${v}'`).join()})`;
          }
        }
        else if(cond?.hasOwnProperty('$nin')) {
          const acond = (typeof cond.$nin === 'string' ? cond.$nin.split(',').map((v) => v.trim()) : cond.$nin).filter(v => v);
          if(acond.length) {
            conditions += ` and ${fld} not in (${acond.map(v => typeof v !== 'string' || v[0] === `'` || v[0] === `"` ? v : `'${v}'`).join()})`;
          }
        }
        else if(cond?.hasOwnProperty('$eq')) {
          if(typeof cond.$eq === 'string') {
            conditions += ` and ${fld} = '${cond.$eq}'`;
          }
          else if(typeof cond.$eq === 'number') {
            conditions += ` and ${fld} = ${cond.$eq}`;
          }
        }
        else {
          conditions += ` and ${fld} = ${cond}`;
        }
      }

      // извлекаем значения полей фильтра из селектора
      for(const row of $and) {
        const fld = Object.keys(row)[0];
        const cond = Object.keys(row[fld])[0];
        if(fld === 'date') {
          if(cond === '$lt' || cond === '$lte') {
            dtill = row[fld][cond].replace(String.fromCharCode(65520), '');
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
          truth(fld, row[fld]);
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

      if(flag) {
        let scroll;
        const tmp = Math.random().toString().replace('0.', 'tmp');
        return this.client.query(`drop table if exists ${tmp}`)
          .then(() => this.client.query(`select ref, row_number() OVER (order by date ${sort})
            INTO temp ${tmp} from ${mgr.table_name} where date between $1 and $2 ${conditions} ${search}`, [dfrom, dtill]))
          .then(() => this.client.query(`select row_number from ${tmp} where ref = '${ref}'`))
          .then((res) => {
            if(res.rows.length) {
              scroll = parseInt(res.rows[0].row_number, 10) - 1;
              flag = false;
            }
            return this.client.query(`select count(*) from ${tmp}`);
          })
          .then((res) => {
            const count = parseInt(res.rows[0].count, 10);
            let sql = `select r.ref, ${fields.filter(v => v !== 'ref').join()} from ${tmp} r
            inner join ${mgr.table_name} on r.ref = ${mgr.table_name}.ref
            order by date ${sort}
            offset ${skip} limit ${limit}`;

            return this.client.query(sql)
              .then((res) => {
                this.client.query(`drop table if exists ${tmp};`);
                return {
                  docs: res.rows,
                  scroll,
                  flag,
                  count,
                };
              });
          })
          .catch((err) => {
            this.client.query(`drop table if exists ${tmp};`);
            this.emit('err', err);
          });
      }

      let sql = `select count(*) from ${mgr.table_name} where date between $1 and $2 ${conditions} ${search}`;
      return this.client.query(sql, [dfrom, dtill])
        .then((res) => {
          sql = `select ${fields.join()} from ${mgr.table_name}
           where date between $1 and $2 ${conditions} ${search}
           order by date ${sort}
           offset ${skip} limit ${limit}`;
          const count = parseInt(res.rows[0].count, 10);
          return this.client.query(sql, [dfrom, dtill])
            .then((res) => {
              return {
                docs: res.rows,
                scroll: 0,
                flag,
                count,
              }
            })
        })
        .catch((err) => {
          this.emit('err', err);
        });
    }
  }
};
