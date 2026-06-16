import type { DcId, TrueDcId } from '@/types';
import pause from '@/helpers/schedulers/pause';
import { logger, LogTypes } from '@/lib/logger';
import MTTransport from '@/lib/mtproto/transports/transport';
import Modes from '@/config/modes';
import transportController from '@/lib/mtproto/transports/controller';
// import networkStats from '@/lib/mtproto/networkStats';

const TEST_DROPPING_REQUESTS: TrueDcId | undefined = undefined;

// telegram's load balancer sometimes returns 400 when the request landed on a broken upstream or something,
// even if the content itself is actually perfectly valid, so we need to retry a few times
const FLAKY_400_MAX_RETRIES = 10;

export default class HTTP implements MTTransport {
  public noScheduler: boolean;
  private log: ReturnType<typeof logger>;

  private pending: Array<{
    resolve: (body: Uint8Array) => void,
    reject: any,
    body: Uint8Array
  }> = [];
  private releasing: boolean;

  public connected: boolean;
  private destroyed: boolean;
  private debug: boolean;

  constructor(
    protected dcId: DcId,
    protected url: string,
    logSuffix: string
  ) {
    this.debug = Modes.debug && false;

    let logTypes = LogTypes.Error | LogTypes.Log;
    if (this.debug) logTypes |= LogTypes.Debug;

    this.log = logger(`HTTP-${dcId}` + logSuffix, logTypes);
    this.log('constructor');

    this.connected = false;
  }

  public async _send(
    body: Uint8Array,
    mode?: RequestMode,
    timeoutMs?: number
  ) {
    for (let attempt = 0; ; ++attempt) {
      try {
        return await this._sendOnce(body, mode, timeoutMs);
      } catch (err) {
        if (err instanceof Response && err.status === 400 && attempt < FLAKY_400_MAX_RETRIES && !this.destroyed) {
          this.debug && this.log.debug('flaky 400, retrying, attempt', attempt);
          continue;
        }

        if (err instanceof Response) {
          err.arrayBuffer().then((buffer) => {
            this.log.error('not 200',
              new TextDecoder('utf-8').decode(new Uint8Array(buffer)));
          });
        }

        this.setConnected(false);
        throw err;
      }
    }
  }

  private async _sendOnce(
    body: Uint8Array,
    mode?: RequestMode,
    timeoutMs = 30000
  ): Promise<Uint8Array> {
    this.debug && this.log.debug('-> body length to send:', body.length);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // networkStats.addSent(this.dcId, length);
      const response = await fetch(this.url, { method: 'POST', body: body as BodyInit, mode, signal: controller.signal });
      if (response.status !== 200 && !mode) {
        throw response;
      }

      this.setConnected(true);

      // * test resending by dropping random request
      if (TEST_DROPPING_REQUESTS && this.dcId === TEST_DROPPING_REQUESTS && Math.random() > .5) {
        controller.abort();
        throw 'test';
      }

      const buffer = await response.arrayBuffer();
      // networkStats.addReceived(this.dcId, buffer.byteLength);
      return new Uint8Array(buffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  private setConnected(connected: boolean) {
    if (this.connected === connected || this.destroyed) {
      return;
    }

    this.connected = connected;

    if (import.meta.env.VITE_MTPROTO_AUTO && Modes.multipleTransports) {
      transportController.setTransportValue('https', connected);
    }
  }

  public destroy() {
    this.setConnected(false);
    this.destroyed = true;
    this.pending.forEach((pending) => pending.reject());
    this.pending.length = 0;
  }

  public send(body: Uint8Array) {
    if (this.noScheduler) {
      return this._send(body);
    } else {
      const promise = new Promise<typeof body>((resolve, reject) => {
        this.pending.push({ resolve, reject, body });
      });

      this.releasePending();

      return promise;
    }
  }

  /**
   * ! will resend the request on error
   */
  private async releasePending() {
    if (this.releasing) return;

    this.releasing = true;
    // this.log('-> messages to send:', this.pending.length);
    for (let i = 0; i < this.pending.length; ++i) {
      const pending = this.pending[i];
      const { body, resolve } = pending;

      try {
        const result = await this._send(body);
        resolve(result);
        this.pending.splice(i, 1);
      } catch (err) {
        this.log.error('Send plain request error:', err);
        await pause(5000);
      }

      --i;
    }

    this.releasing = false;
  }
}
