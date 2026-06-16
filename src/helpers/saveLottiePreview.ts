import type { MyDocument } from '@/lib/appManagers/appDocsManager';
import type RLottiePlayer from '@/lib/rlottie/rlottiePlayer';
import { applyColorOnContext } from '@/lib/rlottie/rlottiePlayer';
import rootScope from '@/lib/rootScope';
import getStickerThumbKey from '@/lib/storages/utils/thumbs/getStickerThumbKey';
import customProperties from '@/helpers/dom/customProperties';

const savingLottiePreview: {[docId: DocId]: {width: number, height: number}} = {};

export function isSavingLottiePreview(doc: MyDocument, toneIndex: number | string, width: number, height: number) {
  const key = getStickerThumbKey(doc.id, toneIndex);
  const saving = savingLottiePreview[key];
  return saving && saving.width >= width && saving.height >= height;
}

let sharedCanvas: HTMLCanvasElement, sharedContext: CanvasRenderingContext2D;
const createCanvas = () => {
  rootScope.addEventListener('theme_changed', () => {
    rootScope.managers.thumbsStorage.clearColoredStickerThumbs();

    for (const key in savingLottiePreview) {
      const [, toneIndex] = key.split('-');
      if (toneIndex && isNaN(+toneIndex)) {
        delete savingLottiePreview[key];
      }
    }
  });

  sharedCanvas = document.createElement('canvas');
  sharedContext = sharedCanvas.getContext('2d')!;
};

type PendingPreview = {
  doc: MyDocument,
  canvas: HTMLCanvasElement | ImageBitmap,
  toneIndex: number | string,
  width: number,
  height: number,
  saving: {width: number, height: number},
};

// Encoding a preview (toBlob does a GPU readback + PNG encode) is too heavy to run
// on a sticker's firstFrame — during a fast scroll through a grid it fires hundreds
// of times and janks every frame. Reservation is synchronous (so duplicates dedupe),
// but the encode is deferred to idle time, where it never competes with scroll/animation.
const pendingPreviews = new Map<string, PendingPreview>();
let flushScheduled = false;

const requestIdle: (cb: (deadline: IdleDeadline) => void) => void =
  typeof(requestIdleCallback) !== 'undefined' ?
    (cb) => requestIdleCallback(cb, { timeout: 1000 }) :
    (cb) => setTimeout(() => cb({ timeRemaining: () => 8, didTimeout: true } as IdleDeadline), 1);

const scheduleFlush = () => {
  if (flushScheduled) {
    return;
  }

  flushScheduled = true;
  requestIdle(flushPreviews);
};

function flushPreviews(deadline: IdleDeadline) {
  flushScheduled = false;

  for (const [key, item] of pendingPreviews) {
    pendingPreviews.delete(key);
    encodePreview(key, item);

    // yield back once the idle slice is (nearly) spent — toBlob's readback is sync
    if (deadline.timeRemaining() < 4) {
      break;
    }
  }

  if (pendingPreviews.size) {
    scheduleFlush();
  }
}

export function saveLottiePreview(doc: MyDocument, canvas: HTMLCanvasElement | ImageBitmap, toneIndex: number | string) {
  const key = getStickerThumbKey(doc.id, toneIndex);
  const { width, height } = canvas;
  if (isSavingLottiePreview(doc, toneIndex, width, height)) {
    return;
  }

  const saving = savingLottiePreview[key] = {
    width,
    height,
  };

  pendingPreviews.set(key, { doc, canvas, toneIndex, width, height, saving });
  scheduleFlush();
}

async function encodePreview(key: string, { doc, canvas, toneIndex, width, height, saving }: PendingPreview) {
  const thumb = await rootScope.managers.thumbsStorage.getStickerCachedThumb(doc.id, toneIndex);
  if (savingLottiePreview[key] !== saving) {
    return;
  }

  if (thumb && thumb.w >= width && thumb.h >= height) {
    return;
  }

  let outCanvas: HTMLCanvasElement;
  if (typeof(toneIndex) === 'string' || !(canvas instanceof HTMLCanvasElement)) {
    if (!sharedCanvas) {
      createCanvas();
    }

    sharedCanvas.width = width;
    sharedCanvas.height = height;
    sharedContext.drawImage(canvas, 0, 0, width, height);
    if (typeof(toneIndex) === 'string') {
      applyColorOnContext(sharedContext, customProperties.getProperty(toneIndex), 0, 0, width, height);
    }
    if (canvas instanceof ImageBitmap) { // exportFrame mints a fresh bitmap; release it now that it's drawn
      canvas.close();
    }
    outCanvas = sharedCanvas;
  } else {
    outCanvas = canvas;
  }

  const promise = new Promise<Blob>((resolve) => {
    outCanvas.toBlob((blob) => resolve(blob!));
  });

  const blob = await promise;
  if (savingLottiePreview[key] !== saving) {
    return;
  }

  if (!blob) {
    console.error('trying to save sticker preview with no blob', arguments);
    debugger;
    return;
  }

  rootScope.managers.thumbsStorage.saveStickerPreview(doc.id, blob, width, height, toneIndex);
}

export async function saveLottiePreviewFromPlayer(doc: MyDocument, player: RLottiePlayer, toneIndex: number | string) {
  if (!player.offscreen) {
    return saveLottiePreview(doc, player.canvas[0], toneIndex);
  }

  if (isSavingLottiePreview(doc, toneIndex, player.width, player.height)) {
    return; // guard runs BEFORE the export - no bitmap ships when nothing needs saving
  }

  try {
    const { frame } = await player.exportFrame();
    saveLottiePreview(doc, frame, toneIndex);
  } catch (err) {
    // degrade to no persisted thumb - same as today's pre-firstFrame state
    console.error('saveLottiePreviewFromPlayer: exportFrame failed', err, player);
  }
}
