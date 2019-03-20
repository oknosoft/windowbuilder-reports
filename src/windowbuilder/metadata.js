
// конструктор MetaEngine
const MetaEngine = require('metadata-core')
  .plugin(require('metadata-pouchdb'))
  .plugin(require('../accumulation'));

// функция установки параметров сеанса
const settings = require('../../config/app.settings');

// функция инициализации структуры метаданных
const meta_init = require('windowbuilder/init');

module.exports = function (runtime) {

  // Logger
  const log = require('../logger')(runtime);

  // создаём контекст MetaEngine
  const $p = new MetaEngine();
  log('created MetaEngine');

  // параметры сеанса инициализируем сразу
  $p.wsql.init(settings);

  // реквизиты подключения к couchdb
  const {user_node, server} = settings();

  // выполняем скрипт инициализации метаданных
  meta_init($p);

  // сообщяем адаптерам пути, суффиксы и префиксы
  const {wsql, job_prm, adapters: {pouch}} = $p;
  pouch.init(wsql, job_prm);

  // // подключим модификаторы
  // modifiers($p);

  // подключаем обработчики событий адаптера данных
  pouch.on({
    user_log_in(name) {
      log(`logged in ${job_prm.couch_local}, user:${name}, zone:${job_prm.zone}`);
      wsql.set_user_param('user_name', job_prm.current_user);
    },
    user_log_fault(err) {
      log(`login error ${err}`);
    },
    pouch_load_start(page) {
      log('loadind to ram: start');
    },
    pouch_data_page(page) {
      log(`loadind to ram: page №${page.page} (${page.page * page.limit} from ${page.total_rows})`);
    },
    pouch_complete_loaded(page) {
      job_prm.complete_loaded = true;
      log(`ready to receive queries, listen on port: ${server.port}`);
    },
    pouch_doc_ram_loaded() {
      pouch.local.ram.changes({
        since: 'now',
        live: true,
        include_docs: true,
      })
        .on('change', (change) => {
          // формируем новый
          pouch.load_changes({docs: [change.doc]});
        })
        .on('error', (err) => {
          log(`change error ${err}`);
        });

      require('./accumulation')($p);

      log(`loadind to ram: READY`);
    },
  });

  // загружаем кешируемые справочники в ram и начинаем следить за изменениями ram
  pouch
    .log_in(user_node.username, user_node.password)
    .then(() => pouch.load_data());

  return $p;
}
