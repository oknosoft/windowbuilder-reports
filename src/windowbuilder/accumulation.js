/**
 *
 *
 * @module accumulation
 *
 * Created by Evgeniy Malyarov on 20.03.2019.
 */

module.exports = function accumulation({adapters, accumulation}) {
  accumulation.init({
    dbs: [
      adapters.pouch.remote.doc,
    ],
    listeners: [
      require('./calc_order_calculations'),
    ]
  });
};
