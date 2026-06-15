// Generate the electron-builder desktop icons (icon.png + icon.icns) from the
// glyph SVG, all in this dir.
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

const glyph = readFileSync(join(dir, 'icon.svg'), 'utf8');
const viewBox = glyph.match(/viewBox\s*=\s*"\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*"/);
if (!viewBox) throw new Error('icon.svg missing viewBox starting at 0 0');
const vbSize = Math.max(Number(viewBox[1]), Number(viewBox[2]));
const scale = SIZE / vbSize;
const inner = glyph.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();

const full = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="${SIZE}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="${BG_FROM}"/>
<stop offset="1" stop-color="${BG_TO}"/>
</linearGradient>
</defs>
<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
<g transform="scale(${scale})">
${inner}
</g>
</svg>
`;

function run(cmd, args, opts) {
  const res = spawnSync(cmd, args, {stdio: ['pipe', 'inherit', 'inherit'], ...opts});
  if (res.status !== 0) throw new Error(`${cmd} failed (${res.status ?? res.error})`);
}

const pngPath = join(dir, 'icon.png');
run('magick', ['-background', 'none', 'svg:-', '-resize', `${SIZE}x${SIZE}`, `PNG32:${pngPath}`], {input: full});
console.log('wrote assets/desktop-icon/icon.png');

if (process.platform !== 'darwin') {
  console.log('[build-app-icon] skipping .icns (needs macOS iconutil)');
  process.exit(0);
}

const iconset = join(dir, 'icon.iconset');
mkdirSync(iconset, {recursive: true});
for (const s of [16, 32, 128, 256, 512]) {
  run('magick', [pngPath, '-resize', `${s}x${s}`, `PNG32:${join(iconset, `icon_${s}x${s}.png`)}`]);
  run('magick', [pngPath, '-resize', `${s * 2}x${s * 2}`, `PNG32:${join(iconset, `icon_${s}x${s}@2x.png`)}`]);
}
run('iconutil', ['-c', 'icns', iconset, '-o', join(dir, 'icon.icns')]);
rmSync(iconset, {recursive: true, force: true});
console.log('wrote assets/desktop-icon/icon.icns');
