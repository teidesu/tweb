import { createCtr256, ctr256, freeCtr256, ige256Decrypt, ige256Encrypt, sha1 as wasmSha1, sha256 as wasmSha256 } from '@mtcute/wasm';
import type { RSAPublicKeyHex } from '@/lib/mtproto/rsaKeysManager';
import addPadding from '@/helpers/bytes/addPadding';
import bytesFromHex from '@/helpers/bytes/bytesFromHex';
import bytesModPow from '@/helpers/bytes/bytesModPow';
import convertToUint8Array from '@/helpers/bytes/convertToUint8Array';
import { gzipUncompress } from '@/helpers/gzip';
import getEmojisFingerprint from '@/lib/calls/helpers/getEmojisFingerprint';
import computeDhKey from '@/lib/crypto/computeDhKey';
import generateDh from '@/lib/crypto/generateDh';
import computeSRP from '@/lib/crypto/srp';
import factorizeBrentPollardPQ from '@/lib/crypto/utils/factorize/BrentPollard';
import subtle from '@/lib/crypto/subtle';
import SuperMessagePort from '@/lib/superMessagePort';

const LOCAL_IV_LENGTH = 12;
const aesCTRs = new Map<number, {enc: number, dec: number}>();
let lastCTRId = -1;

export const cryptoMethodsRegistry = {
  'sha1': (bytes: Parameters<typeof convertToUint8Array>[0]) => wasmSha1(convertToUint8Array(bytes)),
  'sha256': (bytes: Parameters<typeof convertToUint8Array>[0]) => wasmSha256(convertToUint8Array(bytes)),

  'pbkdf2': async(buffer: Parameters<SubtleCrypto['importKey']>[1], salt: HkdfParams['salt'], iterations: number) => {
    const importKey = await subtle.importKey('raw', buffer, { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: { name: 'SHA-512' } }, importKey, 512);
    return new Uint8Array(bits);
  },

  'aes-encrypt': (bytes: Uint8Array, keyBytes: Uint8Array, ivBytes: Uint8Array) =>
    ige256Encrypt(addPadding(bytes), keyBytes, ivBytes),
  'aes-decrypt': (bytes: Uint8Array, keyBytes: Uint8Array, ivBytes: Uint8Array) =>
    ige256Decrypt(bytes, keyBytes, ivBytes),

  'rsa-encrypt': (bytes: Uint8Array, publicKey: RSAPublicKeyHex) =>
    bytesModPow(bytes, bytesFromHex(publicKey.exponent), bytesFromHex(publicKey.modulus)),

  'factorize': factorizeBrentPollardPQ,
  'mod-pow': bytesModPow,
  'gzipUncompress': gzipUncompress,
  'computeSRP': computeSRP,
  'generate-dh': generateDh,
  'compute-dh-key': computeDhKey,
  'get-emojis-fingerprint': getEmojisFingerprint,

  'aes-ctr-prepare': ({ encKey, encIv, decKey, decIv }: {[k in 'encKey' | 'encIv' | 'decKey' | 'decIv']: Uint8Array}) => {
    const id = ++lastCTRId;
    aesCTRs.set(id, { enc: createCtr256(encKey, encIv), dec: createCtr256(decKey, decIv) });
    return id;
  },
  'aes-ctr-process': ({ id, data, operation }: {id: number, data: Uint8Array, operation: 'encrypt' | 'decrypt'}) => {
    const ctrs = aesCTRs.get(id);
    return ctr256(operation === 'encrypt' ? ctrs!.enc : ctrs!.dec, data);
  },
  'aes-ctr-destroy': (id: number) => {
    const ctrs = aesCTRs.get(id);
    if (!ctrs) return;
    freeCtr256(ctrs.enc);
    freeCtr256(ctrs.dec);
    aesCTRs.delete(id);
  },

  'aes-local-encrypt': async({ key, data }: {key: CryptoKey, data: Uint8Array}) => {
    const iv = crypto.getRandomValues(new Uint8Array(LOCAL_IV_LENGTH));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    return new SuperMessagePort.TransferableResult(combined, [combined.buffer]);
  },
  'aes-local-decrypt': async({ key, encryptedData }: {key: CryptoKey, encryptedData: Uint8Array}) => {
    const iv = encryptedData.slice(0, LOCAL_IV_LENGTH);
    const ciphertext = encryptedData.slice(LOCAL_IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext as BufferSource);
    return new SuperMessagePort.TransferableResult(decrypted, [decrypted]);
  },
};

export type CryptoMethods = typeof cryptoMethodsRegistry;
