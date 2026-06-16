import { CryptoMethods } from '@/lib/crypto/cryptoMethodsRegistry';
import SuperMessagePort from '@/lib/superMessagePort';
import { MOUNT_CLASS_TO } from '@/config/debug';
import { IS_WORKER } from '@/helpers/context';
import type { ThreadedWorkerEvents } from '@/lib/mainWorker/mainMessagePort';


type CryptoEvent = {
  invoke: <T extends keyof CryptoMethods>(payload: {method: T, args: Parameters<CryptoMethods[T]>}) =>
    SuperMessagePort.TransferableResultValue<ReturnType<CryptoMethods[T]>>,
  port: (payload: void, source: MessageEventSource, event: MessageEvent) => void,
  terminate: () => void
} & ThreadedWorkerEvents;

export class CryptoMessagePort<Master extends boolean = false> extends SuperMessagePort<CryptoEvent, CryptoEvent, Master> {
  private lastIndex: number;

  constructor() {
    super('CRYPTO');
    this.lastIndex = -1;
  }

  // TODO: Transfer transferables on result tasks?
  public invokeCryptoNew<T extends keyof CryptoMethods>({ method, args, transfer }: {
    method: T,
    args: Parameters<CryptoMethods[T]>,
    transfer?: Transferable[]
  }): Promise<Awaited<SuperMessagePort.TransferableResultValue<ReturnType<CryptoMethods[T]>>>> {
    const payload = { method, args };
    const listeners = this.listeners['invoke'];
    if (listeners?.size) { // already in worker
      const callback = listeners.values().next().value!.callback;
      if (this.readyPromise) {
        return this.readyPromise.then(() => callback(payload) as any);
      }

      let result: any = callback(payload);
      if (!IS_WORKER && !(result instanceof Promise)) {
        result = Promise.resolve(result);
      }

      return result;
    }

    const sendPortIndex = method === 'aes-encrypt' || method === 'aes-decrypt' ?
      this.lastIndex = (this.lastIndex + 1) % this.sendPorts.length :
      0;
    // @ts-ignore
    return this.invoke('invoke', payload, undefined, this.sendPorts[sendPortIndex], transfer);
  }

  public invokeCrypto<T extends keyof CryptoMethods>(method: T, ...args: Parameters<CryptoMethods[T]>) {
    return this.invokeCryptoNew({ method, args });
  }

  public sendToOnePort(port: MessagePort) {
    this.invokeVoid('port', undefined, this.sendPorts[0], [port]);
  }
}

const cryptoMessagePort = new CryptoMessagePort<false>();
MOUNT_CLASS_TO && (MOUNT_CLASS_TO.cryptoMessagePort = cryptoMessagePort);
export default cryptoMessagePort;
