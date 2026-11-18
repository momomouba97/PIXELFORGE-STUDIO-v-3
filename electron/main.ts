import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const MAX_IMPORT_BYTES = 200 * 1024 * 1024;
const MAX_EXPORT_BYTES = 500 * 1024 * 1024;
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tif', 'tiff'];
const SAVE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'pfs'];

function trusted(e: IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url ?? '';
  return DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://');
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#0d0e12',
    title: 'PIXELFORGE STUDIO',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const ok = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://');
    if (!ok) e.preventDefault();
  });

  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('file:openImages', async (e) => {
  if (!trusted(e)) throw new Error('untrusted sender');
  const r = await dialog.showOpenDialog({
    title: 'Open images',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: IMAGE_EXTS }],
  });
  if (r.canceled) return [];
  const out: { name: string; data: Uint8Array }[] = [];
  for (const p of r.filePaths) {
    const ext = path.extname(p).slice(1).toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) continue;
    const st = await fs.stat(p);
    if (st.size > MAX_IMPORT_BYTES) continue;
    out.push({ name: path.basename(p), data: new Uint8Array(await fs.readFile(p)) });
  }
  return out;
});

ipcMain.handle('file:save', async (e, opts: { suggestedName: string; ext: string; data: Uint8Array }) => {
  if (!trusted(e)) throw new Error('untrusted sender');
  if (!opts || typeof opts.suggestedName !== 'string' || typeof opts.ext !== 'string') throw new Error('bad args');
  const ext = opts.ext.toLowerCase();
  if (!SAVE_EXTS.includes(ext)) throw new Error('bad extension');
  if (!(opts.data instanceof Uint8Array) || opts.data.byteLength > MAX_EXPORT_BYTES) throw new Error('bad data');
  const base = path.basename(opts.suggestedName).replace(/[^\w.\- ؀-ۿ]/g, '_');
  // showSaveDialog on macOS asks for confirmation before replacing an existing file.
  const r = await dialog.showSaveDialog({
    title: 'Save',
    defaultPath: path.join(app.getPath('pictures'), base),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (r.canceled || !r.filePath) return { saved: false };
  const target = r.filePath.toLowerCase().endsWith('.' + ext) ? r.filePath : `${r.filePath}.${ext}`;
  await fs.writeFile(target, opts.data);
  return { saved: true, path: target };
});

ipcMain.handle('file:openProject', async (e) => {
  if (!trusted(e)) throw new Error('untrusted sender');
  const r = await dialog.showOpenDialog({
    title: 'Open project',
    properties: ['openFile'],
    filters: [{ name: 'PixelForge project', extensions: ['pfs'] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const st = await fs.stat(r.filePaths[0]);
  if (st.size > 1024 * 1024 * 1024) throw new Error('project too large');
  return await fs.readFile(r.filePaths[0], 'utf8');
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
