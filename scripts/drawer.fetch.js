/**
 * Копирует dev-версию файлов в node_modules (для отладки библиотек)
 */

const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const github = 'https://raw.githubusercontent.com/oknosoft/windowbuilder/master/';
const localSrc = path.resolve(__dirname, '../node_modules');

fetch(github + 'public/dist/drawer.js')
  .then(res => {
    const dest = fs.createWriteStream(path.resolve(localSrc, './windowbuilder/drawer.js'));
    res.body.pipe(dest);
    return fetch(github + 'src/metadata/init.js')
  })
  .then(res => {
    const dest = fs.createWriteStream(path.resolve(localSrc, './windowbuilder/init.js'));
    res.body.pipe(dest);
  })
  .then(() => {
    console.log(`all done`);
  })
  .catch((err) => {
    console.error(err)
  });
