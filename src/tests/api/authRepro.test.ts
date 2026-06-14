import type {DcId} from '@types';
import {installNodeEnv} from './nodeEnv';
import {registerInlineCrypto} from './inlineCrypto';

// repro: new auth key handshake fails with -404 after @mtcute/wasm migration
test.skipIf(process.env.TG_API_TEST !== '1')('auth key handshake', async() => {
  installNodeEnv();
  registerInlineCrypto();

  const {initCryptoWasm} = await import('@lib/crypto/wasmInit');
  await initCryptoWasm();

  const RealWS = globalThis.WebSocket;
  Object.defineProperty(globalThis, 'WebSocket', {configurable: true, writable: true, value: class extends (RealWS as any) {
    constructor(url: string, protocol?: string) {
      console.log('[ws] connecting', url, protocol);
      super(url, protocol);
      this.addEventListener('open', () => console.log('[ws] open', url));
      this.addEventListener('close', (e: any) => console.log('[ws] close', url, e?.code, e?.reason));
      this.addEventListener('error', (e: any) => console.log('[ws] error', url, e?.message || e?.error?.message));
      this.addEventListener('message', (e: any) => console.log('[ws] message', e?.data?.byteLength ?? e?.data?.length));
    }
    send(data: any) {
      console.log('[ws] send', data?.byteLength ?? data?.length);
      super.send(data);
    }
  }});

  await import('@lib/polyfill');

  const {Authorizer} = await import('@lib/mtproto/authorizer');
  const {TimeManager} = await import('@lib/mtproto/timeManager');
  const {DcConfigurator} = await import('@lib/mtproto/dcConfigurator');

  const authorizer = new Authorizer({
    timeManager: new TimeManager(),
    dcConfigurator: new DcConfigurator()
  });

  const auth = await authorizer.auth(2 as DcId, false);
  console.log('auth ok, key id', auth.authKey!.id);
  expect(auth.authKey).toBeTruthy();
}, 60_000);
