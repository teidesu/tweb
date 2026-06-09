// eslint-disable-next-line spaced-comment
/// <reference types="vitest/config" />
import {defineConfig, ServerOptions} from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths';
import {visualizer} from 'rollup-plugin-visualizer';
import checker from 'vite-plugin-checker';
import autoprefixer from 'autoprefixer';
import {existsSync, copyFileSync, readFileSync} from 'fs';
import {resolve, join} from 'path';
import {watchLangFile} from './scripts/watch-lang.js';

const rootDir = resolve(__dirname);
const certsDir = join(rootDir, 'certs');
const ENV_LOCAL_FILE_PATH = join(rootDir, '.env.local');
const LANG_PACK_LOCAL_FILE_PATH = join(rootDir, 'src', 'langPackLocalVersion.ts');

const isDEV = process.env.NODE_ENV === 'development';
if(!existsSync(LANG_PACK_LOCAL_FILE_PATH)) {
  copyFileSync(join(rootDir, 'src', 'langPackLocalVersion.example.ts'), LANG_PACK_LOCAL_FILE_PATH);
}

if(isDEV) {
  if(!existsSync(ENV_LOCAL_FILE_PATH)) {
    copyFileSync(join(rootDir, '.env.local.example'), ENV_LOCAL_FILE_PATH);
  }

  watchLangFile();
}

const indexHtmlVars: Record<string, string> = {
  title: 'Telegram Web',
  description: 'Telegram is a cloud-based mobile and desktop messaging app with a focus on security and speed.',
  url: 'https://web.telegram.org/k/',
  origin: 'https://web.telegram.org/'
};

// HTTP/2 for `pnpm start`. Vite serves dev modules unbundled — one request per module —
// and over http/1.1 the browser's ~6-connections-per-origin cap serialises the hundreds
// of module requests into a slow waterfall (lots of "pending"). Enabling https flips the
// dev server to HTTP/2, which multiplexes them all over one connection and kills the
// waterfall. Use mkcert, NOT a self-signed cert: tweb's ServiceWorker refuses to register
// on an untrusted cert. One-time setup:  mkcert -install && (cd certs && mkcert localhost)
// Auto-enabled once the cert exists; off under TWEB_PREVIEW (the merged preview config
// must stay on http for its tooling) and off until the cert is present (no cert → today's
// plain-http dev, unchanged).
const DEV_HTTP2_KEY = join(certsDir, 'localhost-key.pem');
const DEV_HTTP2_CERT = join(certsDir, 'localhost.pem');
const USE_DEV_HTTP2 = !process.env.TWEB_PREVIEW && !process.env.VITEST &&
  existsSync(DEV_HTTP2_KEY) && existsSync(DEV_HTTP2_CERT);

const serverOptions: ServerOptions = {
  host: 'localhost',
  port: 8080,
  watch: {
    // NB: anchor on rootDir. A worktree checkout's own path contains
    // ".claude/worktrees/<name>/", so a bare '**/.claude/**' glob would also match
    // the worktree's OWN src and silently disable all HMR there. Anchoring ignores
    // only this checkout's .claude (and, from the main repo, the worktrees inside it).
    ignored: [resolve(rootDir, '.claude') + '/**']
  },
  sourcemapIgnoreList(sourcePath) {
    return sourcePath.includes('node_modules') ||
      sourcePath.includes('logger') ||
      sourcePath.includes('eventListenerBase');
  },
  https: USE_DEV_HTTP2 ? {
    key: readFileSync(DEV_HTTP2_KEY),
    cert: readFileSync(DEV_HTTP2_CERT)
  } : undefined
};

export default defineConfig({
  plugins: [
    process.env.VITEST || process.env.TWEB_PREVIEW ? undefined : checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
        useFlatConfig: true,
        // Only watch src/ for re-lint. The checker's default watchTarget is the project
        // ROOT, and its ignore filter skips files but never directories — so chokidar
        // descends into the .claude git worktrees (~40k dirs) and crashes the dev server
        // with "EMFILE: too many open files, watch" on macOS. The lint glob is src-only.
        watchPath: 'src'
      }
    }),
    tsconfigPaths(),
    solidPlugin(),
    {
      name: 'tweb-index-html-vars',
      transformIndexHtml(html: string) {
        return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => indexHtmlVars[key] ?? '');
      }
    },
    // Only emit the bundle treemap (stats.html) when explicitly analyzing (ANALYZE=1):
    // it adds build time and writes a ~1.3MB file that otherwise gets globbed into the
    // dep scan. Run `ANALYZE=1 pnpm build` to generate it.
    process.env.ANALYZE ? visualizer({
      gzipSize: true,
      template: 'treemap'
    }) : undefined
  ].filter(Boolean),
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // git worktrees live here with their own copies of every test file —
      // without this, `pnpm test <pattern>` runs each match N+1 times at once
      '**/.claude/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    environment: 'jsdom',
    pool: 'forks',
    globals: true,
    setupFiles: ['./src/tests/setup.ts']
  },
  server: serverOptions,
  base: '',
  // Pin the dep-optimizer's scan to the real entry (index.html → src/index.ts).
  // Otherwise Vite auto-globs every *.html (stats.html, icomoon demo.html) as scan
  // entries, and a parse error in any of them aborts the whole scan and disables
  // dependency pre-bundling — making cold dev loads slow and reload-prone.
  optimizeDeps: {
    entries: ['index.html']
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsDir: '',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        sourcemapIgnoreList: serverOptions.sourcemapIgnoreList
      }
    }
  },
  worker: {
    format: 'es',
    plugins: () => [tsconfigPaths()]
  },
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [
        autoprefixer({})
      ]
    }
  }
});
