/**
 * ### При установке параметров сеанса
 * Процедура устанавливает параметры работы программы при старте веб-приложения
 *
 * @param prm {Object} - в свойствах этого объекта определяем параметры работы программы
 */
module.exports = function settings(prm) {

  return Object.assign(prm || {}, {

    // разделитель для localStorage
    local_storage_prefix: "wb_",

    // гостевые пользователи для демо-режима
    guests: [],

    // расположение couchdb для nodejs
    couch_local: process.env.COUCHLOCAL || "http://cou221:5984/wb_",

    pouch_filter: {
      meta: "auth/meta"
    },

    // авторизация couchdb
    user_node: {
      username: process.env.DBUSER || 'admin',
      password: process.env.DBPWD || 'admin'
    },

    couch_direct: true,

    // расположение couchdb
    get couch_path() {
      return this.couch_local;
    },

    // по умолчанию, обращаемся к зоне 21
    zone: process.env.ZONE || 21,

    server: {
      prefix: '/r',                   // Mount path, no trailing slash
      port: process.env.PORT || 3030, // Port
      maxpost: 40 * 1024 * 1024,      // Max size of POST request

      rater: {                    // Request rate locker
        all: {                    // Total requests limit
          interval: 2,            // Seconds, collect interval
          limit: 300              // Max requests per interval
        },
        ip: {                     // Per-ip requests limit
          interval: 10,
          limit: 100
        }
      }
    },

    workers: {
      count: 1,                 // Total threads
      reloadAt: 3,              // Hour all threads are restarted
      reloadOverlap: 40e3,      // Gap between restarts of simultaneous threads
      killDelay: 10e3           // Delay between shutdown msg to worker and kill, ms
    },

  })

}
