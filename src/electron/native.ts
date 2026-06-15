import { join } from 'path';

interface NativeAddon {
  startScrollMonitor(callback: (phase: 'begin' | 'end') => void): void;
  stopScrollMonitor(): void;
  performHapticFeedback(): void;
}

let addon: NativeAddon | undefined;
if (process.platform === 'darwin') {
  try {
    const path = join(__dirname, 'native', `tweb-native.${process.platform}-${process.arch}.node`);
    addon = require(path) as NativeAddon;
  } catch (err) {
    console.error('[tweb-native] addon unavailable:', err);
  }
}

export const nativeAddon = addon
