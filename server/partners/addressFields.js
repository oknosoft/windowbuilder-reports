

module.exports = function addressFields(address, contact_information_kinds) {
  const {value, unrestricted_value, data: {country, ...other}} = address;
  const addrJSON = {
    version: 4,
    value: unrestricted_value || value,
    type: "Адрес",
    country: "РОССИЯ",
    addressType: "ВСвободнойФорме",
    countryCode: "643",
    ...other,
  };
  return {
    type: 'Адрес',
    kind: contact_information_kinds.predefined('ЮрАдресКонтрагента'),
    country: 'РОССИЯ',
    region: other.region_with_type || other.region,
    city: other.city_with_type || other.city,
    presentation: unrestricted_value || value,
    values_fields: `<КонтактнаяИнформация
    xmlns="http://www.v8.1c.ru/ssl/contactinfo"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    Представление="${unrestricted_value || value}">
    <Состав xsi:type="Адрес" Страна="РОССИЯ"><Состав xsi:type="АдресРФ"/></Состав>
</КонтактнаяИнформация>`,
    value: JSON.stringify(addrJSON, null, '\t'),
  };
}
