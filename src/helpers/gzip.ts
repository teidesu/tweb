import {deflateMaxSize, gunzip} from '@mtcute/wasm';

export function gzipCompress(bytes: Uint8Array, maxSize: number = bytes.length): Uint8Array | null {
  return deflateMaxSize(bytes, maxSize);
}

export function gzipUncompress(bytes: ArrayBuffer, toString?: boolean, maxSize?: number): string | Uint8Array {
  const input = new Uint8Array(bytes);

  if(maxSize !== undefined && input.length >= 4) {
    const v = new DataView(input.buffer, input.byteOffset + input.length - 4, 4);
    const isize = v.getUint32(0, true);
    if(isize > maxSize) throw new Error('GZIP_MAX_SIZE_EXCEEDED');
  }

  const result = gunzip(input);

  if(maxSize !== undefined && result.length > maxSize) {
    throw new Error('GZIP_MAX_SIZE_EXCEEDED');
  }

  return toString ? new TextDecoder().decode(result) : result;
}
