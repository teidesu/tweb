import { getWasmUrl, initSync } from '@mtcute/wasm';
import pause from '@helpers/schedulers/pause';

let initPromise: Promise<void> | undefined;

async function load() {
  const url = getWasmUrl();

  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    initSync(readFileSync(fileURLToPath(url)));
    return;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to fetch crypto wasm (HTTP ${res.status}): ${url}`);
  }

  initSync(new Uint8Array(await res.arrayBuffer()));
}

// A transient fetch failure at worker boot (dev server restarting, flaky
// network) must not permanently poison the realm — everything gated on
// deferInvokesUntil(initCryptoWasm()) would fail until the worker restarts,
// and shared workers can outlive tabs by days. Retry with backoff before
// settling the cached promise with a rejection.
async function loadAndInit() {
  const maxAttempts = 5;
  for (let attempt = 1, delay = 1e3; ; ++attempt, delay *= 2) {
    try {
      await load();
      return;
    } catch (err) {
      console.error(`[wasmInit] init failed (attempt ${attempt}/${maxAttempts})`, err);
      if (attempt >= maxAttempts) {
        throw err;
      }

      await pause(delay);
    }
  }
}

export function initCryptoWasm() {
  return initPromise ??= loadAndInit();
}
