
const addressFields = require('./addressFields');

module.exports = function($p, log) {
  const {utils: {getBody, end}, job_prm, cat: {partners, contracts, contact_information_kinds}, adapters: {pouch}, accumulation: acc} = $p;

  return async (req, res) => {

    const {parsed: {paths}, method} = req;
    const inn = paths[2] || paths[4];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    try{
      if(method === 'GET') {
        // сначала, ищем контрагента в памяти - возможно это старый контрагент, не доставленный в браузер
        const partner = partners.find({inn});
        if(partner) {
          return res.end(JSON.stringify(partner));
        }
        const {suggestions} = await fetch(
          'http://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
            method: 'POST',
            headers: {
              Authorization: `Token ${job_prm.keys.dadata}`,
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: `{"query": "${inn}", "count": 3}`,
          })
          .then((res) => res.json());
        if(suggestions?.length) {
          res.end(JSON.stringify(suggestions));
        }
        else {
          const err = new Error(`Нет контрагента с ИНН "${inn}"`);
          err.status = 404;
          end.end500({res, err, log});
        }
      }
      else if(method === 'PUT' || method === 'POST') {
        const {raw, mode, partner, organization, trans} = JSON.parse(await getBody(req));
        if(raw) {
          const {inn, kpp, ogrn, okpo, okato, oktmo, okved, address, type, fio} = raw.data;
          const partner = partners.find({inn}) || partners.create({inn}, false, true);
          if(partner.is_new()) {
            Object.assign(partner, {kpp, ogrn, okpo, name: raw.value, is_buyer: true});
            partner.individual_legal = type === 'LEGAL' ? 'ЮрЛицо' : 'ФизЛицо';
          }
          if(!partner.contact_information.count() && address.value) {
            partner.contact_information.add(addressFields(address, contact_information_kinds));
          }
          if(organization) {
            let contract = contracts.find({owner: partner.ref, organization});
            if(!contract) {
              contract = contracts.create({
                owner: partner.ref,
                organization,
                name: 'Основной',
                mutual_settlements: "ПоЗаказам",
                contract_kind: "СПокупателем",
                settlements_currency: job_prm.pricing?.main_currency?.ref,
              }, false, true);
              if(contract.organization.individual_legal.is('ЮрЛицо')) {
                contract.vat_consider = true;
                contract.vat_included = true;
              }
            }
            if(partner.main_contract.empty()) {
              partner.main_contract = contract;
            }
          }
          const _obj = partner.toJSON();
          const {_manager, _data, ref, class_name} = partner;
          await pouch.save_obj({_obj, _manager, _data, ref, class_name, is_new() {}, _set_loaded() {}}, {});
          res.end(JSON.stringify(_obj));
        }
        else {
          if(partner && mode === 'balance') {
            const pq = organization ?
              await acc.client.query(`select sum(sign * amount) balance from areg_calculations where partner = $1 and organization = $2`, [partner, organization]) :
              (trans ? await acc.client.query(`select sum(sign * amount) balance from areg_calculations where partner = $1 and trans = $2`, [partner, trans]) :
                await acc.client.query(`select sum(sign * amount) balance from areg_calculations where partner = $1`, [partner]));
            res.end(JSON.stringify({
              ok: true,
              balance: parseFloat(pq.rows[0].balance),
            }));
          }
          else if(partner && mode === 'trans') {
            const pq = await acc.client.query(`select trans, sum(sign * amount) balance from areg_calculations where partner = $1 group by trans having sum(sign * amount) <> 0`, [partner]);
            res.end(JSON.stringify({
              ok: true,
              rows: pq.rows[0],
            }));
          }
          else {
            const err = new Error('Недостаточно параметров в теле запроса');
            err.status = 404;
            end.end500({res, err, log});
          }
        }
      }
      else {
        const err = new Error(`Метод ${method} не поддержан. Используйте "GET" или "PUT"`);
        err.status = 404;
        end.end500({res, err, log});
      }
    }
    catch(err){
      end.end500({res, err, log});
    }

  };
}
