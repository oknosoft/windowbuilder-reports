const { hrtime } = require('node:process');
const NS_PER_SEC = 1e9;

module.exports = function ($p, log) {

  const {utils: {end: {end500, end404}, getBody}, accumulation: acc} = $p;

  return async (req, res) => {
    try{
      const {hrtime: start, parsed: {paths, path}} = req;
      let {register, register_type, rows} = JSON.parse(await getBody(req));
      if(!['doc.calc_order', 'doc.debit_cash_order', 'doc.credit_cash_order', 'doc.credit_card_order', 'doc.debit_bank_order', 'doc.credit_bank_order', 'doc.selling', 'doc.nom_prices_setup', 'doc.planning_event', 'doc.work_centers_task', 'doc.work_centers_performance', 'doc.purchase_order', 'doc.purchase', 'doc.offsetting', 'doc.balance_entering'].includes(register_type)) {
        log(`register_type: ${register_type}`);
        register_type = 'doc.balance_entering';
      }

      await acc.client.query('delete from areg_calculations where register = $1 and register_type = $2', [register, register_type]);
      //register, register_type, row_num, period, sign, trans, partner, organization, amount
      const orders = new Set();
      const values = rows.map((v) => {
        orders.add(v.trans);
        return `('${register}', '${register_type}', ${v.row_num}, '${v.period}', ${v.sign}, '${v.trans}', '${v.partner}', '${v.organization}', ${v.amount})`
      });

      const data = {ok: true};
      if(values.length) {
        const pq = await acc.client.query(`INSERT INTO areg_calculations (register, register_type, row_num, period, sign, trans, partner, organization, amount) VALUES ${values.join(',\n')}`);
        data.rowCount = pq.rowCount;
      }

      // запишем итоги в таблицу заказов
      if(orders.size === 1) {
        const order = Array.from(orders)[0];
        const pq = await acc.client.query(`select
       sum(case when sign < 0 then amount else 0 end) paid,
       sum (case when sign > 0 then amount else 0 end) shipped
       from areg_calculations where trans = $1`, [order]);
        const {paid, shipped} = pq.rows[0];
        await acc.client.query(`update doc_calc_order set paid = $2, shipped = $3 where ref = $1`, [order, parseFloat(paid), parseFloat(shipped)]);
      }
      else if(orders.size) {
        const pq = await acc.client.query(`select trans,
       sum(case when sign < 0 then amount else 0 end) paid,
       sum (case when sign > 0 then amount else 0 end) shipped
       from areg_calculations where trans = ANY ($1) group by trans`, [Array.from(orders)]);
        for(const row of pq.rows) {
          await acc.client.query(`update doc_calc_order set paid = $2, shipped = $3 where ref = $1`, [row.trans, parseFloat(row.paid), parseFloat(row.shipped)]);
        }
      }

      const diff = hrtime(start);
      data.took = `${((diff[0] * NS_PER_SEC + diff[1])/1e6).round(1)} ms`;
      log(`order/calculations took=${data.took}`);
      res.end(JSON.stringify(data, null, '\t'));
    }
    catch (err) {
      end500({req, res, err, log});
    }
  };
}
