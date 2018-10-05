/**
 * ### Кеш первого уровня - по датам
 * с функцией поиска в этом кеше
 *
 * @module indexer
 *
 * Created by Evgeniy Malyarov on 29.09.2018.
 */


import $p from '../metadata';

const {adapters: {pouch}, doc: {calc_order}, classes} = $p;
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

const indexer = new classes.RamIndexer({fields, search_fields, mgr: calc_order});

pouch.on('pouch_complete_loaded', () => indexer.init());

export default indexer;
