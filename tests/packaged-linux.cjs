const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { fileURLToPath } = require('node:url');

const version = require('../package.json').version;
const release = path.resolve(__dirname, '..', 'release');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-package-test-'));
const mediaDirectory = path.join(temporary, 'Media');
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
fs.mkdirSync(mediaDirectory);
fs.copyFileSync(path.join(__dirname, '..', 'src', 'assets', 'icon.png'), path.join(mediaDirectory, 'Photo.png'));
const videoFile = path.join(mediaDirectory, 'Video.webm');
const fixture = spawnSync(require('ffmpeg-static'), ['-loglevel', 'error', '-f', 'lavfi', '-i',
  'color=c=gray:s=160x90:r=12', '-t', '10', '-c:v', 'libvpx', '-y', videoFile]);
assert.equal(fixture.status, 0, 'Video fixture created');

async function check(executable, extraArguments, label) {
  const configDirectory = path.join(temporary, label, 'config');
  const userData = path.join(configDirectory, 'lumina-gallery');
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(path.join(userData, 'last-session.json'), JSON.stringify({
    restoreEnabled: true, roots: [mediaDirectory], currentDirectory: mediaDirectory,
    expandedPaths: [mediaDirectory], recursive: false
  }));
  const environment = { ...process.env, XDG_CONFIG_HOME: configDirectory };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(executable, [...extraArguments, '--no-sandbox', '--remote-debugging-port=9333'], { env: environment, detached: true });
  let diagnostics = '';
  child.stdout.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-6000); });
  child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-6000); });
  let socket;
  try {
    let target;
    for (let attempt = 0; attempt < 300; attempt++) {
      if (child.exitCode !== null) throw new Error(`${label} exited: ${diagnostics}`);
      try {
        const targets = await fetch('http://127.0.0.1:9333/json/list').then(response => response.json());
        target = targets.find(entry => entry.type === 'page');
        if (target) break;
      } catch {}
      await delay(100);
    }
    assert(target, `${label} exposes a running application page`);
    const pagePath = fileURLToPath(target.url);
    assert(label === 'AppImage'
      ? pagePath.startsWith('/tmp/appimage_extracted_')
      : pagePath.startsWith(path.join(path.dirname(executable), 'resources') + path.sep), `${label} runs its own packaged application`);
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await once(socket, 'open');
    let nextId = 0;
    const requests = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const request = requests.get(message.id);
      if (!request) return;
      requests.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
    const command = (method, params) => new Promise((resolve, reject) => {
      const id = ++nextId;
      requests.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    let ready = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      ready = await evaluate('typeof state !== "undefined" && state.sessionReady').catch(() => false);
      if (ready) break;
      await delay(100);
    }
    assert(ready, `${label} completed startup`);
    assert.equal(await evaluate('state.roots.length'), 1, `${label} restored its media folder`);
    assert.equal(await evaluate('state.currentDirectory'), mediaDirectory, `${label} preserves path case`);
    assert.equal(await evaluate('window.lumina.platform'), 'linux');
    assert(await evaluate('document.querySelector(".brand-mark img").naturalWidth > 0'), 'Packaged logo loaded');
    for (const name of ['Photo.png', 'Video.webm']) {
      assert.equal(await evaluate(`(async () => {
        const media = state.media.find(item => item.name === ${JSON.stringify(name)});
        const response = await fetch(media.thumbnailUrl);
        const bytes = new Uint8Array(await response.arrayBuffer());
        return response.ok && bytes[0] === 255 && bytes[1] === 216;
      })()`), true, `${label} generated thumbnail for ${name}`);
    }
    assert.equal(await evaluate(`(async () => {
      const response = await fetch(state.media.find(item => item.name === 'Video.webm').previewUrl);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return response.ok && bytes[0] === 0x1a && bytes[1] === 0x45;
    })()`), true, `${label} bundled FFmpeg generated WebM preview`);
    const screenshot = await command('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(release, `ubuntu-${label}-${version}.png`), Buffer.from(screenshot.data, 'base64'));
    console.log(`PASS packaged ${label}: startup, session, logo, thumbnails, FFmpeg previews`);
  } catch (error) {
    console.error(diagnostics);
    throw error;
  } finally {
    socket?.close();
    const exited = once(child, 'exit');
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await Promise.race([exited, delay(3000)]);
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    child.stdout.destroy();
    child.stderr.destroy();
  }
}

(async () => {
  await check(path.join(release, `Lumina-Gallery-${version}-linux-x86_64.AppImage`), ['--appimage-extract-and-run'], 'AppImage');
  const extracted = path.join(temporary, 'deb');
  const deb = path.join(release, `Lumina-Gallery-${version}-linux-amd64.deb`);
  const metadata = spawnSync('dpkg-deb', ['-f', deb, 'Version', 'Architecture'], { encoding: 'utf8' });
  assert.equal(metadata.status, 0);
  assert(metadata.stdout.includes(version) && metadata.stdout.includes('amd64'), 'DEB version and architecture verified');
  assert.equal(spawnSync('dpkg-deb', ['-x', deb, extracted]).status, 0, 'DEB extracted');
  await check(path.join(extracted, 'opt', 'Lumina Gallery', 'lumina-gallery'), [], 'DEB');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  if (path.dirname(temporary) === path.resolve(os.tmpdir()) && path.basename(temporary).startsWith('lumina-package-test-')) {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
