import { app, BrowserWindow, shell, Menu, dialog, ipcMain } from 'electron';
import { join, basename, extname } from 'path';
import { readFileSync, appendFileSync, writeFileSync, createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const logFile = join(app.getPath('userData'), 'aurora-debug.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { appendFileSync(logFile, line); } catch (_) {}
  console.log(msg);
}

log('App starting...');
log(`Electron: ${process.versions.electron}`);
log(`Platform: ${process.platform} ${process.arch}`);

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

const PROD_URL = 'https://aurorachat-beta-tr.netlify.app';

function createWindow() {
  log('Creating window...');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'AuroraChat',
    backgroundColor: '#0f0f10',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: join(__dirname, 'preload.js'),
    },
  });

  log(`Loading URL: ${PROD_URL}`);
  win.loadURL(PROD_URL).catch((err) => {
    log(`loadURL error: ${err.message}`);
  });

  win.webContents.on('did-start-loading', () => log('Page loading started'));
  win.webContents.on('did-finish-load', () => log('Page loaded successfully'));

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log(`Page load failed: ${errorCode} ${errorDescription}`);
    if (errorCode === -3) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'error',
      title: 'Bağlantı Hatası',
      message: 'Sunucuya bağlanılamadı',
      detail: `İnternet bağlantınızı kontrol edin ve tekrar deneyin.\n\nHata: ${errorDescription} (${errorCode})`,
      buttons: ['Tekrar Dene', 'Kapat'],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice === 0) {
      win.loadURL(PROD_URL).catch(() => {});
    } else {
      app.quit();
    }
  });

  win.webContents.on('crashed', () => {
    log('Renderer process crashed!');
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(PROD_URL)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('closed', () => log('Window closed'));

  Menu.setApplicationMenu(null);
  log('Window created');
}

app.on('render-process-gone', (event, webContents, details) => {
  log(`Render process gone: ${details.reason}`);
  if (details.reason === 'clean-exit') return;
  dialog.showErrorBox(
    'Uygulama Hatası',
    `Uygulama beklenmedik şekilde kapandı (${details.reason}).\n\nLog dosyası: ${logFile}\n\nLütfen yeniden başlatın.`
  );
  app.quit();
});

app.on('child-process-gone', (event, details) => {
  log(`Child process gone: type=${details.type} reason=${details.reason}`);
});

app.whenReady().then(() => {
  log('App ready');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  log('All windows closed');
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => log('App quitting'));

ipcMain.handle('show-open-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return dialog.showOpenDialog(win, options);
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return dialog.showSaveDialog(win, options);
});

ipcMain.handle('read-files', async (event, filePaths) => {
  const results = [];
  for (const filePath of filePaths) {
    try {
      const data = readFileSync(filePath);
      const name = basename(filePath);
      const ext = extname(filePath).toLowerCase().slice(1);
      const mimeMap = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
        webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain',
        mp4: 'video/mp4', mp3: 'audio/mpeg', zip: 'application/zip',
      };
      const type = mimeMap[ext] || 'application/octet-stream';
      results.push({ name, type, size: data.length, base64: data.toString('base64') });
    } catch (err) {
      log(`read-files error for ${filePath}: ${err.message}`);
    }
  }
  return results;
});

ipcMain.handle('write-file', async (event, filePath, base64Data) => {
  try {
    const buf = Buffer.from(base64Data, 'base64');
    writeFileSync(filePath, buf);
    return { success: true };
  } catch (err) {
    log(`write-file error: ${err.message}`);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('download-url-file', async (event, url, suggestedName) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Dosyayı Kaydet',
      defaultPath: suggestedName || 'dosya',
      buttonLabel: 'Kaydet',
    });
    if (!filePath) return { success: false, cancelled: true };

    const client = url.startsWith('https') ? https : http;

    await new Promise((resolve, reject) => {
      const fileStream = createWriteStream(filePath);
      client.get(url, (response) => {
        response.pipe(fileStream);
        fileStream.on('finish', () => { fileStream.close(); resolve(filePath); });
        fileStream.on('error', reject);
        response.on('error', reject);
      }).on('error', reject);
    });

    return { success: true, filePath };
  } catch (err) {
    log(`download-url-file error: ${err.message}`);
    return { success: false, error: err.message };
  }
});
