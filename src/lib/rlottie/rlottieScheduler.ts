// Single shared rAF ticker for all lottie work. Replaces the per-player
// setTimeout loops (frame advance) and the custom-emoji setInterval (compositing)
// with one vsync-aligned callback — so N on-screen animations cost one coalesced
// paint per frame instead of N drifting, uncoordinated timers.

export type RLottieTickable = {
  // advances at most one frame if its interval elapsed; cheap no-op when not due
  tick: (now: number) => void;
};

class RLottieScheduler {
  private players: Set<RLottieTickable> = new Set();
  // passive, keep-alive listeners (custom-emoji compositing): they don't produce
  // frames but must run every tick while registered (scroll culling, fade-in)
  private tickListeners: Set<(now: number) => void> = new Set();
  private rafId: number | undefined;

  private loop = (now: number) => {
    // advance producers first so freshly stashed frames composite in the same frame
    for (const player of this.players) {
      player.tick(now);
    }

    for (const cb of this.tickListeners) {
      cb(now);
    }

    this.rafId = (this.players.size || this.tickListeners.size) ?
      requestAnimationFrame(this.loop) :
      undefined;
  };

  private start() {
    if (this.rafId === undefined) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  public add(player: RLottieTickable) {
    this.players.add(player);
    this.start();
  }

  public remove(player: RLottieTickable) {
    this.players.delete(player);
    // rAF self-stops on the next tick once both sets are empty
  }

  public addTickListener(cb: (now: number) => void) {
    this.tickListeners.add(cb);
    this.start();
  }

  public removeTickListener(cb: (now: number) => void) {
    this.tickListeners.delete(cb);
  }
}

const rlottieScheduler = new RLottieScheduler();
export default rlottieScheduler;
