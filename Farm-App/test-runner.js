const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'electron/preload.cjs'),
      webSecurity: false,
      contextIsolation: true,
    }
  });

  win.webContents.on('console-message', (e, level, msg, line, src) => {
    console.log(`[LEVEL ${level}] ${msg}`);
  });

  const p = path.resolve(__dirname, 'dist/index.html');
  win.loadFile(p).then(() => {
    setTimeout(() => {
      app.quit();
      process.exit(0);
    }, 2500);
  });
});
