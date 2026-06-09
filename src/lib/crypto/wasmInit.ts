import {getWasmUrl, initSync} from '@mtcute/wasm';

let initPromise: Promise<void> | undefined;

async function loadAndInit() {
  const url = getWasmUrl();

  if(typeof process !== 'undefined' && (process as any).versions?.node) {
    const {readFileSync} = await import('node:fs');
    const {fileURLToPath} = await import('node:url');
    initSync(readFileSync(fileURLToPath(url)));
    return;
  }

  const res = await fetch(url);
  initSync(new Uint8Array(await res.arrayBuffer()));
}

export function initCryptoWasm() {
  if(!initPromise) initPromise = loadAndInit();
  return initPromise;
}
