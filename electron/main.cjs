const { app, BrowserWindow, dialog, ipcMain, protocol, shell, nativeImage } = require('electron');
const { promises: fs, watch, createReadStream, constants: fsConstants } = require('node:fs');
const { Readable } = require('node:stream');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const path = require('node:path');
const bundledFfmpegPath = require('ffmpeg-static');

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.jfif', '.png', '.gif', '.webp', '.bmp', '.avif', '.svg', '.ico', '.tif', '.tiff'
]);
const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv', '.wmv', '.mpeg', '.mpg', '.ogv', '.3gp'
]);
const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wma', '.aif', '.aiff'
]);
const TEXT_EXTENSIONS = new Set(['.txt', '.md']);
const MAX_TEXT_FILE_SIZE = 10 * 1024 * 1024;

const MEDIA_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v',
  '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.wmv': 'video/x-ms-wmv',
  '.mpeg': 'video/mpeg', '.mpg': 'video/mpeg', '.ogv': 'video/ogg', '.3gp': 'video/3gpp',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg',
  '.wma': 'audio/x-ms-wma', '.aif': 'audio/aiff', '.aiff': 'audio/aiff'
};

let mainWindow;
let currentRoots = [];
const rootWatchers = new Map();
let watchTimer = null;
const thumbnailCache = new Map();
const MAX_THUMBNAILS = 300;
const thumbnailJobs = [];
let activeThumbnailJobs = 0;
const nameCollator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
const previewJobs = [];
const previewJobsByKey = new Map();
let activePreviewJobs = 0;
let previewCacheDirectory = null;
let thumbnailCacheDirectory = null;
let externalDragIcon = null;
const cancelledExternalDrags = new Set();
const PREVIEW_CACHE_LIMIT = 1.5 * 1024 * 1024 * 1024;
const THUMBNAIL_CACHE_LIMIT = 768 * 1024 * 1024;

function runThumbnailJob(task) {
  return new Promise((resolve, reject) => {
    thumbnailJobs.push({ task, resolve, reject });
    drainThumbnailJobs();
  });
}

function drainThumbnailJobs() {
  while (activeThumbnailJobs < 4 && thumbnailJobs.length) {
    const job = thumbnailJobs.shift();
    activeThumbnailJobs += 1;
    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        activeThumbnailJobs -= 1;
        drainThumbnailJobs();
      });
  }
}

function resolvedFfmpegPath() {
  return app.isPackaged ? bundledFfmpegPath.replace('app.asar', 'app.asar.unpacked') : bundledFfmpegPath;
}

function previewCachePath(filePath, stat) {
  const key = createHash('sha1').update(`${filePath}|${stat.size}|${stat.mtimeMs}`).digest('hex');
  return path.join(previewCacheDirectory, `${key}.webm`);
}

function thumbnailCachePath(filePath, stat) {
  const key = createHash('sha1').update(`${filePath}|${stat.size}|${stat.mtimeMs}|jpeg72`).digest('hex');
  return { key, filePath: path.join(thumbnailCacheDirectory, `${key}.jpg`) };
}

async function ensureThumbnail(filePath, stat) {
  const cached = thumbnailCachePath(filePath, stat);
  let jpeg = thumbnailCache.get(cached.key);
  if (jpeg) {
    thumbnailCache.delete(cached.key);
    thumbnailCache.set(cached.key, jpeg);
    return jpeg;
  }
  try {
    jpeg = await fs.readFile(cached.filePath);
    const now = new Date();
    fs.utimes(cached.filePath, now, now).catch(() => {});
  } catch {
    const thumbnail = await runThumbnailJob(() => nativeImage.createThumbnailFromPath(filePath, { width: 480, height: 360 }));
    if (thumbnail.isEmpty()) throw new Error('Thumbnail is empty');
    jpeg = thumbnail.toJPEG(72);
    await fs.writeFile(cached.filePath, jpeg);
  }
  thumbnailCache.set(cached.key, jpeg);
  if (thumbnailCache.size > MAX_THUMBNAILS) thumbnailCache.delete(thumbnailCache.keys().next().value);
  return jpeg;
}

function runFfmpegPreview(sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp.webm`;
    const args = [
      '-hide_banner', '-loglevel', 'error', '-ss', '0', '-i', sourcePath, '-t', '2.5',
      '-vf', 'scale=360:202:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=12',
      '-an', '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '220k',
      '-maxrate', '300k', '-bufsize', '600k', '-threads', '2', '-f', 'webm', '-y', temporaryPath
    ];
    const processHandle = spawn(resolvedFfmpegPath(), args, { windowsHide: true, stdio: 'ignore' });
    const timeout = setTimeout(() => processHandle.kill(), 30000);
    processHandle.once('error', async (error) => {
      clearTimeout(timeout);
      await fs.rm(temporaryPath, { force: true }).catch(() => {});
      reject(error);
    });
    processHandle.once('exit', async (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      try {
        await fs.rename(temporaryPath, outputPath);
        resolve(outputPath);
      } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        reject(error);
      }
    });
  });
}

function drainPreviewJobs() {
  while (activePreviewJobs < 2 && previewJobs.length) {
    const job = previewJobs.shift();
    activePreviewJobs += 1;
    runFfmpegPreview(job.sourcePath, job.outputPath)
      .then(job.resolve, job.reject)
      .finally(() => {
        activePreviewJobs -= 1;
        previewJobsByKey.delete(job.outputPath);
        drainPreviewJobs();
      });
  }
}

async function ensureVideoPreview(sourcePath, stat) {
  const outputPath = previewCachePath(sourcePath, stat);
  try {
    await fs.access(outputPath);
    const now = new Date();
    fs.utimes(outputPath, now, now).catch(() => {});
    return outputPath;
  } catch {}

  if (previewJobsByKey.has(outputPath)) return previewJobsByKey.get(outputPath);
  const promise = new Promise((resolve, reject) => {
    previewJobs.push({ sourcePath, outputPath, resolve, reject });
    drainPreviewJobs();
  });
  previewJobsByKey.set(outputPath, promise);
  return promise;
}

async function pruneCacheDirectory(directoryPath, extension, limit) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith(extension)).map(async (entry) => {
    const filePath = path.join(directoryPath, entry.name);
    const stat = await fs.stat(filePath);
    return { filePath, size: stat.size, usedAt: stat.mtimeMs };
  }));
  let total = files.reduce((sum, file) => sum + file.size, 0);
  for (const file of files.sort((left, right) => left.usedAt - right.usedAt)) {
    if (total <= limit) break;
    await fs.rm(file.filePath, { force: true });
    total -= file.size;
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lumina-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

function isWithinRoot(targetPath) {
  if (!currentRoots.length || typeof targetPath !== 'string') return false;
  const target = path.resolve(targetPath);
  return currentRoots.some((rootPath) => {
    const root = path.resolve(rootPath);
    const relative = path.relative(root, target);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  });
}

function isOpenedRoot(targetPath) {
  const target = path.resolve(targetPath);
  return currentRoots.some((rootPath) => pathsEqual(path.resolve(rootPath), target));
}

function requireSafePath(targetPath) {
  if (!isWithinRoot(targetPath)) {
    throw new Error('Путь находится за пределами открытой папки.');
  }
  return path.resolve(targetPath);
}

function pathsEqual(left, right) {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function validateEntryName(value) {
  if (typeof value !== 'string') throw new Error('Введите имя.');
  const name = value.trim();
  if (!name || name === '.' || name === '..') throw new Error('Введите корректное имя.');
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(name) || /[. ]$/.test(name)) {
    throw new Error('Имя содержит недопустимые для Windows символы.');
  }
  const baseName = name.split('.')[0].toUpperCase();
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(baseName)) {
    throw new Error('Это имя зарезервировано Windows.');
  }
  return name;
}

function requireTextPath(itemPath) {
  const safePath = requireSafePath(itemPath);
  if (!TEXT_EXTENSIONS.has(path.extname(safePath).toLowerCase())) {
    throw new Error('Встроенный редактор поддерживает только TXT и MD.');
  }
  return safePath;
}

function mediaKind(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  return null;
}

function toMediaUrl(filePath) {
  return `lumina-media://asset/?path=${encodeURIComponent(filePath)}`;
}

function toThumbnailUrl(filePath) {
  return `lumina-media://thumb/?path=${encodeURIComponent(filePath)}`;
}

function toPreviewUrl(filePath) {
  return `lumina-media://preview/?path=${encodeURIComponent(filePath)}`;
}

async function serveThumbnailRequest(request) {
  try {
    const requestUrl = new URL(request.url);
    const filePath = requireSafePath(decodeURIComponent(requestUrl.searchParams.get('path') || ''));
    const stat = await fs.stat(filePath);
    const jpeg = await ensureThumbnail(filePath, stat);
    return new Response(jpeg, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(jpeg.length),
        'Cache-Control': 'private, max-age=31536000, immutable'
      }
    });
  } catch {
    return new Response('Thumbnail unavailable', { status: 404 });
  }
}

function parseByteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value || '');
  if (!match) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!suffixLength) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

async function streamFileRequest(request, filePath, contentType, cacheControl = 'private, max-age=60') {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) return new Response('Not found', { status: 404 });
    const rangeHeader = request.headers.get('range');
    const headers = {
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
      'Cache-Control': cacheControl
    };

    if (request.method === 'HEAD') {
      headers['Content-Length'] = String(stat.size);
      return new Response(null, { status: 200, headers });
    }

    if (stat.size === 0) {
      headers['Content-Length'] = '0';
      return new Response(null, { status: 200, headers });
    }

    let status = 200;
    let start = 0;
    let end = stat.size - 1;
    if (rangeHeader) {
      const range = parseByteRange(rangeHeader, stat.size);
      if (!range) {
        headers['Content-Range'] = `bytes */${stat.size}`;
        return new Response(null, { status: 416, headers });
      }
      ({ start, end } = range);
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length'] = String(end - start + 1);

    const nodeStream = createReadStream(filePath, { start, end, highWaterMark: 256 * 1024 });
    request.signal?.addEventListener('abort', () => nodeStream.destroy(), { once: true });
    return new Response(Readable.toWeb(nodeStream), { status, headers });
}

async function serveMediaRequest(request) {
  try {
    const requestUrl = new URL(request.url);
    const filePath = requireSafePath(decodeURIComponent(requestUrl.searchParams.get('path') || ''));
    const contentType = MEDIA_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    return await streamFileRequest(request, filePath, contentType);
  } catch (error) {
    const status = error?.code === 'ENOENT' ? 404 : 500;
    return new Response(status === 404 ? 'Not found' : 'Media read error', { status });
  }
}

async function servePreviewRequest(request) {
  try {
    const requestUrl = new URL(request.url);
    const sourcePath = requireSafePath(decodeURIComponent(requestUrl.searchParams.get('path') || ''));
    const stat = await fs.stat(sourcePath);
    const previewPath = await ensureVideoPreview(sourcePath, stat);
    return await streamFileRequest(request, previewPath, 'video/webm', 'private, max-age=31536000, immutable');
  } catch {
    return serveMediaRequest(request);
  }
}

function serializeEntry(parentPath, dirent) {
  const fullPath = path.join(parentPath, dirent.name);
  const kind = dirent.isDirectory() ? 'directory' : (mediaKind(dirent.name) || 'file');
  const hasVisualThumbnail = kind === 'image' || kind === 'video' || kind === 'audio';
  return {
    name: dirent.name,
    path: fullPath,
    kind,
    url: kind && kind !== 'directory' ? toMediaUrl(fullPath) : null,
    thumbnailUrl: hasVisualThumbnail ? toThumbnailUrl(fullPath) : null,
    previewUrl: kind === 'video' ? toPreviewUrl(fullPath) : null
  };
}

function compareEntries(left, right) {
  if (left.kind === 'directory' && right.kind !== 'directory') return -1;
  if (left.kind !== 'directory' && right.kind === 'directory') return 1;
  return nameCollator.compare(left.name, right.name);
}

async function readVisibleChildren(directoryPath) {
  const safeDirectory = requireSafePath(directoryPath);
  const entries = await fs.readdir(safeDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map((entry) => serializeEntry(safeDirectory, entry))
    .sort(compareEntries);
}

async function listMedia(directoryPath, recursive) {
  const safeDirectory = requireSafePath(directoryPath);
  const pending = [safeDirectory];
  const media = [];

  while (pending.length) {
    const batch = pending.splice(0, 12);
    const directories = await Promise.all(batch.map(async (directory) => {
      try {
        return { directory, entries: await fs.readdir(directory, { withFileTypes: true }) };
      } catch (error) {
        if (error.code === 'EACCES' || error.code === 'EPERM' || error.code === 'ENOENT') {
          return { directory, entries: [] };
        }
        throw error;
      }
    }));

    for (const { directory, entries } of directories) {
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (recursive) pending.push(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;
        const kind = mediaKind(entry.name) || 'file';
        media.push({
          name: entry.name,
          path: fullPath,
          directory,
          relativeDirectory: path.relative(safeDirectory, directory) || '.',
          kind,
          url: toMediaUrl(fullPath),
          thumbnailUrl: kind === 'image' || kind === 'video' || kind === 'audio' ? toThumbnailUrl(fullPath) : null,
          previewUrl: kind === 'video' ? toPreviewUrl(fullPath) : null
        });
      }
    }
  }

  return media.sort((left, right) => nameCollator.compare(left.name, right.name));
}

function closeRootWatchers() {
  clearTimeout(watchTimer);
  watchTimer = null;
  for (const watcher of rootWatchers.values()) watcher.close();
  rootWatchers.clear();
}

function syncRootWatchers() {
  for (const [rootPath, watcher] of rootWatchers) {
    if (currentRoots.some((entry) => pathsEqual(entry, rootPath))) continue;
    watcher.close();
    rootWatchers.delete(rootPath);
  }
  for (const rootPath of currentRoots) {
    if ([...rootWatchers.keys()].some((entry) => pathsEqual(entry, rootPath))) continue;
    try {
      const watcher = watch(rootPath, { recursive: true }, () => {
        thumbnailCache.clear();
        clearTimeout(watchTimer);
        watchTimer = setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('filesystem:changed');
          }
        }, 500);
      });
      watcher.on('error', () => {
        watcher.close();
        rootWatchers.delete(rootPath);
      });
      rootWatchers.set(rootPath, watcher);
    } catch {
      // Просмотрщик продолжит работать без автоматического обновления этой папки.
    }
  }
}

async function chooseRoot() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Добавить папки с файлами',
    properties: ['openDirectory', 'multiSelections']
  });
  if (result.canceled || !result.filePaths.length) return null;

  for (const selectedPath of result.filePaths) {
    const resolvedPath = path.resolve(selectedPath);
    if (!currentRoots.some((rootPath) => pathsEqual(rootPath, resolvedPath))) currentRoots.push(resolvedPath);
  }
  thumbnailCache.clear();
  syncRootWatchers();
  return serializeRoots();
}

function serializeRoots() {
  return currentRoots.map((rootPath) => ({
    name: path.basename(rootPath) || rootPath,
    path: rootPath,
    kind: 'directory'
  }));
}

async function prepareMediaItems(sender, items, requestId) {
  const uniqueItems = [...new Map((Array.isArray(items) ? items : []).map((item) => [item.path, item])).values()];
  const total = uniqueItems.length;
  let nextIndex = 0;
  let completed = 0;
  let errors = 0;
  const report = () => {
    if (!sender.isDestroyed()) sender.send('folder:prepare-progress', { requestId, completed, total, errors });
  };
  report();

  const worker = async () => {
    while (nextIndex < total) {
      const item = uniqueItems[nextIndex++];
      try {
        const filePath = requireSafePath(item.path);
        const stat = await fs.stat(filePath);
        const tasks = [];
        if (item.kind === 'image' || item.kind === 'video' || item.kind === 'audio') tasks.push(ensureThumbnail(filePath, stat));
        if (item.kind === 'video') tasks.push(ensureVideoPreview(filePath, stat));
        await Promise.all(tasks);
      } catch {
        errors += 1;
      }
      completed += 1;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, total) }, () => worker()));
  pruneCacheDirectory(previewCacheDirectory, '.webm', PREVIEW_CACHE_LIMIT).catch(() => {});
  pruneCacheDirectory(thumbnailCacheDirectory, '.jpg', THUMBNAIL_CACHE_LIMIT).catch(() => {});
  return { completed, total, errors };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 940,
    minHeight: 640,
    backgroundColor: '#0b0d12',
    title: 'Lumina Gallery',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Подписываемся до загрузки: на быстрых системах ready-to-show может
  // сработать раньше, чем завершится await loadFile, оставив окно скрытым.
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  await mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // Страховка для редких случаев, когда Chromium не отправил ready-to-show.
  if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

app.whenReady().then(async () => {
  previewCacheDirectory = path.join(app.getPath('userData'), 'video-previews');
  thumbnailCacheDirectory = path.join(app.getPath('userData'), 'thumbnail-cache');
  await Promise.all([
    fs.mkdir(previewCacheDirectory, { recursive: true }),
    fs.mkdir(thumbnailCacheDirectory, { recursive: true })
  ]);
  externalDragIcon = await app.getFileIcon(process.execPath, { size: 'large' }).catch(() => nativeImage.createEmpty());
  pruneCacheDirectory(previewCacheDirectory, '.webm', PREVIEW_CACHE_LIMIT).catch(() => {});
  pruneCacheDirectory(thumbnailCacheDirectory, '.jpg', THUMBNAIL_CACHE_LIMIT).catch(() => {});
  const testRootsValue = !app.isPackaged
    ? (process.env.LUMINA_TEST_ROOT
      || process.argv.find((argument) => argument.startsWith('--lumina-test-roots='))?.slice('--lumina-test-roots='.length))
    : null;
  if (testRootsValue) {
    currentRoots = testRootsValue
      .split(path.delimiter)
      .filter(Boolean)
      .map((rootPath) => path.resolve(rootPath));
    syncRootWatchers();
  }
  protocol.handle('lumina-media', (request) => {
    const requestUrl = new URL(request.url);
    if (requestUrl.hostname === 'thumb') return serveThumbnailRequest(request);
    if (requestUrl.hostname === 'preview') return servePreviewRequest(request);
    return serveMediaRequest(request);
  });

  ipcMain.handle('folder:choose', chooseRoot);
  ipcMain.handle('root:list', () => serializeRoots());
  ipcMain.handle('root:detach', async (_event, rootPath) => {
    if (typeof rootPath !== 'string' || !isOpenedRoot(rootPath)) throw new Error('Папка не является открытым корнем.');
    const safeRoot = path.resolve(rootPath);
    currentRoots = currentRoots.filter((entry) => !pathsEqual(entry, safeRoot));
    syncRootWatchers();
    return serializeRoots();
  });
  ipcMain.handle('root:trash', async (_event, rootPath) => {
    if (typeof rootPath !== 'string' || !isOpenedRoot(rootPath)) throw new Error('Папка не является открытым корнем.');
    const safeRoot = path.resolve(rootPath);
    await shell.trashItem(safeRoot);
    currentRoots = currentRoots.filter((entry) => !isPathInside(entry, safeRoot));
    syncRootWatchers();
    return serializeRoots();
  });
  ipcMain.handle('folder:children', (_event, directoryPath) => readVisibleChildren(directoryPath));
  ipcMain.handle('folder:media', (_event, directoryPath, recursive) => listMedia(directoryPath, Boolean(recursive)));
  ipcMain.handle('folder:prepare', (event, items, requestId) => prepareMediaItems(event.sender, items, requestId));
  ipcMain.handle('item:info', async (_event, itemPath) => {
    const safePath = requireSafePath(itemPath);
    const stat = await fs.stat(safePath);
    return {
      size: stat.size,
      createdAt: stat.birthtimeMs,
      modifiedAt: stat.mtimeMs
    };
  });
  ipcMain.handle('item:trash', async (_event, itemPath) => {
    const safePath = requireSafePath(itemPath);
    if (isOpenedRoot(safePath)) {
      throw new Error('Нельзя удалить открытую корневую папку.');
    }
    await shell.trashItem(safePath);
    return true;
  });
  ipcMain.handle('item:reveal', async (_event, itemPath) => {
    const safePath = requireSafePath(itemPath);
    shell.showItemInFolder(safePath);
    return true;
  });
  ipcMain.handle('item:open-default', async (_event, itemPath) => {
    const safePath = requireSafePath(itemPath);
    const errorMessage = await shell.openPath(safePath);
    if (errorMessage) throw new Error(errorMessage);
    return true;
  });
  ipcMain.handle('item:move', async (_event, itemPath, destinationPath, viewDirectoryPath) => {
    const safeItemPath = requireSafePath(itemPath);
    const safeDestinationPath = requireSafePath(destinationPath);
    const safeViewDirectoryPath = requireSafePath(viewDirectoryPath);
    if (isOpenedRoot(safeItemPath)) throw new Error('Корневую папку нельзя перемещать. Сначала открепите её.');
    const sourceStat = await fs.stat(safeItemPath);
    const destinationStat = await fs.stat(safeDestinationPath);
    if (!destinationStat.isDirectory()) throw new Error('Цель перемещения не является папкой.');
    if (sourceStat.isDirectory() && isPathInside(safeDestinationPath, safeItemPath)) {
      throw new Error('Нельзя переместить папку внутрь самой себя.');
    }

    const fileName = path.basename(safeItemPath);
    const targetPath = requireSafePath(path.join(safeDestinationPath, fileName));
    const samePath = pathsEqual(safeItemPath, targetPath);
    const kind = sourceStat.isDirectory() ? 'directory' : (mediaKind(fileName) || 'file');
    const serializeMovedItem = () => ({
      name: fileName,
      path: targetPath,
      directory: safeDestinationPath,
      relativeDirectory: path.relative(safeViewDirectoryPath, safeDestinationPath) || '.',
      kind,
      url: kind === 'directory' ? null : toMediaUrl(targetPath),
      thumbnailUrl: kind === 'image' || kind === 'video' || kind === 'audio' ? toThumbnailUrl(targetPath) : null,
      previewUrl: kind === 'video' ? toPreviewUrl(targetPath) : null
    });
    if (samePath) return { moved: false, item: serializeMovedItem() };

    try {
      await fs.access(targetPath);
      throw new Error(`В папке «${path.basename(safeDestinationPath)}» уже есть файл «${fileName}».`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    try {
      await fs.rename(safeItemPath, targetPath);
    } catch (error) {
      if (error.code !== 'EXDEV') throw error;
      let targetCreated = false;
      try {
        if (sourceStat.isDirectory()) {
          // fs.cp may create part of the directory before it throws.
          targetCreated = true;
          await fs.cp(safeItemPath, targetPath, { recursive: true, errorOnExist: true, force: false });
        } else {
          await fs.copyFile(safeItemPath, targetPath, fsConstants.COPYFILE_EXCL);
          targetCreated = true;
        }
        if (!sourceStat.isDirectory()) {
          const [copiedStat, currentSourceStat] = await Promise.all([fs.stat(targetPath), fs.stat(safeItemPath)]);
          if (copiedStat.size !== sourceStat.size
            || currentSourceStat.size !== sourceStat.size
            || currentSourceStat.mtimeMs !== sourceStat.mtimeMs) {
            throw new Error('Файл изменился во время копирования. Исходник сохранён.');
          }
          await fs.utimes(targetPath, sourceStat.atime, sourceStat.mtime).catch(() => {});
        }
        try {
          await shell.trashItem(safeItemPath);
        } catch (trashError) {
          throw new Error(`Не удалось удалить исходник после копирования: ${trashError.message || String(trashError)}`);
        }
      } catch (copyError) {
        const sourceExists = await fs.access(safeItemPath).then(() => true, () => false);
        if (targetCreated && sourceExists) await fs.rm(targetPath, { recursive: true, force: true }).catch(() => {});
        throw copyError;
      }
    }
    return { moved: true, item: serializeMovedItem() };
  });
  ipcMain.handle('item:import-external', async (_event, sourcePaths, destinationPath) => {
    if (!Array.isArray(sourcePaths) || sourcePaths.length === 0 || sourcePaths.length > 256) {
      throw new Error('Выберите от 1 до 256 файлов для переноса.');
    }
    const safeDestinationPath = requireSafePath(destinationPath);
    const destinationStat = await fs.stat(safeDestinationPath);
    if (!destinationStat.isDirectory()) throw new Error('Цель переноса не является папкой.');

    const imported = [];
    const errors = [];
    for (const sourceValue of sourcePaths) {
      let sourcePath = '';
      let targetPath = '';
      let createdTarget = false;
      try {
        if (typeof sourceValue !== 'string' || !sourceValue || !path.isAbsolute(sourceValue)) {
          throw new Error('Windows не передала корректный путь к файлу.');
        }
        sourcePath = path.resolve(sourceValue);
        const sourceStat = await fs.stat(sourcePath);
        if (!sourceStat.isFile()) throw new Error('Перенос папок пока не поддерживается.');

        const fileName = path.basename(sourcePath);
        targetPath = requireSafePath(path.join(safeDestinationPath, fileName));
        if (pathsEqual(sourcePath, targetPath)) {
          throw new Error('Файл уже находится в выбранной папке.');
        }

        await fs.copyFile(sourcePath, targetPath, fsConstants.COPYFILE_EXCL);
        createdTarget = true;
        const [copiedStat, currentSourceStat] = await Promise.all([fs.stat(targetPath), fs.stat(sourcePath)]);
        if (copiedStat.size !== sourceStat.size
          || currentSourceStat.size !== sourceStat.size
          || currentSourceStat.mtimeMs !== sourceStat.mtimeMs) {
          await fs.rm(targetPath, { force: true });
          throw new Error('Файл изменился во время копирования. Повторите перенос.');
        }
        await fs.utimes(targetPath, sourceStat.atime, sourceStat.mtime).catch(() => {});
        try {
          await shell.trashItem(sourcePath);
        } catch (error) {
          await fs.rm(targetPath, { force: true }).catch(() => {});
          throw new Error(`Не удалось удалить исходник: ${error.message || String(error)}`);
        }
        imported.push({ name: fileName, sourcePath, targetPath, destinationPath: safeDestinationPath });
      } catch (error) {
        if (createdTarget && targetPath) {
          const sourceStillExists = await fs.access(sourcePath).then(() => true, () => false);
          if (sourceStillExists) await fs.rm(targetPath, { force: true }).catch(() => {});
        }
        errors.push({
          path: sourcePath || String(sourceValue || ''),
          name: path.basename(sourcePath || String(sourceValue || 'Файл')),
          message: error.code === 'EEXIST'
            ? `В папке уже есть файл «${path.basename(targetPath)}».`
            : (error.message || String(error))
        });
      }
    }
    return { imported, errors };
  });
  ipcMain.handle('item:rename', async (_event, itemPath, newNameValue) => {
    const safeItemPath = requireSafePath(itemPath);
    if (isOpenedRoot(safeItemPath)) {
      throw new Error('Нельзя переименовать открытую корневую папку.');
    }
    const newName = validateEntryName(newNameValue);
    const parentDirectory = path.dirname(safeItemPath);
    const targetPath = requireSafePath(path.join(parentDirectory, newName));
    if (safeItemPath === targetPath) return { renamed: false, path: safeItemPath, name: path.basename(safeItemPath) };

    if (!pathsEqual(safeItemPath, targetPath)) {
      try {
        await fs.access(targetPath);
        throw new Error(`Элемент «${newName}» уже существует.`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    await fs.rename(safeItemPath, targetPath);
    const stat = await fs.stat(targetPath);
    return {
      renamed: true,
      name: newName,
      path: targetPath,
      kind: stat.isDirectory() ? 'directory' : (mediaKind(newName) || 'file')
    };
  });
  ipcMain.handle('folder:create', async (_event, directoryPath, folderNameValue) => {
    const safeDirectoryPath = requireSafePath(directoryPath);
    const stat = await fs.stat(safeDirectoryPath);
    if (!stat.isDirectory()) throw new Error('Новая папка может быть создана только внутри папки.');
    const folderName = validateEntryName(folderNameValue);
    const folderPath = requireSafePath(path.join(safeDirectoryPath, folderName));
    try {
      await fs.mkdir(folderPath);
    } catch (error) {
      if (error.code === 'EEXIST') throw new Error(`Элемент «${folderName}» уже существует.`);
      throw error;
    }
    return { name: folderName, path: folderPath, kind: 'directory' };
  });
  ipcMain.handle('text:read', async (_event, itemPath) => {
    const safePath = requireTextPath(itemPath);
    const stat = await fs.stat(safePath);
    if (!stat.isFile()) throw new Error('Выбранный элемент не является файлом.');
    if (stat.size > MAX_TEXT_FILE_SIZE) throw new Error('Файл слишком большой для редактора (максимум 10 МБ).');
    const buffer = await fs.readFile(safePath);
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    return { text, modifiedAt: stat.mtimeMs, size: stat.size };
  });
  ipcMain.handle('text:write', async (_event, itemPath, content) => {
    const safePath = requireTextPath(itemPath);
    if (typeof content !== 'string') throw new Error('Некорректное содержимое файла.');
    if (Buffer.byteLength(content, 'utf8') > MAX_TEXT_FILE_SIZE) {
      throw new Error('Текст превышает допустимый размер 10 МБ.');
    }
    const stat = await fs.stat(safePath);
    if (!stat.isFile()) throw new Error('Выбранный элемент не является файлом.');
    await fs.writeFile(safePath, content, 'utf8');
    const updatedStat = await fs.stat(safePath);
    return { modifiedAt: updatedStat.mtimeMs, size: updatedStat.size };
  });
  ipcMain.on('item:start-external-drag', (event, itemPaths) => {
    const sender = event.sender;
    cancelledExternalDrags.delete(sender.id);
    let safePaths = [];
    try {
      const requestedPaths = Array.isArray(itemPaths) ? itemPaths : [itemPaths];
      if (!requestedPaths.length || requestedPaths.length > 256) {
        throw new Error('Для переноса выберите от 1 до 256 элементов.');
      }
      safePaths = [...new Set(requestedPaths.map((itemPath) => requireSafePath(itemPath)))];
      const startedAt = Date.now();
      const dragFiles = safePaths.length === 1 ? { file: safePaths[0] } : { files: safePaths };
      sender.startDrag({ ...dragFiles, icon: externalDragIcon || nativeImage.createEmpty() });
      const dragDurationMs = Date.now() - startedAt;
      void (async () => {
        // startDrag blocks this IPC handler. Let a drop back into Lumina
        // enqueue its cancellation before deciding whether to remove sources.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const cancelled = cancelledExternalDrags.delete(sender.id);
        const items = [];
        for (const safePath of safePaths) {
          let sourceExists = await fs.access(safePath).then(() => true, () => false);
          let removedOriginal = false;
          let error = null;
          // An instant return means Windows did not start a real native drag.
          if (!cancelled && sourceExists && dragDurationMs >= 120) {
            try {
              await shell.trashItem(safePath);
              sourceExists = false;
              removedOriginal = true;
            } catch (trashError) {
              error = `Элемент скопирован, но не удалось убрать исходник: ${trashError.message || String(trashError)}`;
            }
          }
          items.push({ path: safePath, sourceExists, removedOriginal, error });
        }

        if (!sender.isDestroyed()) {
          sender.send('item:external-drag-ended', { items, dragDurationMs, cancelled });
        }
      })().catch((error) => {
        if (!sender.isDestroyed()) {
          sender.send('item:external-drag-ended', {
            items: safePaths.map((safePath) => ({
              path: safePath,
              sourceExists: true,
              removedOriginal: false,
              error: `Не удалось завершить перенос: ${error.message || String(error)}`
            })),
            dragDurationMs
          });
        }
      });
    } catch (error) {
      if (!sender.isDestroyed()) {
        sender.send('item:external-drag-ended', {
          items: (safePaths.length ? safePaths : (Array.isArray(itemPaths) ? itemPaths : [itemPaths]))
            .filter(Boolean)
            .map((itemPath) => ({
              path: itemPath,
              sourceExists: true,
              removedOriginal: false,
              error: error.message || String(error)
            }))
        });
      }
    }
  });
  ipcMain.on('item:cancel-external-drag', (event) => {
    cancelledExternalDrags.add(event.sender.id);
  });

  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeRootWatchers();
  if (process.platform !== 'darwin') app.quit();
});
