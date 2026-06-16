import { DEBUG } from '@/config/debug';

export default function makeError(type: ErrorType, message?: string): ApiError {
  const error = { type } as ApiError;
  if (message) {
    error.message = message;
  }

  if (DEBUG) {
    const realError = new Error();
    Object.defineProperty(error, 'stack', {
      configurable: true,
      enumerable: true,
      value: realError.stack,
    });
  }

  return error;
}
