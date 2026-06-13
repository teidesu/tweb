import type {MyMessage} from '@appManagers/appMessagesManager';
import type {AccountDatabase} from '@config/databases/state';
import type AppStorage from '@lib/storage';
import type {SlicedArrayPersisted} from '@helpers/slicedArray';
import {AppManager} from '@appManagers/manager';
import debounce from '@helpers/schedulers/debounce';

export type MessagesPersistedHistory = {
  slices: SlicedArrayPersisted<number>,
  count: number | null,
  maxOutId?: number,
  readMaxId?: number,
  readOutboxMaxId?: number
};

export type MessagesPersistedRecord = {
  peerId: PeerId,
  messages: MyMessage[],
  history?: MessagesPersistedHistory,
  threads?: {[threadId: string]: MessagesPersistedHistory},
  accessedAt: number
};

// * with a passcode set the whole store is re-encrypted as a single blob on every write, hence the relatively long debounce
const FLUSH_DEBOUNCE = 2500;
const MAX_PERSISTED_PEERS = 50;

// STOPGAP: as-is persistence of the in-memory message cache (one row per peer, capped by
// MAX_PERSISTED_MESSAGES_PER_HISTORY). Intentionally shallow — meant to be superseded by a proper
// per-message store eventually

export default class MessagesPersistentStorage extends AppManager {
  private storage: AppStorage<Record<PeerId, MessagesPersistedRecord>, AccountDatabase>;
  private records: Map<PeerId, MessagesPersistedRecord> = new Map();
  private dirtyPeers: Set<PeerId> = new Set();
  private deletedPeers: Set<PeerId> = new Set();
  private flushDebounced: ReturnType<typeof debounce>;
  private loaded: boolean;

  protected after() {
    this.clear(true);
    this.flushDebounced = debounce(() => this.flush(), FLUSH_DEBOUNCE, false, true);

    return this.appStoragesManager.loadStorage('messages').then(({storage, results}) => {
      this.storage = storage;
      for(const record of results) {
        if(record?.peerId !== undefined) {
          if(this.deletedPeers.has(record.peerId)) {
            this.storage.delete(record.peerId);
            continue;
          }

          this.records.set(record.peerId, record);
        }
      }

      this.deletedPeers.clear();
      this.loaded = true;
    });
  }

  public isLoaded() {
    return this.loaded;
  }

  public isFrozen() {
    return !!this.storage?.isSavingFrozen();
  }

  public clear = (init?: boolean) => {
    this.dirtyPeers = new Set();
    this.records = new Map();
    this.deletedPeers = new Set();

    if(init) {
      this.loaded = false; // * about to (re)load from IDB; keep persistence disabled until it completes
    } else if(this.storage) {
      // * runtime wipe (e.g. differenceTooLong): drop stale data but stay loaded so persistence keeps working
      this.storage.clear();
    }
  };

  public getRecord(peerId: PeerId) {
    return this.records.get(peerId);
  }

  public markDirty(peerId: PeerId) {
    this.dirtyPeers.add(peerId);
    this.flushDebounced();
  }

  public deletePeer(peerId: PeerId) {
    this.dirtyPeers.delete(peerId);
    if(!this.loaded) {
      this.deletedPeers.add(peerId);
    }

    if(this.records.delete(peerId) && this.storage) {
      this.storage.delete(peerId);
    }
  }

  private flush() {
    if(!this.storage) {
      return;
    }

    const toSet: Record<PeerId, MessagesPersistedRecord> = {};
    let hasToSet = false;
    for(const peerId of this.dirtyPeers) {
      const record = this.appMessagesManager.serializePeerForPersistence(peerId);
      if(record) {
        this.records.set(peerId, record);
        toSet[peerId] = record;
        hasToSet = true;
      } else if(this.records.delete(peerId)) {
        this.storage.delete(peerId);
      }
    }

    this.dirtyPeers.clear();

    if(hasToSet) {
      this.storage.set(toSet);
    }

    this.enforceCap();
  }

  private enforceCap() {
    const excess = this.records.size - MAX_PERSISTED_PEERS;
    if(excess <= 0) {
      return;
    }

    const sorted = [...this.records.entries()].sort(([, a], [, b]) => a.accessedAt - b.accessedAt);
    for(let i = 0; i < excess; ++i) {
      const [peerId] = sorted[i];
      this.records.delete(peerId);
      this.storage.delete(peerId);
    }
  }
}
