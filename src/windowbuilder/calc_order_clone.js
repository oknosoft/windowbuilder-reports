/**
 * Клон заказов
 *
 * @module calc_order_calculations
 *
 * Created by Evgeniy Malyarov on 20.03.2019.
 */

const class_name = 'doc.calc_order';

function leftPad(str, len) {
  if(str.length <= len) return str;
  return str.substr(str.length - len);
}

module.exports = {
  class_name,
  listener(couch, acc, doc) {
    const ref = doc._id.substr(15);
    return acc.client.query(`INSERT INTO doc_calc_order (ref, _deleted, posted, date, number_doc, number_internal, project, organization, partner, client_of_dealer, contract, bank_account, note, manager, leading_manager, department, warehouse, doc_amount, amount_operation, amount_internal, accessory_characteristic, phone, delivery_area, shipping_address, coordinates, address_fields, vat_consider, vat_included, settlements_course, settlements_multiplicity, extra_charge_external, obj_delivery_state, category, production, extra_fields, contact_information, planning) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37)
      ON CONFLICT (ref) DO UPDATE SET 
        _deleted = EXCLUDED._deleted,
        posted = EXCLUDED.posted,
        date = EXCLUDED.date,
        number_doc = EXCLUDED.number_doc,
        number_internal = EXCLUDED.number_internal,
        project = EXCLUDED.project,
        organization = EXCLUDED.organization,
        partner = EXCLUDED.partner,
        client_of_dealer = EXCLUDED.client_of_dealer,
        contract = EXCLUDED.contract,
        bank_account = EXCLUDED.bank_account,
        note = EXCLUDED.note,
        manager = EXCLUDED.manager,
        leading_manager = EXCLUDED.leading_manager,
        department = EXCLUDED.department,
        warehouse = EXCLUDED.warehouse,
        doc_amount = EXCLUDED.doc_amount,
        amount_operation = EXCLUDED.amount_operation,
        amount_internal = EXCLUDED.amount_internal,
        accessory_characteristic = EXCLUDED.accessory_characteristic,
        phone = EXCLUDED.phone,
        delivery_area = EXCLUDED.delivery_area,
        shipping_address = EXCLUDED.shipping_address,
        coordinates = EXCLUDED.coordinates,
        address_fields = EXCLUDED.address_fields,
        vat_consider = EXCLUDED.vat_consider,
        vat_included = EXCLUDED.vat_included,
        settlements_course = EXCLUDED.settlements_course,
        settlements_multiplicity = EXCLUDED.settlements_multiplicity,
        extra_charge_external = EXCLUDED.extra_charge_external,
        obj_delivery_state = EXCLUDED.obj_delivery_state,
        category = EXCLUDED.category,
        production = EXCLUDED.production,
        extra_fields = EXCLUDED.extra_fields,
        contact_information = EXCLUDED.contact_information,
        planning = EXCLUDED.planning;`, [ref, doc._deleted, doc.posted, doc.date, leftPad(doc.number_doc || '', 11), (doc.number_internal || '').substr(0,20), doc.project, doc.organization, doc.partner, doc.client_of_dealer, doc.contract, doc.bank_account, doc.note, doc.manager, doc.leading_manager, doc.department, doc.warehouse,
      doc.doc_amount > 1e11 ? 1e11 : doc.doc_amount,
      doc.amount_operation > 1e11 ? 1e11 : doc.amount_operation,
      doc.amount_internal > 1e11 ? 1e11 : doc.amount_internal,
      doc.accessory_characteristic, doc.phone, doc.delivery_area, doc.shipping_address, doc.coordinates, doc.address_fields, doc.vat_consider, doc.vat_included, doc.settlements_course, doc.settlements_multiplicity, doc.extra_charge_external, doc.obj_delivery_state, doc.category,
      {rows: doc.production || []},
      {rows: doc.extra_fields || []},
      {rows: doc.contact_information || []},
      {rows: doc.planning || []}]);
  }
}

/*

-- Type: refs

drop TABLE doc_calc_order;

CREATE TABLE IF NOT EXISTS doc_calc_order (
	ref uuid PRIMARY KEY NOT NULL,
	_deleted boolean DEFAULT false,
	posted boolean DEFAULT false,
	date timestamp without time zone,
	number_doc character(11),
	number_internal character varying(20),
	project uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	organization uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	partner uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	client_of_dealer character varying(255),
	contract uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	bank_account uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	note character varying(255),
	manager uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	leading_manager uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	department uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	warehouse uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	doc_amount numeric(15,2),
	amount_operation numeric(15,2),
	amount_internal numeric(15,2),
	accessory_characteristic uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	phone character varying(100),
	delivery_area uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
	shipping_address character varying(255),
	coordinates character varying(50),
	address_fields text,
	vat_consider BOOLEAN,
	vat_included BOOLEAN,
	settlements_course numeric(10,4),
	settlements_multiplicity bigint,
	extra_charge_external numeric(5,2),
	obj_delivery_state character varying(100),
	category character varying(100),
	ts_production JSON,
	ts_extra_fields JSON,
	ts_contact_information JSON,
	ts_planning JSON)


 */


