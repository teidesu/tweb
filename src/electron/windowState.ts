import { app, screen, BrowserWindow, Rectangle } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

type State = Rectangle & {maximized?: boolean};

const FILE = join(app.getPath('userData'), 'window-state.json');
const DEFAULT: State = { width: 1400, height: 860, x: undefined as any, y: undefined as any };

function read(): State {
  try {
    return { ...DEFAULT, ...JSON.parse(readFileSync(FILE, 'utf8')) };
  } catch {
    return { ...DEFAULT };
  }
}

// drop saved bounds that no longer intersect any display (unplugged monitor)
function isVisible(state: State): boolean {
  if (state.x === undefined || state.y === undefined) return true;
  return screen.getAllDisplays().some(({ workArea }) =>
    state.x! >= workArea.x &&
    state.y! >= workArea.y &&
    state.x! + state.width <= workArea.x + workArea.width &&
    state.y! + state.height <= workArea.y + workArea.height
  );
}

export function createWindowStateManager() {
  let state = read();
  if (!isVisible(state)) state = { ...DEFAULT };

  const save = (win: BrowserWindow) => {
    if (win.isDestroyed()) return;
    const maximized = win.isMaximized();
    if (!maximized && !win.isMinimized()) {
      const { x, y, width, height } = win.getBounds();
      state = { x, y, width, height, maximized };
    } else {
      state = { ...state, maximized };
    }
    try {
      writeFileSync(FILE, JSON.stringify(state));
    } catch {}
  };

  return {
    bounds: { width: state.width, height: state.height, x: state.x, y: state.y },
    maximized: !!state.maximized,
    track(win: BrowserWindow) {
      const handler = () => save(win);
      win.on('resize', handler);
      win.on('move', handler);
      win.on('close', handler);
    },
  };
}
