import cryptoWorker from '@/lib/crypto/cryptoMessagePort';
import { AccountPassword, InputCheckPasswordSRP, PasswordKdfAlgo } from '@/layer';
import addPadding from '@/helpers/bytes/addPadding';
import bufferConcats from '@/helpers/bytes/bufferConcats';
import bytesXor from '@/helpers/bytes/bytesXor';
import convertToUint8Array from '@/helpers/bytes/convertToUint8Array';
import bigInt from 'big-integer';
import { bigIntFromBytes, bigIntToBytes } from '@/helpers/bigInt/bigIntConversion';
import bytesToHex from '@/helpers/bytes/bytesToHex';
import { randomBytes } from '@/helpers/random';
import { verifyDhPrimeAndGenerator } from '@/lib/crypto/dhValidation';

export async function makePasswordHash(password: string, client_salt: Uint8Array, server_salt: Uint8Array) {
  // ! look into crypto_methods.test.ts
  let buffer = await cryptoWorker.invokeCrypto('sha256', bufferConcats(client_salt, new TextEncoder().encode(password), client_salt));
  buffer = bufferConcats(server_salt, buffer, server_salt);
  buffer = await cryptoWorker.invokeCrypto('sha256', buffer);

  let hash = await cryptoWorker.invokeCrypto('pbkdf2', new Uint8Array(buffer), client_salt as BufferSource, 100000);
  hash = bufferConcats(server_salt, hash, server_salt);

  buffer = await cryptoWorker.invokeCrypto('sha256', hash);

  return buffer;
}

export default async function computeSRP(password: string, state: AccountPassword, isNew: boolean): Promise<Uint8Array | InputCheckPasswordSRP.inputCheckPasswordSRP> {
  const algo = (isNew ? state.new_algo : state.current_algo) as PasswordKdfAlgo.passwordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow;

  const p = bigIntFromBytes(algo.p);
  const g = bigInt(algo.g);

  verifyDhPrimeAndGenerator(algo.p, algo.g);

  const pw_hash = await makePasswordHash(password, algo.salt1, algo.salt2);
  const x = bigInt(bytesToHex(pw_hash), 16);

  const padArray = function(arr: number[] | Uint8Array, len: number) {
    if (!(arr instanceof Uint8Array)) {
      arr = convertToUint8Array(arr);
    }

    return addPadding(arr, len, true, true, true);
  };

  const v = g.modPow(x, p);

  // * https://core.telegram.org/api/srp#setting-a-new-2fa-password
  if (isNew) {
    const bytes = bigIntToBytes(v);
    return padArray(bytes, 256);
  }

  if (state.srp_B!.length < 248 || state.srp_B!.length > 256) {
    throw new Error('[SRP] invalid srp_B length: ' + state.srp_B!.length);
  }

  const B = bigIntFromBytes(state.srp_B!);
  if (!B.greater(bigInt.zero) || !B.lesser(p)) {
    throw new Error('[SRP] srp_B out of range');
  }

  const pForHash = padArray(bigIntToBytes(p), 256);
  const gForHash = padArray(bigIntToBytes(g), 256);
  const b_for_hash = padArray(bigIntToBytes(B), 256);

  const kHash = await cryptoWorker.invokeCrypto('sha256', bufferConcats(pForHash, gForHash));
  const k = bigIntFromBytes(kHash);

  const k_v = k.multiply(v).mod(p);

  const a = bigIntFromBytes(randomBytes(256));
  const A = g.modPow(a, p);
  const a_for_hash = padArray(bigIntToBytes(A), 256);

  const s = await cryptoWorker.invokeCrypto('sha256', bufferConcats(a_for_hash, b_for_hash));
  const u = bigIntFromBytes(s);

  let g_b: bigInt.BigInteger;
  if (!B.greater(k_v)) {
    g_b = B.add(p);
  } else g_b = B;
  g_b = g_b.subtract(k_v).mod(p);

  const ux = u.multiply(x);
  const a_ux = a.add(ux);
  const S = g_b.modPow(a_ux, p);

  const K = await cryptoWorker.invokeCrypto('sha256', padArray(bigIntToBytes(S), 256));

  let h1 = await cryptoWorker.invokeCrypto('sha256', pForHash);
  const h2 = await cryptoWorker.invokeCrypto('sha256', gForHash);
  h1 = bytesXor(h1, h2);

  const buff = bufferConcats(
    h1,
    await cryptoWorker.invokeCrypto('sha256', algo.salt1),
    await cryptoWorker.invokeCrypto('sha256', algo.salt2),
    a_for_hash,
    b_for_hash,
    K
  );

  const M1 = await cryptoWorker.invokeCrypto('sha256', buff);

  const out: InputCheckPasswordSRP.inputCheckPasswordSRP = {
    _: 'inputCheckPasswordSRP',
    srp_id: state.srp_id!,
    A: new Uint8Array(a_for_hash),
    M1,
  };

  return out;
}
