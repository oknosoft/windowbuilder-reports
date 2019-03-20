/**
 *
 *
 * @module calc_order_calculations
 *
 * Created by Evgeniy Malyarov on 20.03.2019.
 */

module.exports = {
  class_name: 'doc.calc_order',
  listener(couch, acc, doc) {
    const ref = doc._id.substr(15);
    if(doc.posted) {
      return acc.client.query(`INSERT INTO calculations (period, register, trans, partner, organization, amount) 
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (register) DO UPDATE SET 
        period = EXCLUDED.period,
        trans = EXCLUDED.trans,
        partner = EXCLUDED.partner,
        organization = EXCLUDED.organization,
        amount = EXCLUDED.amount;`, [new Date(doc.date), ref, ref, doc.partner, doc.organization, doc.doc_amount]);
    }
    else {
      return acc.client.query(`DELETE FROM calculations WHERE register = $1;`, [ref]);
    }
  }
}
