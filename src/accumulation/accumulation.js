/**
 *
 *
 * @module Accumulation
 *
 * Created by Evgeniy Malyarov on 20.03.2019.
 */

const {classes} = require('metadata-core');

class Accumulation extends classes.MetaEventEmitter {

  constructor($p) {
    super();
    this.$p = $p;
    // список баз couchdb, по которым бежим
    this.dbs = [];
    // список обработчиков проведения
    this.listeners = [];
    // интервал опроса и пересчета
    this.interval = 60000;
    // указатель на текущий таймер
    this.timer = 0;
  }

  /**
   * создаёт базу и подключается
   */
  init({dbs = [], listeners = []}) {
    const {Client} = require('pg');
    const conf = {
      user: process.env.PGUSER,
      host: process.env.PGHOST,
      password: process.env.PGPASSWORD,
      database: 'postgres',
    };
    this.dbs = dbs;
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
      .then(() => client.end())
      .then(() => {
        this.client = new Client(conf);
        return this.client.connect();
      })
      .then(() => this.client.query(`CREATE TABLE IF NOT EXISTS settings (param character varying(255) PRIMARY KEY, value text)`))
      .then(() => this.set_param('date', Date.now()))
      .then(() => {
        this.emit('init');
        this.execute();
      })
      .catch((err) => this.emit('error', err));
  }

  /**
   * Фильтр для changes по class_name активных listeners
   */
  changes_selector() {
    const names = new Set();
    for(const {class_name} of this.listeners) {
      names.add(class_name);
    }
    return {class_name: {$in: Array.from(names)}};
  }

  /**
   * Читает и обрабатывает изменения конкретной базы
   * @param db
   */
  changes(db) {
    const limit = 200;
    const conf = {
      include_docs: true,
      selector: this.changes_selector(),
      limit,
      batch_size: limit,
    };
    return this.get_param(`changes:${db.name}`)
      .then((since) => {
        if(since) {
          conf.since = since;
        }
        return db.changes(conf);
      })
      .then((res) => {
        let queue = Promise.resolve();
        for(const {doc} of res.results) {
          for(const {class_name, listener} of this.listeners) {
            if(doc._id.startsWith(class_name + '|')) {
              queue = queue.then(() => listener(db, this, doc));
            }
          }
        }
        return queue
          .then(() => res.last_seq && conf.since !== res.last_seq && this.set_param(`changes:${db.name}`, res.last_seq))
          .then(() => res.results.length === limit && this.changes(db));
      });
  }

  /**
   * Бежит по всем датабазам, читает изменения и перестраивает индексы
   */
  execute() {
    clearTimeout(this.timer);
    const changes = this.changes.bind(this);
    return Promise.all(this.dbs.map(changes))
      .then(() => {
        this.timer = setTimeout(this.execute.bind(this), this.interval);
      })
      .catch((err) => this.emit('error', err));
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

module.exports = Accumulation;
