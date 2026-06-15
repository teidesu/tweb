// Build the Rust native addon (native/) into dist-electron/native/.
// macOS-only: it provides raw trackpad gesture phases for swipe-to-reply; on
// other platforms there's nothing to build and the renderer never loads it.
import {spawnSync} from 'child_process';
import {mkdirSync, rmSync} from 'fs';
import {dirname, join, relative} from 'path';
import {fileURLToPath} from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform !== 'darwin') {
  console.log('[build-native] skipped (non-darwin)');
  process.exit(0);
}

const crateDir = join(root, 'native');
const outDir = join(root, 'dist-electron', 'native');
mkdirSync(outDir, {recursive: true});

const napi = join(root, 'node_modules', '.bin', 'napi');
// --no-js: skip the JS binding shim (we require the .node by explicit path).
// -o places the .node (and a generated .d.ts) in outDir, relative to --cwd.
const res = spawnSync(napi, [
  'build', '--platform', '--release', '--no-js', '-o', relative(crateDir, outDir)
], {
  cwd: crateDir,
  stdio: 'inherit'
});

if (res.status === 0) {
  // we load the .node by explicit path; drop the leftover type-def shim.
  rmSync(join(outDir, 'index.d.ts'), {force: true});
}

process.exit(res.status ?? 1);
