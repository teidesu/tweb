const fs = require('fs');
const path = require('path');

const f = (key, value, plural) => {
  value = value
  .replace(/\n/g, '\\n')
  .replace(/"/g, '\\"');
  return `"${key}${plural ? '_' + plural.replace('_value', '') : ''}" = "${value}";\n`;
};

const formatLang = () => {
  let out = '';

  ['lang', 'langSign'].forEach(part => {
    const filePath = path.join(__dirname, `../src/${part}.ts`);

    let str = fs.readFileSync(filePath).toString()
    .replace(/\s+\/\/.+/g, '')
    .replace(/"/g, `\\"`)
    .replace(/([^\\])'/g, '$1"')
    .replace(/\\'/g, '\'');
    {
      const pattern = '= {';
      str = str.slice(str.indexOf(pattern) + pattern.length - 1);
    }

    {
      const pattern = '};';
      str = str.slice(0, str.indexOf(pattern) + pattern.length - 1);
    }

    const json = JSON.parse(str);

    for(const key in json) {
      const value = json[key];
      if(typeof(value) === 'string') {
        out += f(key, value);
      } else {
        for(const plural in value) {
          out += f(key, value[plural], plural);
        }
      }
    }
  });

  fs.writeFileSync(path.join(__dirname, './out/langPack.strings'), out);
};

module.exports = {formatLang};

if(require.main === module) {
  formatLang();
}
