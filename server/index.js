
// app.restrict_ips = process.env.IPS ? process.env.IPS.split(',') : [];

module.exports = function reports($p, log, route = {}) {

  const windowbuilder = require('./windowbuilder')($p, log);
  const search  = require('./search')($p, log);
  const acc_get  = require('./accumulation/get')($p, log);
  const acc_post  = require('./accumulation/post')($p, log);
  const acc_delete  = require('./accumulation/delete')($p, log);
  const partners  = require('./partners')($p, log);

  route.r = async function reportsHandler(req, res) {
    const {query, path, paths} = req.parsed;

    if (paths[1] === 'img' || paths[3] === 'img') {
      return windowbuilder(req, res);
    }
    if (paths[1] === 'partners' || paths[3] === 'partners') {
      return partners(req, res);
    }
    if (req.method === 'POST' && (paths[1] === '_find' || paths[3] === '_find')) {
      return search(req, res);
    }
  }

  if(!route.pgsql) {
    route.pgsql = {};
  }
  route.pgsql.calculations = require('./accumulation/post')($p, log);

  return route.r;
}

