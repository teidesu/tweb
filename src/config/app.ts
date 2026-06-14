/*
 * Originally from:
 * https://github.com/zhukov/webogram
 * Copyright (C) 2014 Igor Zhukov <igor.beatle@gmail.com>
 * https://github.com/zhukov/webogram/blob/master/LICENSE
 */

import type { TrueDcId } from '@types';
import langPackLocalVersion from '@/langPackLocalVersion';

export const DEFAULT_BACKGROUND_SLUG = 'pattern';

const threads = Math.min(4, navigator.hardwareConcurrency ?? 4);

const App = {
  id: +import.meta.env.VITE_API_ID,
  hash: import.meta.env.VITE_API_HASH,
  pushServerKey: import.meta.env.VITE_PUSH_SERVER_KEY,
  version: import.meta.env.VITE_VERSION,
  versionFull: import.meta.env.VITE_VERSION_FULL,
  build: +import.meta.env.VITE_BUILD,
  langPackVersion: +import.meta.env.VITE_LANG_PACK_VERSION,
  langPackLocalVersion: langPackLocalVersion,
  langPack: 'webk',
  langPackCode: 'en',
  baseDcId: 2 as TrueDcId,
  suffix: '🌸',
  wsSuffix: 'k', // must be a real Telegram client prefix
  threads,
  lottieWorkers: threads,
  cryptoWorkers: threads,
  interclientBroadcastChannel: 'tgweb',
};

export default App;
