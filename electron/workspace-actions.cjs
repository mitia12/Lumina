const { promises: fs, constants } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { MAX_BOARD_SIZE, validateBoard } = require('./board.cjs');

function registerWorkspaceActions({ ipcMain, clipboard, requireSafePath, validateEntryName, serializeEntry, isPathInside }) {
  let copiedPaths = [];
  const entry = async (itemPath) => {
    const stat = await fs.stat(itemPath);
    return serializeEntry(path.dirname(itemPath), {
      name: path.basename(itemPath), isDirectory: () => stat.isDirectory()
    });
  };
  const boardPath = (value) => {
    const safe = requireSafePath(value);
    if (path.extname(safe).toLowerCase() !== '.board') throw new Error('Выберите файл .board.');
    return safe;
  };
  const resolveAttachments = async (safe, data) => Object.fromEntries(await Promise.all(
    data.nodes.filter((n) => n.type === 'file').map(async (node) => {
      try {
        const filePath = requireSafePath(path.resolve(path.dirname(safe), node.path));
        const item = await entry(filePath);
        if (item.kind === 'directory') throw new Error('Вложение является папкой.');
        return [node.id, item];
      } catch (error) {
        return [node.id, { name: path.basename(node.path), error: error.message }];
      }
    })));

  ipcMain.handle('board:create', async (_event, directoryPath, value, initialData) => {
    const directory = requireSafePath(directoryPath);
    const data = validateBoard(initialData || { format: 'lumina-board', version: 1, nodes: [] });
    if (typeof value !== 'string') throw new Error('Введите имя доски.');
    const name = validateEntryName(value.toLowerCase().endsWith('.board') ? value : `${value}.board`);
    const safe = boardPath(path.join(directory, name));
    try {
      await fs.writeFile(safe, JSON.stringify(data, null, 2), { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (error.code === 'EEXIST') throw new Error(`Файл «${name}» уже существует.`);
      throw error;
    }
    return entry(safe);
  });
  ipcMain.handle('board:read', async (_event, value) => {
    const safe = boardPath(value);
    const stat = await fs.stat(safe);
    if (!stat.isFile() || stat.size > MAX_BOARD_SIZE) throw new Error('Board должен быть файлом размером до 10 МБ.');
    const data = validateBoard(JSON.parse((await fs.readFile(safe, 'utf8')).replace(/^\uFEFF/, '')));
    return { data, modifiedAt: stat.mtimeMs, attachments: await resolveAttachments(safe, data) };
  });
  ipcMain.handle('board:write', async (_event, value, data, modifiedAt) => {
    const safe = boardPath(value);
    validateBoard(data);
    const stat = await fs.stat(safe);
    if (!stat.isFile() || stat.mtimeMs !== modifiedAt) throw new Error('Файл board изменён извне. Сохраните копию или откройте его заново.');
    const temporary = `${safe}.${randomUUID()}.tmp`;
    try {
      const handle = await fs.open(temporary, 'wx');
      try {
        await handle.writeFile(JSON.stringify(data, null, 2), 'utf8');
        await handle.sync();
      } finally { await handle.close(); }
      await fs.rename(temporary, safe);
    } finally { await fs.unlink(temporary).catch(() => {}); }
    return { modifiedAt: (await fs.stat(safe)).mtimeMs };
  });
  ipcMain.handle('board:attach', async (_event, value, filePaths) => {
    const safe = boardPath(value);
    if (!Array.isArray(filePaths) || filePaths.length > 1000) throw new Error('Слишком много вложений.');
    return Promise.all(filePaths.map(async (value) => {
      const filePath = requireSafePath(value);
      const item = await entry(filePath);
      if (item.kind === 'directory') throw new Error('Перенесите на доску файлы, а не папку.');
      return { path: path.relative(path.dirname(safe), filePath), item };
    }));
  });

  ipcMain.handle('item:copy', async (_event, values) => {
    if (!Array.isArray(values) || !values.length || values.length > 1000) throw new Error('Выберите файлы для копирования.');
    const nextPaths = [...new Set(values.map(requireSafePath))];
    await Promise.all(nextPaths.map((value) => fs.access(value)));
    copiedPaths = nextPaths;
    clipboard.writeText(copiedPaths.join('\n'));
    return copiedPaths.length;
  });
  ipcMain.handle('item:paste', async (_event, value) => {
    const destination = requireSafePath(value);
    if (!(await fs.stat(destination)).isDirectory()) throw new Error('Выберите папку для вставки.');
    if (!copiedPaths.length) throw new Error('Сначала скопируйте файлы в Lumina.');
    const copied = [], errors = [];
    for (const value of copiedPaths) {
      try {
        const source = requireSafePath(value);
        const stat = await fs.lstat(source);
        if (stat.isSymbolicLink()) throw new Error('Копирование символических ссылок не поддерживается.');
        if (stat.isDirectory() && isPathInside(destination, source)) throw new Error('Нельзя копировать папку внутрь неё самой.');
        const originalName = path.basename(source);
        const ext = stat.isDirectory() ? '' : path.extname(originalName);
        const base = originalName.slice(0, originalName.length - ext.length);
        let target = requireSafePath(path.join(destination, originalName));
        for (let number = 1; ; number++) {
          try { await fs.lstat(target); }
          catch (error) { if (error.code === 'ENOENT') break; throw error; }
          target = requireSafePath(path.join(destination, `${base} — копия${number > 1 ? ` (${number})` : ''}${ext}`));
        }
        if (stat.isDirectory()) {
          await fs.cp(source, target, { recursive: true, force: false, errorOnExist: true, filter: async (itemPath) => {
            if ((await fs.lstat(itemPath)).isSymbolicLink()) throw new Error('Папка содержит символическую ссылку.');
            return true;
          } });
        } else { await fs.copyFile(source, target, constants.COPYFILE_EXCL); }
        copied.push(await entry(target));
      } catch (error) { errors.push({ name: path.basename(value), message: error.message }); }
    }
    return { copied, errors };
  });
}

module.exports = { registerWorkspaceActions };
