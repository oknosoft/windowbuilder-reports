const url = require('url');
const qs = require('qs');
const auth = require('../auth');

module.exports = function($p, log) {

  // формирует структуру с эскизами заполнений
  async function glasses({project, view, prod, res, builder_props, format}) {
    for(const ox of prod){

      const {_obj: {glasses, coordinates}, name} = ox;
      const ref = $p.utils.snake_ref(ox.ref);
      res[ref] = {
        glasses: glasses,
        imgs: {},
        name,
      };

      if(coordinates && coordinates.length){
        await project.load(ox, builder_props || true);

        ox.glasses.forEach((row) => {
          const glass = project.draw_fragment({elm: row.elm});
          // подтянем формулу стеклопакета
          if(format.includes('png')) {
            res[ref].imgs[`g${row.elm}`] = view.element.toBuffer().toString('base64');
          }
          if(format.includes('svg')) {
            res[ref].imgs[`sg${row.elm}`] = project.get_svg();
          }
          if(glass){
            row.formula = glass.formula(true);
            glass.visible = false;
          }
        });
        project.ox = null;
      }
    }
  }


  // формирует json описания продукции с эскизами
  async function prod(ctx, next) {

    let editor = new $p.Editor();
    const {nom} = $p.cat;
    const calc_order = await $p.doc.calc_order.get(ctx.params.ref, 'promise');
    const prod = await calc_order.load_production(true);
    const res = {number_doc: calc_order.number_doc};

    const {query} = url.parse(ctx.req.url);
    let prms, builder_props;
    if(query && query.length > 3) {
      prms = qs.parse(query.replace('?',''));
      if(prms.builder_props) {
        try{
          builder_props = JSON.parse(prms.builder_props);
        }
        catch(err){}
      }
    }

    const format = prms && prms.hasOwnProperty('format') ? (prms.format ? prms.format.split(',') : []) : ['png'];

    if(prms && prms.hasOwnProperty('glasses')) {
      const {project, view} = editor;
      await glasses({project, view, prod, res, builder_props, format});
    }
    else{
      let counter = 8;
      for(const ox of prod){

        try {
          counter--;
          if(counter < 0) {
            counter = 8;
            editor.unload();
            editor = new $p.Editor();
          }
          const {project, view} = editor;
          // project.draw_fragment({elm: -1});
          // view.update();
          // ctx.type = 'image/png';
          // ctx.body = return view.element.toBuffer();

          const {_obj} = ox;
          const ref = $p.utils.snake_ref(ox.ref);
          res[ref] = {
            constructions: _obj.constructions || [],
            coordinates: _obj.coordinates || [],
            specification: _obj.specification ? _obj.specification.map((o) => {
              const {_row} = o;
              const dop = {article: _row.nom.article};
              if($p.utils.is_data_obj(_row.origin)){
                if(_row.origin.empty()) {
                  dop.origin = undefined;
                }
                else {
                  dop.origin = {ref: _row.origin.ref, id: _row.origin.id, name: _row.origin.name, class_name: _row.origin.class_name};
                }
              }
              if($p.utils.is_data_obj(_row.specify)){
                if(_row.specify.empty()) {
                  dop.specify = undefined;
                }
                else {
                  dop.specify = {ref: _row.specify.ref, id: _row.specify.id, name: _row.specify.name, class_name: _row.origin.class_name};
                }
              }
              return Object.assign(o, dop);
            }) : [],
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
            imgs: {},
          }._clone();

          if(_obj.coordinates && _obj.coordinates.length){

            await project.load(ox, builder_props || true)
              .then(() => {
                if(format.includes('png')) {
                  res[ref].imgs.l0 = view.element.toBuffer().toString('base64');
                }
                if(format.includes('svg')) {
                  res[ref].imgs.s0 = project.get_svg();
                }
              })
              .then(() => {
                ox.constructions.forEach(({cnstr}) => {
                  project.draw_fragment({elm: -cnstr});
                  if(format.includes('png')) {
                    res[ref].imgs[`l${cnstr}`] = view.element.toBuffer().toString('base64');
                  }
                  if(format.includes('svg')) {
                    res[ref].imgs[`s${cnstr}`] = project.get_svg();
                  }
                });
              })
              .then(() => {
                ox.glasses.forEach(({row, elm}) => {
                  const glass = project.draw_fragment({elm});
                  // подтянем формулу стеклопакета
                  if(format.includes('png')) {
                    res[ref].imgs[`g${elm}`] = view.element.toBuffer().toString('base64');
                  }
                  if(format.includes('svg')) {
                    res[ref].imgs[`sg${elm}`] = project.get_svg();
                  }
                  if(glass){
                    res[ref].glasses[row - 1].formula = glass.formula(true);
                    glass.visible = false;
                  }
                });
              })
              .then(() => {
                ox._data._modified = false;
                project.clear();
                ox.unload();
              });
          }
        }
        catch(err) {
          err = null;
        }
      }
    }

    ctx.body = res;

    Promise.resolve()
      .then(() => {
        calc_order.unload();
        editor.unload();
        for(const ox of prod){
          try{
            ox.unload();
          }
          catch(err) {
            err = null;
          }
        };
        prod.length = 0;
      })
      .catch((err) => null);

  }

  // формирует массив эскизов по параметрам запроса
  async function array(ctx, next) {

    // отсортировать по заказам и изделиям
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
      })
    }

    calc_order && calc_order.unload();
    ox && ox.unload();

    ctx.body = res;

  }

  // формирует единичный эскиз по параметрам запроса
  async function png(ctx, next) {

  }

  // формирует единичный эскиз по параметрам запроса
  async function svg(ctx, next) {

  }

  return async (ctx, next) => {

    // контролируем загруженность справочников
    if(!$p.job_prm.complete_loaded) {
      ctx.status = 403;
      ctx.body = 'loading to ram, wait 1 minute';
      return;
    }

    // контролируем водопад
    if(!$p.hasOwnProperty('queue')) {
      $p.queue = 0;
    }
    $p.queue++;
    const start = Date.now();

    const fin = () => {
      $p.queue--;
      // log({
      //   start,
      //   duaration: Date.now() - start,
      // });
    }

    // проверяем ограничение по ip и авторизацию
    await auth(ctx, $p)
      .catch(() => null);

    // log({
    //   start,
    //   ip: ctx.req.headers['x-real-ip'] || ctx.ip,
    //   url: ctx.req.url,
    //   auth: ctx._auth && ctx._auth.username,
    //   queue: $p.queue,
    // });

    if(!ctx._auth) {
      return;
    }

    try{
      switch (ctx.params.class){
      case 'doc.calc_order':
        return await prod(ctx, next).then(fin);
      case 'array':
        return await array(ctx, next).then(fin);
      case 'png':
        return await png(ctx, next).then(fin);
      case 'svg':
        return await svg(ctx, next).then(fin);
      default:
        fin();
      }
    }
    catch(err){
      fin();
      ctx.status = 500;
      ctx.body = err.stack;
      log(err);
    }

  };
}
