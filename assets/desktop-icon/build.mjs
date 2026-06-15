// Generate the electron-builder desktop icons from the glyph SVG, all in this
// dir: icon.png (full-bleed square, for Linux/Windows) and icon.icns (macOS
// squircle with Apple's standard padding, since macOS doesn't auto-round).
// Re-run after changing the glyph: `node assets/desktop-icon/build.mjs`.
// Requires ImageMagick (`magick`) and, for the .icns, macOS `iconutil`.
import {spawnSync} from 'child_process';
import {mkdirSync, readFileSync, rmSync} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

const dir = dirname(fileURLToPath(import.meta.url));

const SIZE = 1024;
const BG_FROM = '#D4A3FF';
const BG_TO = '#D59EFF';
// Apple macOS icon grid (Big Sur+): content squircle is 824px centered in a
// 1024 canvas (100px margin), continuous-rounded with ~185px corner radius.
const MAC_CONTENT = 824;
const MAC_MARGIN = (SIZE - MAC_CONTENT) / 2;
const MAC_RADIUS = 185;

const glyph = readFileSync(join(dir, 'icon.svg'), 'utf8');
const viewBox = glyph.match(/viewBox\s*=\s*"\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*"/);
if (!viewBox) throw new Error('icon.svg missing viewBox starting at 0 0');
const vbSize = Math.max(Number(viewBox[1]), Number(viewBox[2]));
const inner = glyph.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();

// box: {size, offset, radius} — the gradient-filled background; the glyph is
// scaled to fill it and centered. radius 0 → full-bleed square.
function buildSvg({size, offset, radius}) {
  const scale = size / vbSize;
  const bg = radius
    ? `<rect x="${offset}" y="${offset}" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#bg)"/>`
    : `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>`;
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="bg" x1="0" y1="${offset}" x2="0" y2="${offset + size}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="${BG_FROM}"/>
<stop offset="1" stop-color="${BG_TO}"/>
</linearGradient>
</defs>
${bg}
<g transform="translate(${offset} ${offset}) scale(${scale})">
${inner}
</g>
</svg>
`;
}

function run(cmd, args, opts) {
  const res = spawnSync(cmd, args, {stdio: ['pipe', 'inherit', 'inherit'], ...opts});
  if (res.status !== 0) throw new Error(`${cmd} failed (${res.status ?? res.error})`);
}

function render(svg, out) {
  run('magick', ['-background', 'none', 'svg:-', '-resize', `${SIZE}x${SIZE}`, `PNG32:${out}`], {input: svg});
}

const square = buildSvg({size: SIZE, offset: 0, radius: 0});
const pngPath = join(dir, 'icon.png');
render(square, pngPath);
console.log('wrote assets/desktop-icon/icon.png');

if (process.platform !== 'darwin') {
  console.log('[build-app-icon] skipping .icns (needs macOS iconutil)');
  process.exit(0);
}

const macSvg = buildSvg({size: MAC_CONTENT, offset: MAC_MARGIN, radius: MAC_RADIUS});
const macPng = join(dir, 'icon-mac.png');
render(macSvg, macPng);

const iconset = join(dir, 'icon.iconset');
mkdirSync(iconset, {recursive: true});
for (const s of [16, 32, 128, 256, 512]) {
  run('magick', [macPng, '-resize', `${s}x${s}`, `PNG32:${join(iconset, `icon_${s}x${s}.png`)}`]);
  run('magick', [macPng, '-resize', `${s * 2}x${s * 2}`, `PNG32:${join(iconset, `icon_${s}x${s}@2x.png`)}`]);
}
run('iconutil', ['-c', 'icns', iconset, '-o', join(dir, 'icon.icns')]);
rmSync(iconset, {recursive: true, force: true});
rmSync(macPng, {force: true});
console.log('wrote assets/desktop-icon/icon.icns');
