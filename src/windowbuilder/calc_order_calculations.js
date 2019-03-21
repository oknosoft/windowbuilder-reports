/**
 *
 *
 * @module calc_order_calculations
 *
 * Created by Evgeniy Malyarov on 20.03.2019.
 */

const class_name = 'doc.calc_order';

module.exports = {
  class_name,
  listener(couch, acc, doc) {
    const ref = doc._id.substr(15);
    if(doc.posted) {
      return acc.client.query(`INSERT INTO calculations (register, register_type, row, period, trans, partner, organization, amount_debit) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (register, row) DO UPDATE SET 
        register_type = EXCLUDED.register_type,
        period = EXCLUDED.period,
        trans = EXCLUDED.trans,
        partner = EXCLUDED.partner,
        organization = EXCLUDED.organization,
        amount_debit = EXCLUDED.amount_debit;`, [ref, class_name, 1, new Date(doc.date), ref, doc.partner, doc.organization, doc.doc_amount]);
    }
    else {
      return acc.client.query(`DELETE FROM calculations WHERE register = $1;`, [ref]);
    }
  }
}


