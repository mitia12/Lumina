const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-test-'));
const roots = [path.join(fixture, 'first'), path.join(fixture, 'second')];
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
delete environment.LUMINA_TEST_ROOT;
function run(command, args, env = environment) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', windowsHide: true, timeout: 90000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Process exited with ${result.status}: ${command}`);
}
try {
  fs.mkdirSync(path.join(roots[0], 'Nested', 'Deep'), { recursive: true });
  fs.mkdirSync(roots[1]);
  fs.writeFileSync(path.join(roots[0], 'note.txt'), 'Editable text');
  fs.copyFileSync(path.join(__dirname, '..', 'src', 'assets', 'icon.png'), path.join(roots[0], 'photo.png'));
  if (process.platform === 'linux') {
    fs.writeFileSync(path.join(roots[0], 'Case.txt'), 'Uppercase');
    fs.writeFileSync(path.join(roots[0], 'case.txt'), 'Lowercase');
  }
  run(require('ffmpeg-static'), ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=green:s=160x90:r=12',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=24000', '-t', '30', '-c:v', 'libvpx',
    '-c:a', 'libvorbis', '-y', path.join(roots[0], 'one.webm')]);
  fs.copyFileSync(path.join(roots[0], 'one.webm'), path.join(roots[0], 'two.webm'));
  run(require('ffmpeg-static'), ['-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220',
    '-t', '30', '-y', path.join(roots[0], 'sound.wav')]);
  run(require('ffmpeg-static'), ['-loglevel', 'error', '-i', path.join(roots[0], 'sound.wav'),
    '-i', path.join(roots[0], 'photo.png'), '-map', '0:a', '-map', '1:v', '-c:a', 'libmp3lame',
    '-c:v', 'mjpeg', '-disposition:v', 'attached_pic', '-id3v2_version', '3', '-y', path.join(roots[0], 'album.mp3')]);
  for (const phase of ['initial', 'restore', 'disabled', 'missing', 'corrupt']) {
    const sessionFile = path.join(fixture, 'user-data', 'last-session.json');
    if (phase === 'missing') {
      fs.writeFileSync(sessionFile, JSON.stringify({ restoreEnabled: true, roots: [...roots, path.join(fixture, 'gone')],
        currentDirectory: path.join(roots[0], 'removed'), expandedPaths: [roots[0]], recursive: true }));
    } else if (phase === 'corrupt') {
      fs.writeFileSync(sessionFile, '{invalid json');
    }
    run(require('electron'), [...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      path.join(__dirname, 'electron-smoke.cjs'), fixture, phase],
      phase === 'initial' ? { ...environment, LUMINA_TEST_ROOT: roots.join(path.delimiter) } : environment);
  }
  console.log('All Electron regression checks passed.');
} finally {
  const resolved = path.resolve(fixture);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('lumina-test-')) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
