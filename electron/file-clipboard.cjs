const { spawn } = require('node:child_process');
const { existsSync, promises: fs } = require('node:fs');
const path = require('node:path');

// Windows apps read copied files from CF_HDROP; Electron's clipboard API can
// only write text, HTML and images, so the file list is placed through the
// .NET clipboard wrappers instead of a plain path string.
const WINDOWS_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.jpe', '.jfif', '.bmp', '.gif', '.tif', '.tiff', '.ico']);
const MAX_CLIPBOARD_IMAGE_BYTES = 32 * 1024 * 1024;
const CLIPBOARD_TIMEOUT_MS = 20000;

const WINDOWS_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$payload = [Console]::In.ReadToEnd()
if (-not $payload) { throw 'Пустое содержимое буфера обмена.' }
$request = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload.Trim())) | ConvertFrom-Json
$files = [string[]]@($request.files)
if ($files.Length -eq 0) { throw 'Нет файлов для копирования.' }
$data = New-Object System.Windows.Forms.DataObject
$data.SetData([System.Windows.Forms.DataFormats]::FileDrop, $files)
$bitmap = $null
if ($request.image) {
  try {
    $bitmap = [System.Drawing.Bitmap]::FromFile([string]$request.image)
    $stream = New-Object System.IO.MemoryStream
    try {
      $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
      $data.SetData('PNG', $stream.ToArray())
    } finally { $stream.Dispose() }
    $data.SetImage($bitmap)
  } catch {
    if ($bitmap) { $bitmap.Dispose(); $bitmap = $null }
  }
}
try {
  $copied = $false
  $lastError = $null
  for ($attempt = 0; $attempt -lt 6 -and -not $copied; $attempt++) {
    try {
      [System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
      $copied = $true
    } catch {
      $lastError = $_
      Start-Sleep -Milliseconds 120
    }
  }
  if (-not $copied) { throw $lastError }
} finally {
  if ($bitmap) { $bitmap.Dispose() }
}
`;

function runProcess(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Буфер обмена не отвечает.'));
    }, CLIPBOARD_TIMEOUT_MS);
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (code === 0) finish();
      else finish(new Error(stderr.trim() || `Процесс буфера обмена завершился с кодом ${code}.`));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

function powershellExecutable() {
  const windowsDirectory = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const bundled = path.join(windowsDirectory, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return existsSync(bundled) ? bundled : 'powershell.exe';
}

async function clipboardImagePath(paths) {
  if (paths.length !== 1) return null;
  const itemPath = paths[0];
  if (!WINDOWS_IMAGE_EXTENSIONS.has(path.extname(itemPath).toLowerCase())) return null;
  try {
    const stat = await fs.stat(itemPath);
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_CLIPBOARD_IMAGE_BYTES) return null;
  } catch { return null; }
  return itemPath;
}

async function writeWindowsClipboard(paths, imagePath) {
  const payload = Buffer.from(JSON.stringify({ files: paths, image: imagePath }), 'utf8').toString('base64');
  const command = Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64');
  await runProcess(powershellExecutable(), [
    '-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden', '-EncodedCommand', command
  ], payload);
  return true;
}

function uriList(paths) {
  return `${paths.map((itemPath) => {
    const normalized = itemPath.split(path.sep).join('/');
    return `file://${encodeURI(normalized).replace(/[?#]/g, encodeURIComponent)}`;
  }).join('\r\n')}\r\n`;
}

async function writeLinuxClipboard(paths) {
  const tools = process.env.WAYLAND_DISPLAY
    ? [['wl-copy', ['--type', 'text/uri-list']], ['xclip', ['-selection', 'clipboard', '-t', 'text/uri-list', '-i']]]
    : [['xclip', ['-selection', 'clipboard', '-t', 'text/uri-list', '-i']], ['wl-copy', ['--type', 'text/uri-list']]];
  const payload = uriList(paths);
  for (const [tool, args] of tools) {
    try {
      await runProcess(tool, args, payload);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return false;
}

// Places real file objects on the system clipboard so other applications and
// websites receive the file itself instead of its path.
async function copyFilesToClipboard(paths) {
  if (process.platform === 'win32') {
    return writeWindowsClipboard(paths, await clipboardImagePath(paths));
  }
  if (process.platform === 'linux') {
    return writeLinuxClipboard(paths);
  }
  return false;
}

module.exports = { copyFilesToClipboard };
