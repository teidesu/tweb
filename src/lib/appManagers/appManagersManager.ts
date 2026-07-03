import ServiceMessagePort from '@/lib/serviceWorker/serviceMessagePort';
import App from '@/config/app';
import { MOUNT_CLASS_TO } from '@/config/debug';
import callbackify from '@/helpers/callbackify';
import deferredPromise, { CancellablePromise } from '@/helpers/cancellablePromise';
import cryptoMessagePort from '@/lib/crypto/cryptoMessagePort';
import rlottieMessagePort from '@/lib/rlottie/rlottieMessagePort';
import MTProtoMessagePort from '@/lib/mainWorker/mainMessagePort';
import { AppStoragesManager } from '@/lib/appManagers/appStoragesManager';
import createManagers from '@/lib/appManagers/createManagers';
import { ActiveAccountNumber } from '@/lib/accounts/types';
import AppStateManager from '@/lib/appManagers/appStateManager';
import rootScope from '@/lib/rootScope';
import AccountController from '@/lib/accounts/accountController';
import pushSingleManager from '@/lib/appManagers/pushSingleManager';
import Modes from '@/config/modes';
import SuperMessagePort from '@/lib/superMessagePort';

type Managers = Awaited<ReturnType<typeof createManagers>>;

// for testing cases without video streaming
const CAN_USE_SERVICE_WORKER = !Modes.noServiceWorker;

type ManagersByAccount = Record<ActiveAccountNumber, Managers>;
type StateManagersByAccount = Record<ActiveAccountNumber, AppStateManager>;

type ThreadedSharedWorker = {
  urls: string[],
  attached: number,
  promise: CancellablePromise<void> | undefined,
  superMessagePort?: SuperMessagePort<any, any, any>,
  threads: number
};

export const THREADED_WORKERS_TYPES = ['crypto', 'rlottie'] as const;
export type ThreadedWorkerType = typeof THREADED_WORKERS_TYPES[number];

export class AppManagersManager {
  private managersByAccount: Partial<ManagersByAccount> = {};
  private managersByAccountPromises: Partial<Record<ActiveAccountNumber, Promise<Managers>>> = {};
  public readonly stateManagersByAccount: StateManagersByAccount;
  private threadedSharedWorkers: {[type in ThreadedWorkerType]?: ThreadedSharedWorker};

  private _isServiceWorkerOnline: boolean;

  private serviceMessagePort: ServiceMessagePort<true>;
  private _serviceMessagePort: MessagePort | undefined

  constructor() {
    this._isServiceWorkerOnline = CAN_USE_SERVICE_WORKER;

    this.threadedSharedWorkers = {};
    for (
      const { type, superMessagePort, threads } of THREADED_WORKERS_TYPES.map((type) => {
        return {
          type,
          superMessagePort: type === 'crypto' ? cryptoMessagePort : rlottieMessagePort,
          threads: type === 'crypto' ? App.cryptoWorkers : App.lottieWorkers,
        };
      })
    ) {
      this.threadedSharedWorkers[type] = {
        urls: [],
        attached: 0,
        promise: deferredPromise(),
        superMessagePort,
        threads,
      };

      this.threadedSharedWorkers[type].promise!.then(() => {
        this.threadedSharedWorkers[type]!.promise = undefined;
      });
    }

    this.stateManagersByAccount = {
      1: new AppStateManager(1),
      2: new AppStateManager(2),
      3: new AppStateManager(3),
      4: new AppStateManager(4),
    };

    const managersByAccountAsArray = Object.values(this.stateManagersByAccount)

    managersByAccountAsArray.forEach((stateManager) => {
      stateManager.onSettingsUpdate = (settingsValue) => {
        managersByAccountAsArray.forEach((stateManagerToUpdate) => {
          if (stateManager !== stateManagerToUpdate)
            stateManagerToUpdate.updateLocalState('settings', settingsValue);
        });
      }
    })
  }

  public start() {
    const port = MTProtoMessagePort.getInstance<false>();

    port.addEventListener('manager', ({ name, method, args, accountNumber }) => {
      if (accountNumber === undefined) {
        return callbackify(this.getManagersByAccount(), (managersByAccount) => {
          const results: any[] = [];
          for (const accountNumber in managersByAccount) {
            const managers = managersByAccount[+accountNumber as any as ActiveAccountNumber];
            const manager = managers[name as keyof Managers];
            // @ts-ignore
            results.push(manager[method](...args));
          }

          return results.some((result) => result instanceof Promise) ? Promise.all(results) : results;
        });
      }

      return callbackify(this.getManagersForAccount(accountNumber), (managers) => {
        const manager = managers[name as keyof Managers];
        // @ts-ignore
        return manager[method](...args);
      });
    });

    port.addEventListener('threadedPort', (type, source, event) => {
      const threadedWorker = this.threadedSharedWorkers[type];
      const port = event.ports[0];
      // A threaded worker can post its MessagePort before createProxyWorkerURLs
      // has populated urls, so cap by the configured thread count instead.
      if (threadedWorker!.attached >= threadedWorker!.threads) {
        port.close();
        return;
      }

      ++threadedWorker!.attached;
      threadedWorker!.superMessagePort!.attachPort(port);
      threadedWorker!.promise?.resolve();
    });

    port.addEventListener('createProxyWorkerURLs', ({ originalUrl, blob, type }) => {
      const { urls, threads } = this.threadedSharedWorkers[type]!;
      let length = urls.length;
      if (!length) {
        urls.push(originalUrl);
        ++length;
      }

      const maxLength = threads;
      if (length === maxLength) {
        return urls;
      }

      const newURLs = new Array(maxLength - length).fill(undefined).map(() => URL.createObjectURL(blob));
      urls.push(...newURLs);
      return urls;
    });

    rootScope.addEventListener('account_logged_in', async({ accountNumber, userId }) => {
      for (let i = 1; i < accountNumber; i++) {
        const otherAccountNumber = i as ActiveAccountNumber;
        const accountData = await AccountController.get(otherAccountNumber);
        if (accountData.userId === userId) {
          const managers = await this.getManagersForAccount(accountNumber);
          managers.apiManager.logOut(otherAccountNumber);
        }
      }
    });
  }

  private async createManagersForAccount(accountNumber: ActiveAccountNumber) {
    const stateManager = this.stateManagersByAccount[accountNumber]
    const appStoragesManager = new AppStoragesManager(accountNumber, stateManager.resetStoragesPromise);

    await Promise.all([
      // new Promise(() => {}),
      appStoragesManager.loadStorages(),
      // In Modes.noWorker the crypto worker is never spawned — the registry
      // is imported into the main realm and cryptoMessagePort short-circuits
      // same-realm callers via invokeCryptoNew's early-out. There's nothing
      // to wait for and the threadedPort handshake never resolves, so skip.
      Modes.noWorker ? Promise.resolve() : this.threadedSharedWorkers.crypto!.promise,
    ]);

    const managers = await createManagers(
      appStoragesManager,
      stateManager,
      accountNumber,
      stateManager.userId
    );

    this.managersByAccount[accountNumber] = managers;
    return managers;
  }

  // per-account init is independent so the active account's first call never
  // blocks on the other (or empty) account slots finishing
  public getManagersForAccount(accountNumber: ActiveAccountNumber): MaybePromise<Managers> {
    return this.managersByAccount[accountNumber] ??
      (this.managersByAccountPromises[accountNumber] ??= this.createManagersForAccount(accountNumber));
  }

  public getManagersByAccount(): MaybePromise<ManagersByAccount> {
    const numbers = [1, 2, 3, 4] as ActiveAccountNumber[];
    if (numbers.every((accountNumber) => this.managersByAccount[accountNumber])) {
      return this.managersByAccount as ManagersByAccount;
    }

    return Promise.all(
      numbers.map((accountNumber) => callbackify(
        this.getManagersForAccount(accountNumber),
        (managers) => [accountNumber, managers] as const
      ))
    ).then((pairs) => Object.fromEntries(pairs) as ManagersByAccount);
  }

  public get isServiceWorkerOnline() {
    return this._isServiceWorkerOnline;
  }

  public set isServiceWorkerOnline(value) {
    this._isServiceWorkerOnline = CAN_USE_SERVICE_WORKER ? value : false;
  }

  public getServiceMessagePort() {
    return this._isServiceWorkerOnline ? this.serviceMessagePort : undefined;
  }

  public onServiceWorkerPort(event: MessageEvent<any>) {
    if (this.serviceMessagePort) {
      this.serviceMessagePort.detachPort((this._serviceMessagePort as Window | MessagePort | ServiceWorker | Worker | ServiceWorkerContainer));
      this._serviceMessagePort = undefined;
    } else {
      this.serviceMessagePort = new ServiceMessagePort();
      this.serviceMessagePort.addMultipleEventsListeners({
        requestFilePart: (payload) => {
          const { docId, dcId, offset, limit, accountNumber } = payload;
          return callbackify(appManagersManager.getManagersForAccount(accountNumber), (managers) => {
            return managers.appDocsManager.requestDocPart(docId, dcId, offset, limit);
          });
        },
        cancelFilePartRequests: ({ docId, accountNumber }) => {
          return callbackify(appManagersManager.getManagersForAccount(accountNumber), (managers) => {
            return managers.appDocsManager.cancelDocPartsRequests(docId);
          });
        },
        requestRtmpState({ call, accountNumber }) {
          return callbackify(appManagersManager.getManagersForAccount(accountNumber), (managers) => {
            return managers.appGroupCallsManager.fetchRtmpState(call);
          });
        },
        requestRtmpPart(payload) {
          const { request, dcId, accountNumber } = payload;
          return callbackify(appManagersManager.getManagersForAccount(accountNumber), async(managers) => {
            return (await managers.appGroupCallsManager.fetchRtmpPart(request, dcId))!;
          });
        },
        requestDoc(payload) {
          const { docId, accountNumber } = payload;
          return callbackify(appManagersManager.getManagersForAccount(accountNumber), (managers) => {
            return managers.appDocsManager.getDoc(docId);
          });
        },
        downloadDoc(payload) {
          const { docId, accountNumber } = payload;
          return callbackify(appManagersManager.getManagersForAccount(accountNumber), (managers) => {
            const appDocsManager = managers.appDocsManager;
            const doc = appDocsManager.getDoc(docId);
            return appDocsManager.downloadDoc(doc);
          });
        },
        requestAltDocsByDoc(payload) {
          const { docId, accountNumber } = payload;
          return callbackify(appManagersManager.getManagersForAccount(accountNumber), (managers) => {
            const { appDocsManager } = managers;
            return appDocsManager.getAltDocsByDocument(docId);
          });
        },
        decryptPush(payload) {
          return pushSingleManager.decryptPush(payload.p, payload.keyIdBase64);
        },
      });
    }

    // * port can be undefined in the future
    if (this._serviceMessagePort = event.ports[0]) {
      this.serviceMessagePort.attachPort(this._serviceMessagePort);
    }
  }
}

const appManagersManager = new AppManagersManager();
MOUNT_CLASS_TO && (MOUNT_CLASS_TO.appManagersManager = appManagersManager);
export default appManagersManager;
