const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Stable Hardware Acceleration (Safe for Windows & OneDrive)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let mainWindow = null;

let savesDir;
function getSavesDir() {
  if (!savesDir) {
    savesDir = path.join(app.getPath("userData"), "saves");
    fs.mkdirSync(savesDir, { recursive: true });

    // Import the former desktop build's saves once. Preserve both copies.
    const marker = path.join(savesDir, ".legacy-imported");
    if (!fs.existsSync(marker)) {
      const legacyDirs = [
        path.join(app.getPath("appData"), "Farm-App", "saves"),
        path.join(app.getPath("appData"), "farm-app", "saves"),
        path.join(process.cwd(), "saves"),
        ...(process.env.PORTABLE_EXECUTABLE_DIR ? [path.join(process.env.PORTABLE_EXECUTABLE_DIR, "saves")] : []),
      ];
      for (const dir of new Set(legacyDirs)) {
        if (path.resolve(dir).toLowerCase() === path.resolve(savesDir).toLowerCase() || !fs.existsSync(dir)) continue;
        try {
          for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!file.isFile() || !/^[a-zA-Z0-9_-]+\.json$/.test(file.name)) continue;
            try {
              fs.copyFileSync(path.join(dir, file.name), path.join(savesDir, file.name), fs.constants.COPYFILE_EXCL);
            } catch (error) {
              if (error.code !== "EEXIST") throw error;
            }
          }
        } catch (error) {
          console.warn("Could not import legacy saves:", error.message);
        }
      }
      fs.writeFileSync(marker, "");
    }
  }
  return savesDir;
}

function getSavePath(slotId) {
  if (typeof slotId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(slotId)) throw new Error("Invalid save slot");
  return path.join(getSavesDir(), `${slotId}.json`);
}

function createWindow() {
  const iconPath = path.join(__dirname, '../dist/icon.png');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0f1217',
    title: 'MeadowLife',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    frame: true, // Native Windows frame
    autoHideMenuBar: true,
    show: false, // Don't show until ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
    console.error('[Main] Failed to load URL:', url, code, desc);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, source) => {
    if (level >= 2) console.warn(`[Renderer] ${message} (${source}:${line})`);
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  // F11 Fullscreen shortcut
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==========================================
// IPC HANDLERS: LOCAL DISK SAVE MANAGEMENT
// ==========================================
ipcMain.handle('saves:list', async () => {
  try {
    const dir = getSavesDir();
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const saves = files.map(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        return {
          id: file.replace('.json', ''),
          fileName: file,
          name: data.name || file.replace('.json', ''),
          timestamp: data.timestamp || stats.mtimeMs,
          day: data.day || 1,
          time: data.time || 360,
          season: data.season || 'spring',
          coins: data.coins || 0,
          energy: data.energy ?? 100,
          maxEnergy: data.maxEnergy || 100,
          health: data.health ?? 100,
          maxHealth: data.maxHealth || 100,
          machinesCount: data.machinesCount || 0,

        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    return { success: true, saves: saves.sort((a, b) => b.timestamp - a.timestamp) };
  } catch (err) {
    return { success: false, error: err.message, saves: [] };
  }
});

ipcMain.handle('saves:save', async (_, { name, slotId, data, metadata }) => {
  try {
    const cleanId = slotId || `save_${Date.now()}`;
    const filePath = getSavePath(cleanId);
    const payload = {
      id: cleanId,
      name: name || 'Meadow Works',
      timestamp: Date.now(),
      ...metadata,
      data,
    };
    const temporary = `${filePath}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(payload), 'utf8');
      fs.renameSync(temporary, filePath);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    return { success: true, id: cleanId, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('saves:load', async (_, slotId) => {
  try {
    const filePath = getSavePath(slotId);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return { success: true, slot: parsed };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('saves:delete', async (_, slotId) => {
  try {
    const filePath = getSavePath(slotId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('saves:openFolder', async () => {
  try {
    const dir = getSavesDir();
    const error = await shell.openPath(dir);
    return error ? { success: false, error } : { success: true, dir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// App Window Controls
ipcMain.handle('window:toggleFullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle('app:getInfo', () => {
  return {
    version: app.getVersion(),
    savesDir: getSavesDir(),
    isPackaged: app.isPackaged,
  };
});

if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(createWindow);
} else {
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
