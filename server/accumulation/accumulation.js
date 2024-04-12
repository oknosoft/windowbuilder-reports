/**
 *
 *
 * @module Accumulation
 *
 * Created by Evgeniy Malyarov on 20.03.2019.
 */

const {classes} = require('metadata-core');

const limit = 160;

class Accumulation extends classes.MetaEventEmitter {

  constructor($p) {
    super();
    this.$p = $p;
    // список баз couchdb, по которым бежим
    this.dbs = [];
    // список обработчиков проведения
    this.listeners = [];

    // привязываем контекст
    this.changes = this.changes.bind(this);
    this.feed = this.feed.bind(this);
    this.execute = this.execute.bind(this);
    this.reconnect = this.reconnect.bind(this);
    this.reflect = this.reflect.bind(this);
  }

  /**
   * создаёт базу и подключается
   */
  init({dbs = [], listeners = []}, log) {
    const {Client} = require('pg');
    const conf = {
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      password: process.env.PGPASSWORD,
      database: 'postgres',
    };
    this.dbs = dbs;
    this.log = log;
    this.listeners = listeners;
    const client = new Client(conf);
    return client.connect()
      .then(() => {
        const {job_prm} = this.$p;
        conf.database = job_prm.local_storage_prefix + job_prm.zone;
        return client.query(`SELECT 1 FROM pg_database WHERE datname = '${conf.database}'`)
      })
      .then(({rows}) => {
        if(!rows.length) {
          return client.query(`CREATE DATABASE ${conf.database} WITH
            ENCODING = 'UTF8'
            LC_COLLATE = 'ru_RU.UTF-8'
            LC_CTYPE = 'ru_RU.UTF-8'
            CONNECTION LIMIT = -1;`);
        }
      })
      .then((create_metadata) => {
        const reconnect = (client) => {
          return client.end()
            .then(() => {
              this.client = new Client(conf);
              return this.client.connect();
            })
        };
        return reconnect(client)
          .then(() => {
            if(create_metadata) {
              return this.db_metadata()
                .then(() => reconnect(this.client));
            }
          });
      })
      .then(() => this.set_param('date', Date.now()))
      .then(() => {
        this.emit('init');
        this.execute();
      })
      .catch((err) => {
        this.log(err);
        this.emit('err', err)
      });
  }

  /**
   * Создаёт таблицы, индексы и триггеры
   * @return {Promise<void>}
   */
  db_metadata() {
    const {client} = this;
    const raw = require('fs').readFileSync(require.resolve('./pg.sql'), 'utf8').split('\n');
    let sql = '';
    for(const row of raw) {
      sql += '\n';
      if(!row.startsWith('--')){
        sql += row;
      }
    }
    for(let i = 0; i < 5; i++) {
      sql = sql.replace(/\n\n\n/g, '\n\n');
    }
    let res = Promise.resolve();
    for(const row of sql.split('\n\n')) {
      if(!row) {
        continue;
      }
      res = res.then(() => client.query(row));
    }
    return res;
  }

  /**
   * Фильтр для changes по class_name активных listeners
   */
  changes_conf(db, live=false) {
    const names = new Set();
    for(const {class_name} of this.listeners) {
      names.add(class_name);
    }
    const conf = {
      include_docs: true,
      selector: {class_name: {$in: Array.from(names)}},
      limit,
      batch_size: limit,
      live,
    };
    return this.get_param(`changes:${db.name}`)
      .then((since) => {
        if(since) {
          conf.since = since;
        }
        return conf;
      });
  }

  reflect(db, res, conf) {
    let queue = Promise.resolve();
    for (const {doc} of res.results) {
      for (const {class_name, listener} of this.listeners) {
        if (doc._id.startsWith(class_name + '|')) {
          queue = queue.then(() => listener(db, this, doc));
        }
      }
    }
    return queue
      .then(() => res.last_seq && conf.since !== res.last_seq && this.set_param(`changes:${db.name}`, res.last_seq))
      .then(() => res);
  }

  reconnect(db, changes) {
    changes.cancel();
    this.$p.utils.sleep(4000)
      .then(() => this.feed(db));
  }

  feed(db) {
    this.changes_conf(db, true)
      .then((conf) => {
        const changes = db.changes(conf)
          .on('change', (change) => {
            this.reflect(db, {results: [change], last_seq: change.seq}, conf)
              .catch(() => this.reconnect(db, changes));
          })
          .on('error', (err)=> {
            this.reconnect(db, changes);
          });
      });
  }

  /**
   * Читает и обрабатывает изменения конкретной базы
   * @param db
   */
  changes(db) {
    return this.changes_conf(db)
      .then((conf) => db.changes(conf).then((changes) => [changes, conf]))
      .then(([changes, conf]) => this.reflect(db, changes, conf))
      .then((res) => {
        return res.results.length === limit ?
          this.changes(db) :
          this.feed(db);
      })
  }

  /**
   * Бежит по всем датабазам, читает изменения и перестраивает индексы
   */
  async execute() {
    const {changes, execute, dbs, $p: {utils}} = this;
    for(const db of dbs) {
      try {
        await changes(db);
      }
      catch (err) {
        this.emit('err', err);
        this.log(err);
        utils.sleep(20000).then(execute);
        break;
      }
    }
  }

  /**
   * создаёт таблицы регистров
   * @param def
   */
  create_tables(def = []) {

  }

  set_param(name, value) {
    return this.client.query(`INSERT INTO settings (param, value) VALUES ('${name}', '${value}')
      ON CONFLICT (param) DO UPDATE SET value = EXCLUDED.value;`);
  }

  get_param(name) {
    return this.client.query(`select value from settings where param = '${name}';`)
      .then(({rows}) => rows.length ? rows[0].value : '');
  }
}

module.exports = require('./finder')(Accumulation);
