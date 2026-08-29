const { app, BrowserWindow, dialog, ipcMain, protocol, shell, nativeImage } = require('electron');
const { promises: fs, watch, createReadStream } = require('node:fs');
const { Readable } = require('node:stream');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const path = require('node:path');
const bundledFfmpegPath = require('ffmpeg-static');

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.svg', '.ico', '.tif', '.tiff'
]);
const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.webm', '.mov', '.m4v', '.avi', '.mkv', '.wmv', '.mpeg', '.mpg', '.ogv', '.3gp'
]);
const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.wma', '.aif', '.aiff'
]);

const MEDIA_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
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
let currentRoot = null;
let rootWatcher = null;
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
  if (!currentRoot || typeof targetPath !== 'string') return false;
  const root = path.resolve(currentRoot);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function requireSafePath(targetPath) {
  if (!isWithinRoot(targetPath)) {
    throw new Error('Путь находится за пределами открытой папки.');
  }
  return path.resolve(targetPath);
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
  const kind = dirent.isDirectory() ? 'directory' : mediaKind(dirent.name);
  const hasVisualThumbnail = kind === 'image' || kind === 'video';
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
    .filter((entry) => entry.isDirectory() || (entry.isFile() && mediaKind(entry.name)))
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
        const kind = mediaKind(entry.name);
        if (!kind) continue;
        media.push({
          name: entry.name,
          path: fullPath,
          directory,
          relativeDirectory: path.relative(safeDirectory, directory) || '.',
          kind,
          url: toMediaUrl(fullPath),
          thumbnailUrl: kind === 'image' || kind === 'video' ? toThumbnailUrl(fullPath) : null,
          previewUrl: kind === 'video' ? toPreviewUrl(fullPath) : null
        });
      }
    }
  }

  return media.sort((left, right) => nameCollator.compare(left.name, right.name));
}

function closeRootWatcher() {
  clearTimeout(watchTimer);
  watchTimer = null;
  if (rootWatcher) rootWatcher.close();
  rootWatcher = null;
}

function startRootWatcher() {
  closeRootWatcher();
  if (!currentRoot) return;
  try {
    rootWatcher = watch(currentRoot, { recursive: true }, () => {
      thumbnailCache.clear();
      clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('filesystem:changed');
        }
      }, 500);
    });
    rootWatcher.on('error', () => closeRootWatcher());
  } catch {
    // Просмотрщик продолжит работать без автоматического обновления.
  }
}

async function chooseRoot() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Открыть папку с фото, видео и аудио',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return null;

  currentRoot = path.resolve(result.filePaths[0]);
  thumbnailCache.clear();
  startRootWatcher();
  return {
    name: path.basename(currentRoot) || currentRoot,
    path: currentRoot,
    kind: 'directory'
  };
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
        if (item.kind === 'image' || item.kind === 'video') tasks.push(ensureThumbnail(filePath, stat));
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
  pruneCacheDirectory(previewCacheDirectory, '.webm', PREVIEW_CACHE_LIMIT).catch(() => {});
  pruneCacheDirectory(thumbnailCacheDirectory, '.jpg', THUMBNAIL_CACHE_LIMIT).catch(() => {});
  if (!app.isPackaged && process.env.LUMINA_TEST_ROOT) {
    currentRoot = path.resolve(process.env.LUMINA_TEST_ROOT);
  }
  protocol.handle('lumina-media', (request) => {
    const requestUrl = new URL(request.url);
    if (requestUrl.hostname === 'thumb') return serveThumbnailRequest(request);
    if (requestUrl.hostname === 'preview') return servePreviewRequest(request);
    return serveMediaRequest(request);
  });

  ipcMain.handle('folder:choose', chooseRoot);
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
    await shell.trashItem(safePath);
    return true;
  });
  ipcMain.handle('item:reveal', async (_event, itemPath) => {
    const safePath = requireSafePath(itemPath);
    shell.showItemInFolder(safePath);
    return true;
  });

  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeRootWatcher();
  if (process.platform !== 'darwin') app.quit();
});
