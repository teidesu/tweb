import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import { promisify } from 'util';
import os from 'os';

// Port of tdesktop's Platform::DeviceModelPretty() / SystemVersionPretty()
// (lib_base/base/platform/*). Computed once (async) in the main process and
// shipped to the renderer (preload → ENVIRONMENT → MTProto initConnection.
// device_model), so active sessions show "MacBook Pro M2" instead of the raw UA.

const execFileAsync = promisify(execFile);

const MAX_DEVICE_MODEL_LENGTH = 15;
const MAX_GOOD_DEVICE_MODEL_LENGTH = 32;

// Qt QString::simplified() + control-char scrub
function cleanAndSimplify(text: string): string {
  return text.replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function simplifyDeviceModel(model: string): string {
  return cleanAndSimplify(model.replace(/_/g, ''));
}

function isDeviceModelOk(model: string): boolean {
  return !!model && model.length <= MAX_DEVICE_MODEL_LENGTH;
}

function simplifyGoodDeviceModel(model: string, remove: string[]): string {
  let result = '';
  for (const word of model.split(' ')) {
    if (remove.includes(word.toLowerCase())) continue;
    if (!result) result = word;
    else if (result.length + word.length + 1 > MAX_GOOD_DEVICE_MODEL_LENGTH) return result;
    else result += ' ' + word;
  }
  return result;
}

function productNameToDeviceModel(productName: string): string {
  if (productName.startsWith('HP ')) {
    return simplifyGoodDeviceModel(productName, ['notebook', 'desktop', 'mobile', 'workstation', 'pc']);
  } else if (isDeviceModelOk(productName)) {
    return productName;
  }
  return '';
}

function finalizeDeviceModel(model: string): string {
  model = model.trim();
  return model || (process.platform === 'darwin' ? 'Mac' : 'Desktop');
}

async function sh(cmd: string, args: string[], timeout = 4000): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { encoding: 'utf8', timeout });
    return stdout || '';
  } catch {
    return '';
  }
}

// ---- macOS ----

// Since the MacBook M2, hw.model is just "Mac[digits],[digits]", so prefer
// system_profiler's machine_name (+ chip suffix) like tdesktop does.
async function macFromSystemProfiler(): Promise<string> {
  const out = await sh('system_profiler', ['-json', 'SPHardwareDataType', '-detailLevel', 'mini']);
  if (!out) return '';
  try {
    const fields = JSON.parse(out)?.SPHardwareDataType?.[0];
    const result: string = fields?.machine_name;
    if (!result) return '';
    const chip: string = fields?.chip_type;
    return typeof chip === 'string' && chip.startsWith('Apple ') ? result + chip.slice(5) : result;
  } catch {
    return '';
  }
}

// split a camelCase identifier ("MacBookPro18,3") into spaced words, keeping
// "Mac"/"Book" glued to the preceding word
function macFromIdentifier(model: string): string {
  if (!model || model.toLowerCase().indexOf('mac') < 0) return '';
  const words: string[] = [];
  let word = '';
  for (const ch of model) {
    if (!/\p{L}/u.test(ch)) continue;
    if (/\p{Lu}/u.test(ch) && word) {
      words.push(word);
      word = '';
    }
    word += ch;
  }
  if (word) words.push(word);
  let result = '';
  for (const w of words) {
    if (result && w !== 'Mac' && w !== 'Book') result += ' ';
    result += w;
  }
  return result;
}

async function macDeviceModel(): Promise<string> {
  const fromProfiler = await macFromSystemProfiler();
  if (fromProfiler) return fromProfiler;
  const hwModel = (await sh('sysctl', ['-n', 'hw.model'], 2000)).trim();
  if (hwModel) {
    const parsed = cleanAndSimplify(macFromIdentifier(hwModel));
    if (parsed) return parsed;
  }
  return '';
}

// ---- Linux ----

async function dmi(key: string): Promise<string> {
  try {
    return simplifyDeviceModel(await readFile('/sys/class/dmi/id/' + key, 'utf8'));
  } catch {
    return '';
  }
}

const CHASSIS_TYPES: Record<number, string> = {
  0x3: 'Desktop', 0x4: 'Desktop', 0x6: 'Desktop', 0x7: 'Desktop', 0xD: 'Desktop',
  0x8: 'Laptop', 0x9: 'Laptop', 0xA: 'Laptop', 0xE: 'Laptop',
  0xB: 'Handset',
  0x11: 'Server', 0x1C: 'Server', 0x1D: 'Server',
  0x1E: 'Tablet',
  0x1F: 'Convertible', 0x20: 'Convertible',
};

async function linuxDeviceModel(): Promise<string> {
  const model = productNameToDeviceModel(await dmi('product_name'));
  if (model) return model;

  const productFamily = await dmi('product_family');
  const boardName = await dmi('board_name');
  const familyName = simplifyDeviceModel(productFamily + ' ' + boardName);
  if (isDeviceModelOk(familyName)) return familyName;
  if (isDeviceModelOk(boardName)) return boardName;
  if (isDeviceModelOk(productFamily)) return productFamily;

  const virt = (await sh('systemd-detect-virt', [], 2000)).trim().toUpperCase();
  if (virt && virt !== 'NONE') return virt;

  return CHASSIS_TYPES[parseInt(await dmi('chassis_type'), 10)] || '';
}

// ---- Windows ----

async function regQuery(name: string): Promise<string> {
  const out = await sh('reg', ['query', 'HKLM\\HARDWARE\\DESCRIPTION\\System\\BIOS', '/v', name], 3000);
  const m = out.match(new RegExp(name + '\\s+REG_\\w+\\s+(.+)'));
  return simplifyDeviceModel(m ? m[1] : '');
}

async function winDeviceModel(): Promise<string> {
  const model = productNameToDeviceModel(await regQuery('SystemProductName'));
  if (model) return model;

  const systemFamily = await regQuery('SystemFamily');
  const baseBoardProduct = await regQuery('BaseBoardProduct');
  const familyBoard = simplifyDeviceModel(systemFamily + ' ' + baseBoardProduct);
  if (isDeviceModelOk(familyBoard)) return familyBoard;
  if (isDeviceModelOk(baseBoardProduct)) return baseBoardProduct;
  if (isDeviceModelOk(systemFamily)) return systemFamily;

  return '';
}

// ---- system version (cheap, no subprocess) ----

const ARCH: Record<string, string> = { x64: 'x64', arm64: 'arm64', ia32: 'x86' };

function macSystemVersion(): string {
  const [major, minor, patch] = process.getSystemVersion().split('.').map(Number);
  const tail = patch > 0 ? `.${patch}` : '';
  if (major < 10) return 'OS X';
  if (major === 10 && minor < 12) return `OS X 10.${minor}${tail}`;
  return `macOS ${major}.${minor}${tail}`;
}

function winSystemVersion(): string {
  const arch = ARCH[os.arch()] || os.arch();
  // os.release() → "10.0.<build>"; build >= 22000 is Windows 11
  const build = Number(os.release().split('.')[2]) || 0;
  const name = build >= 22000 ? 'Windows 11' : 'Windows 10';
  return `${name} ${arch}`;
}

function linuxSystemVersion(): string {
  const session = process.env.XDG_SESSION_TYPE === 'wayland' ? 'Wayland' :
    process.env.XDG_SESSION_TYPE === 'x11' ? 'X11' : '';
  const de = process.env.XDG_CURRENT_DESKTOP || '';
  return ['Linux', de, session].filter(Boolean).join(' ');
}

export interface DeviceInfo {
  deviceModel: string;
  systemVersion: string;
}

let cached: Promise<DeviceInfo> | undefined;

async function computeDeviceInfo(): Promise<DeviceInfo> {
  const deviceModel = finalizeDeviceModel(
    process.platform === 'darwin' ? await macDeviceModel() :
    process.platform === 'win32' ? await winDeviceModel() :
    await linuxDeviceModel()
  );
  const systemVersion =
    process.platform === 'darwin' ? macSystemVersion() :
    process.platform === 'win32' ? winSystemVersion() :
    linuxSystemVersion();
  return { deviceModel, systemVersion };
}

export function getDeviceInfo(): Promise<DeviceInfo> {
  return cached ??= computeDeviceInfo();
}

export function registerDeviceInfoIpc() {
  ipcMain.handle('get-device-info', () => getDeviceInfo());
}
