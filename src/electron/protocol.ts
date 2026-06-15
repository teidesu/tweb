import { protocol, net } from 'electron';
import { join, normalize, extname, sep } from 'path';
import { pathToFileURL } from 'url';
import { APP_SCHEME, DIST_DIR } from './constants';

// net.fetch(file://) doesn't reliably set Content-Type; the app's module scripts
// and wasm won't run without a correct type, so we patch it from the extension.
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

export function registerAppSchemeAsPrivileged() {
  protocol.registerSchemesAsPrivileged([{
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  }]);
}

export function handleAppScheme() {
  protocol.handle(APP_SCHEME, async(request) => {
    const { pathname } = new URL(request.url);
    let rel = decodeURIComponent(pathname);
    if (rel === '/' || rel === '') rel = '/index.html';

    // resolve inside DIST_DIR and guard against path traversal
    const filePath = normalize(join(DIST_DIR, rel));
    if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    const res = await net.fetch(pathToFileURL(filePath).href);
    const mime = MIME[extname(filePath).toLowerCase()];
    if (!mime) return res;

    const headers = new Headers(res.headers);
    headers.set('content-type', mime);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  });
}
