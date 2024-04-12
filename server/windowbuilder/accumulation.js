/**
 *
 *
 * @module accumulation
 *
 * Created by Evgeniy Malyarov on 20.03.2019.
 */

module.exports = function accumulation({adapters, accumulation, cat, job_prm}, log) {

  if(process.env.PGPASSWORD && process.env.PGINDEXER) {
    const dbs = [];
    const {abonents, branches} = job_prm.server;
    for(const id of abonents) {
      const abonent = cat.abonents.by_id(id);
      if(abonent) {
        cat.branches.find_rows({owner: abonent, use: true}, (branch) => {
          if(!branches.length || branches.includes(branch.suffix)) {
            dbs.push(Object.assign(branch.db('doc'), {abonent, branch}));
          }
        });
        dbs.push(Object.assign(abonent.db('doc'), {abonent, branch: cat.branches.get()}));
      }
    }
    log(`PG indexer starting - ${dbs.map(({name}) => {
      const index = name.lastIndexOf('/');
      return name.substring(index+1);
    }).join(',')}`);


    return accumulation.init({
      dbs,
      listeners: [
        // клон заказов
        require('./calc_order_clone'),

        // Расчеты с контрагентами
        // require('./calc_order_calculations'),                       // заказы
        // require('./calculations_credit')('doc.debit_cash_order'),   // касса приход
        // require('./calculations_credit')('doc.credit_card_order'),  // оплата картой
        // require('./calculations_credit')('doc.debit_bank_order'),   // банк приход
      ],
      log,
    })
      .then(() => log('PG indexer started'));
  }
  else {
    log('PG indexer skipped');
    return Promise.resolve();
  }
};
