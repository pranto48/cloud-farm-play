const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Enable GPU & Hardware Acceleration for 60/144 FPS smooth rendering
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-frame-rate-limit'); // Unlock monitor refresh rate (60/144/240Hz)

let mainWindow = null;

// Determine Saves Directory (Portable saves next to exe if possible, else AppData)
function getSavesDir() {
  const portableDir = path.join(process.cwd(), 'saves');
  try {
    if (!fs.existsSync(portableDir)) {
      fs.mkdirSync(portableDir, { recursive: true });
    }
    return portableDir;
  } catch (err) {
    const fallbackDir = path.join(app.getPath('userData'), 'saves');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return fallbackDir;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0f1217',
    title: 'Farm-App: Factorio Industrial Simulation',
    frame: true, // Native Windows frame
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Maintain simulation speed when tabbed out
      webSecurity: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
          energy: data.energy || 100,
          maxEnergy: data.maxEnergy || 100,
          health: data.health || 100,
          maxHealth: data.maxHealth || 100,
          machinesCount: data.machinesCount || 0,
          data: data.data || data,
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
    const dir = getSavesDir();
    const cleanId = (slotId || `save_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(dir, `${cleanId}.json`);
    const payload = {
      id: cleanId,
      name: name || 'Nauvis Base',
      timestamp: Date.now(),
      ...metadata,
      data,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { success: true, id: cleanId, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('saves:load', async (_, slotId) => {
  try {
    const dir = getSavesDir();
    const filePath = path.join(dir, `${slotId}.json`);
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
    const dir = getSavesDir();
    const filePath = path.join(dir, `${slotId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
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

app.whenReady().then(createWindow);

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
