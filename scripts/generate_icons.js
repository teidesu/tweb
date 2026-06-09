// @ts-check
// Generates the `tgico` webfont from assets/icons/*.svg using fantasticon,
// then emits src/icons.ts, the tgico scss partials and copies the fonts.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets/icons');
const FONTS_DIR = path.join(ROOT, 'public/assets/fonts');
const ICONS_TS = path.join(ROOT, 'src/icons.ts');
const SCSS_DIR = path.join(ROOT, 'src/scss/tgico');
const OUT_DIR = path.join(__dirname, 'out/icons');

const FONT_NAME = 'tgico';
const START_CODEPOINT = 0xe900; // matches the historical icomoon resetPoint
const FONT_TYPES = ['ttf', 'woff', 'svg'];

// source svg files whose name differs from the icon name they carry in the font
// (carried over from the old icomoon set, where names were assigned in its UI)
const NAME_MAP = {
  '1check': 'check1',
  '2checks': 'checks'
};
const iconName = basename => NAME_MAP[basename] || basename;

// reuse existing codepoints so regenerating with an unchanged icon set is a no-op diff
function readExistingCodepoints() {
  const map = {};
  if(!fs.existsSync(ICONS_TS)) return map;
  const ts = fs.readFileSync(ICONS_TS, 'utf8');
  for(const m of ts.matchAll(/^ {2}([a-z0-9_]+): '([0-9a-f]+)'/gim)) {
    map[m[1]] = parseInt(m[2], 16);
  }
  return map;
}

function assignCodepoints(names) {
  const existing = readExistingCodepoints();
  const used = new Set();
  /** @type {Record<string, number>} */
  const codepoints = {};
  for(const name of names) {
    const cp = existing[name];
    if(cp !== undefined) {
      codepoints[name] = cp;
      used.add(cp);
    }
  }
  let next = START_CODEPOINT;
  for(const name of names) {
    if(codepoints[name] !== undefined) continue;
    while(used.has(next)) next++;
    used.add(next);
    codepoints[name] = next;
  }
  return codepoints;
}

function writeIconsTs(ordered, codepoints) {
  const body = ordered.map(name => `  ${name}: '${codepoints[name].toString(16)}'`).join(',\n');
  fs.writeFileSync(ICONS_TS, `const Icons = {\n${body}\n};\n\nexport default Icons;\n`);
}

function writeVariablesScss(ordered, codepoints) {
  const body = ordered.map(name => `$tgico-${name}: "\\${codepoints[name].toString(16)}";`).join('\n');
  fs.writeFileSync(path.join(SCSS_DIR, '_variables.scss'), `${body}\n\n`);
}

function writeStyleScss(hash) {
  const q = `?${hash}`;
  fs.writeFileSync(path.join(SCSS_DIR, '_style.scss'), `@use "variables" as *;
@use "../variables" as *;

@font-face {
  font-family: '#{$tgico-font-family}';
  src:
    url('#{$tgico-font-path}/#{$tgico-font-family}.ttf${q}') format('truetype'),
    url('#{$tgico-font-path}/#{$tgico-font-family}.woff${q}') format('woff'),
    url('#{$tgico-font-path}/#{$tgico-font-family}.svg${q}##{$tgico-font-family}') format('svg');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

.tgico {
  /* use !important to prevent issues with browser extensions that change fonts */
  font-family: '#{$tgico-font-family}' !important;
  speak: never;
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;

  /* Better Font Rendering =========== */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`);
}

async function main() {
  const {generateFonts} = await import('fantasticon');

  const names = fs.readdirSync(INPUT_DIR)
  .filter(file => file.endsWith('.svg'))
  .map(file => iconName(path.basename(file, '.svg')));

  const codepoints = assignCodepoints(names);
  const ordered = names.slice().sort((a, b) => codepoints[a] - codepoints[b]);

  fs.rmSync(OUT_DIR, {recursive: true, force: true});
  fs.mkdirSync(OUT_DIR, {recursive: true});

  const result = await generateFonts({
    name: FONT_NAME,
    inputDir: INPUT_DIR,
    outputDir: OUT_DIR,
    // @ts-ignore string values match the FontAssetType enum
    fontTypes: FONT_TYPES,
    assetTypes: [], // ts/scss are emitted by this script in the project's own format
    normalize: true,
    // icomoon fit each icon into the em box (by its larger dimension) and centered
    // it; without preserveAspectRatio wide icons (e.g. transcribe 36x18) scale by
    // height and overflow the em 2x, without centering short icons sit on baseline.
    // @ts-ignore these are consumed by svgicons2svgfont (fantasticon spreads svg.*)
    formatOptions: {svg: {preserveAspectRatio: true, centerHorizontally: true, centerVertically: true}},
    fontHeight: 1024, // historical icomoon emSize
    descent: 0,
    codepoints,
    getIconId: ({basename}) => iconName(basename)
  });

  writeIconsTs(ordered, codepoints);
  writeVariablesScss(ordered, codepoints);

  const hash = crypto.createHash('md5')
  .update(fs.readFileSync(path.join(OUT_DIR, `${FONT_NAME}.ttf`)))
  .digest('hex')
  .slice(0, 6);
  writeStyleScss(hash);

  fs.mkdirSync(FONTS_DIR, {recursive: true});
  for(const type of FONT_TYPES) {
    fs.copyFileSync(path.join(OUT_DIR, `${FONT_NAME}.${type}`), path.join(FONTS_DIR, `${FONT_NAME}.${type}`));
  }

  console.log(`Generated ${Object.keys(result.codepoints).length} icons.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
