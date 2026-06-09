const fs = require('fs');
const path = require('path');
const {formatLang} = require('./format_lang.js');

const SRC_DIR = path.join(__dirname, '..', 'src');
const LANG_FILES = [path.join(SRC_DIR, 'lang.ts'), path.join(SRC_DIR, 'langSign.ts')];
const VERSION_FILE = path.join(SRC_DIR, 'langPackLocalVersion.ts');

const readVersion = () => {
  try {
    const m = fs.readFileSync(VERSION_FILE, 'utf8').match(/const langPackLocalVersion = (\d+);/);
    return m ? parseInt(m[1]) : 0;
  } catch {
    return 0;
  }
};

const writeVersion = (v) => {
  fs.writeFileSync(VERSION_FILE, `const langPackLocalVersion = ${v};export default langPackLocalVersion;\n`, 'utf8');
};

const bumpAndFormat = () => {
  const v = readVersion() + 1;
  writeVersion(v);
  try {
    formatLang();
    console.log(`[lang] version=${v}, langPack.strings regenerated`);
  } catch(e) {
    console.error('[lang] format failed:', e.message);
  }
};

module.exports = function langPlugin() {
  let ran = false;
  return {
    name: 'tweb-lang',
    buildStart() {
      if(ran) return;
      ran = true;
      bumpAndFormat();
    },
    configureServer(server) {
      let timer = null;
      const schedule = () => {
        if(timer) clearTimeout(timer);
        timer = setTimeout(bumpAndFormat, 150);
      };
      server.watcher.on('change', (file) => {
        if(LANG_FILES.includes(path.resolve(file))) schedule();
      });
    }
  };
};
