/*!
 windowbuilder-reports v2.0.242, built:2018-09-29
 © 2014-2018 Evgeniy Malyarov and the Oknosoft team http://www.oknosoft.ru
 To obtain commercial license and technical support, contact info@oknosoft.ru
 */


'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var metaCore = _interopDefault(require('metadata-core'));
var metaPouchdb = _interopDefault(require('metadata-pouchdb'));
var paper = _interopDefault(require('paper/dist/paper-core'));
var Router = _interopDefault(require('koa-better-router'));
var Koa = _interopDefault(require('koa'));
var cors = _interopDefault(require('@koa/cors'));

const debug = require('debug')('wb:meta');
const MetaEngine = metaCore.plugin(metaPouchdb);
const settings = require('./config/report.settings');
const meta_init = require('./src/metadata/init.js');
debug('required');
const $p$1 = global.$p = new MetaEngine();
debug('created');
$p$1.wsql.init(settings);
(async () => {
  const {user_node} = settings();
  meta_init($p$1);
  const {wsql, job_prm, adapters: {pouch}} = $p$1;
  pouch.init(wsql, job_prm);
  pouch.log_in(user_node.username, user_node.password)
    .then(() => pouch.load_data())
    .catch((err) => debug(err));
  pouch.on({
    user_log_in(name) {
      debug(`logged in ${$p$1.job_prm.couch_local}, user:${name}, zone:${$p$1.job_prm.zone}`);
    },
    user_log_fault(err) {
      debug(`login error ${err}`);
    },
    pouch_load_start(page) {
      debug('loadind to ram: start');
    },
    pouch_data_page(page) {
      debug(`loadind to ram: page №${page.page} (${page.page * page.limit} from ${page.total_rows})`);
    },
    pouch_complete_loaded(page) {
      debug(`ready to receive queries, listen on port: ${process.env.PORT || 3030}`);
    },
    pouch_doc_ram_loaded() {
      pouch.local.ram.changes({
        since: 'now',
        live: true,
        include_docs: true,
      }).on('change', (change) => {
        pouch.load_changes({docs: [change.doc]});
      }).on('error', (err) => {
        debug(`change error ${err}`);
      });
      debug(`loadind to ram: READY`);
    },
  });
})();

async function glasses({project, view, prod, res}) {
  for(const ox of prod){
    const {_obj: {glasses, coordinates}, name} = ox;
    const ref = $p.utils.snake_ref(ox.ref);
    res[ref] = {
      glasses: glasses,
      imgs: {},
      name,
    };
    if(coordinates && coordinates.length){
      await project.load(ox, true);
      ox.glasses.forEach((row) => {
        const glass = project.draw_fragment({elm: row.elm});
        res[ref].imgs[`g${row.elm}`] = view.element.toBuffer().toString('base64');
        if(glass){
          row.formula = glass.formula(true);
          glass.visible = false;
        }
      });
    }
  }
}
async function prod(ctx, next) {
  const {project, view} = new $p.Editor();
  const {nom} = $p.cat;
  const calc_order = await $p.doc.calc_order.get(ctx.params.ref, 'promise');
  const prod = await calc_order.load_production(true);
  const res = {number_doc: calc_order.number_doc};
  const {query} = require('url').parse(ctx.req.url);
  if(query && query.indexOf('glasses') !== -1) {
    await glasses({project, view, prod, res});
  }
  else{
    for(let ox of prod){
      const {_obj} = ox;
      const ref = $p.utils.snake_ref(ox.ref);
      res[ref] = {
        constructions: _obj.constructions || [],
        coordinates: _obj.coordinates || [],
        specification: _obj.specification ? _obj.specification.map((o) => Object.assign(o, {article: nom.get(o.nom).article})) : [],
        glasses: _obj.glasses,
        params: _obj.params,
        clr: _obj.clr,
        sys: _obj.sys,
        x: _obj.x,
        y: _obj.y,
        z: _obj.z,
        s: _obj.s,
        weight: _obj.weight,
        origin: _obj.origin,
        leading_elm: _obj.leading_elm,
        leading_product: _obj.leading_product,
        product: _obj.product,
    };
      if(_obj.coordinates && _obj.coordinates.length){
        await project.load(ox, true)
          .then(() => {
            res[ref].imgs = {
              'l0': view.element.toBuffer().toString('base64')
            };
        ox.constructions.forEach(({cnstr}) => {
          project.draw_fragment({elm: -cnstr});
          res[ref].imgs[`l${cnstr}`] = view.element.toBuffer().toString('base64');
        });
        ox.glasses.forEach((row) => {
          const glass = project.draw_fragment({elm: row.elm});
          res[ref].imgs[`g${row.elm}`] = view.element.toBuffer().toString('base64');
          if(glass){
            row.formula = glass.formula(true);
            glass.visible = false;
          }
        });
        });
      }
    }
  }
  ctx.body = res;
  setTimeout(() => {
    try{
      calc_order.unload();
      project.unload();
      for(const ox of prod){
        ox.unload();
      }      prod.length = 0;
    }
    catch(err){}
  });
}
async function array(ctx, next) {
  const prms = JSON.parse(ctx.params.ref);
  const grouped = $p.wsql.alasql('SELECT calc_order, product, elm FROM ? GROUP BY ROLLUP(calc_order, product, elm)', [prms]);
  const res = [];
  const {project, view} = new $p.Editor();
  function builder_props({calc_order, product}) {
    for(const prm of prms) {
      if(calc_order === prm.calc_order && product === prm.product) {
        return prm.builder_props || true;
      }
    }
    return true;
  }
  let calc_order, ox, fragmented;
  for(let img of grouped) {
    if(img.product == null){
      if(calc_order){
        calc_order.unload();
        calc_order = null;
      }
      if(img.calc_order){
        calc_order = await $p.doc.calc_order.get(img.calc_order, 'promise');
      }
      continue;
    }
    if(img.elm == null){
      if(ox){
        ox.unload();
        ox = null;
      }
      const row = calc_order.production.get(img.product-1);
      if(row){
        ox = await calc_order.production.get(img.product-1).characteristic.load();
        await project.load(ox, builder_props(img));
        fragmented = false;
      }
      else{
        ox = null;
      }
      continue;
    }
    if(!ox){
      continue;
    }
    if(img.elm == 0){
      if(fragmented){
        await project.load(ox, builder_props(img));
      }
    }
    else{
      fragmented = true;
      project.draw_fragment({elm: img.elm});
    }
    res.push({
      calc_order: img.calc_order,
      product: img.product,
      elm: img.elm,
      img: view.element.toBuffer().toString('base64')
    });
  }
  calc_order && calc_order.unload();
  ox && ox.unload();
  ctx.body = res;
}
async function png(ctx, next) {
}
async function svg(ctx, next) {
}
var executer = async (ctx, next) => {
  const {restrict_ips} = ctx.app;
  const ip = ctx.req.headers['x-real-ip'] || ctx.ip;
  if(restrict_ips.length && restrict_ips.indexOf(ip) == -1){
    ctx.status = 403;
    ctx.body = 'ip restricted: ' + ip;
    return;
  }
  try{
    switch (ctx.params.class){
      case 'doc.calc_order':
        return await prod(ctx, next);
      case 'array':
        return await array(ctx, next);
      case 'png':
        return await png(ctx, next);
      case 'svg':
        return await svg(ctx, next);
    }
  }
  catch(err){
    ctx.status = 500;
    ctx.body = err.stack;
    console.error(err);
  }
};

global.paper = paper;
const EditorInvisible = require('./src/builder/drawer');
const debug$1 = require('debug')('wb:paper');
debug$1('required, inited & modified');
class Editor extends EditorInvisible {
  constructor(format = 'png') {
    super();
    this.create_scheme(format);
  }
  create_scheme(format = 'png') {
    const _canvas = paper.createCanvas(480, 480, format);
    _canvas.style.backgroundColor = '#f9fbfa';
    new EditorInvisible.Scheme(_canvas, this, true);
    const {view} = this.project;
    view._element = _canvas;
    if(!view._countItemEvent) {
      view._countItemEvent = function () {};
    }
  }
}
$p$1.Editor = Editor;

const debug$2 = require('debug')('wb:indexer');
const {adapters: {pouch}, doc: {calc_order}} = $p$1;
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
const indexer = {
  by_date: new Map(),
  _count: 0,
  put(indoc) {
    const doc = {};
    fields.forEach((fld) => doc[fld] = indoc[fld]);
    const date = parseInt(doc.date.substr(0,7).replace('-', ''), 10);
    if(indexer.by_date.has(date)) {
      const arr = indexer.by_date.get(date);
      if(!arr.some((row) => {
        if(row._id === doc._id) {
          Object.assign(row, doc);
          return true;
        }
      })){
        arr.push(doc);
      }
    }
    else {
      indexer.by_date.set(date, [doc]);
    }
  },
  find(selector) {
    return [];
  },
  init(bookmark) {
    if(!bookmark) {
      calc_order.on('change', indexer.put);
      debug$2('start');
    }
    pouch.remote.doc.find({
      selector: {
        class_name: calc_order.class_name,
      },
      fields,
      bookmark,
      limit: 10000,
    })
      .then(({bookmark, docs}) => {
        indexer._count += docs.length;
        for(const doc of docs) {
          doc.state !== 'template' && indexer.put(doc);
        }
        debug$2(`indexed ${indexer._count} ${bookmark.substr(0, 30)}`);
        docs.length === 10000 && indexer.init(bookmark);
      });
  },
};
pouch.on('pouch_complete_loaded', indexer.init);

var calc_order$1 = async (ctx, next) => {
  indexer.some(0, 1000, (row) => {
  });
};

var search = async (ctx, next) => {
  try{
    return await calc_order$1(ctx, next);
  }
  catch(err){
    ctx.status = 500;
    ctx.body = err.stack;
    console.error(err);
  }
};

const debug$3 = require('debug')('wb:router');
debug$3('start');
const rep = Router({ prefix: '/r' });
rep.loadMethods()
  .get('/', async (ctx, next) => {
    await next();
    ctx.body = `Reports: try out <a href="/r/img">/r/img</a> too`;
  })
  .get('/img/:class/:ref', executer)
  .post('/_find', search);

const app = new Koa();
app.use(cors({credentials: true, maxAge: 600}));
app.use(rep.middleware());
app.listen(process.env.PORT || 3030);
app.restrict_ips = process.env.IPS ? process.env.IPS.split(',') : [];

module.exports = app;
//# sourceMappingURL=index.js.map
