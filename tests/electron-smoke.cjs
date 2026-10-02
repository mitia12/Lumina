const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const fixture = process.argv[2];
const phase = process.argv[3];
app.setPath('userData', path.join(fixture, 'user-data'));
app.commandLine.appendSwitch('disable-background-timer-throttling');
require('../electron/main.cjs');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function test() {
  let window;
  for (let attempt = 0; attempt < 400; attempt++) {
    window = BrowserWindow.getAllWindows()[0];
    if (window && !window.webContents.isLoadingMainFrame()) {
      const ready = await window.webContents.executeJavaScript('typeof state !== "undefined" && state.sessionReady').catch(() => false);
      if (ready) break;
    }
    await delay(100);
  }
  assert(window, 'Main window created');
  const evaluate = (script) => window.webContents.executeJavaScript(script, true);
  assert(await evaluate('state.sessionReady'), 'Startup completed');
  const errors = [];
  window.webContents.on('console-message', (_event, _level, message) => {
    if (message.startsWith('Uncaught')) errors.push(message);
  });
  const first = path.join(fixture, 'first');
  const nested = path.join(first, 'nested');
  const deep = path.join(nested, 'deep');
  const space = async () => {
    await delay(30);
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
    if (await evaluate('document.activeElement?.matches("input, textarea")')) {
      window.webContents.sendInputEvent({ type: 'char', keyCode: ' ' });
    }
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
    await delay(400);
  };
  const clickNativeFullscreen = async () => {
    if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
    const debuggerClient = window.webContents.debugger;
    await debuggerClient.sendCommand('DOM.enable');
    await evaluate(`(async () => {
      const video = dom.preview.querySelector('video');
      await video.play();
      video.pause();
      video.scrollIntoView();
    })()`);
    const { root } = await debuggerClient.sendCommand('DOM.getDocument', { depth: -1, pierce: true });
    const flatten = (node) => [node, ...[...(node.children || []), ...(node.shadowRoots || [])].flatMap(flatten)];
    const video = flatten(root).find(node => node.nodeName === 'VIDEO' && node.attributes?.includes('data-path'));
    assert(video, 'Preview video found in DOM');
    const button = flatten(video).find(node => node.attributes?.includes('-webkit-media-controls-fullscreen-button'));
    assert(button, 'Native fullscreen button found');
    const { model } = await debuggerClient.sendCommand('DOM.getBoxModel', { nodeId: button.nodeId });
    const x = Math.round((model.content[0] + model.content[4]) / 2);
    const y = Math.round((model.content[1] + model.content[5]) / 2);
    window.webContents.sendInputEvent({ type: 'mouseMove', x, y });
    window.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    window.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    await delay(300);
  };
  if (phase === 'initial') {
    assert.equal(await evaluate('state.roots.length'), 2);
    assert.equal(await evaluate('[...expandedTreePaths()].some(item => /\.(webm|wav|txt)$/.test(item))'), false, 'Only folders are saved as expanded');
    await evaluate(`(async () => {
      dom.previewHistoryToggle.checked = true;
      dom.previewHistoryToggle.dispatchEvent(new Event('change'));
      selectMedia(state.media.find(item => item.name === 'one.webm'));
      selectMedia(state.media.find(item => item.name === 'two.webm'));
      await Promise.all([...dom.preview.querySelectorAll('video')].map(video => new Promise(resolve => {
        if (video.readyState >= 1) return resolve();
        video.addEventListener('loadedmetadata', resolve, { once: true });
        video.preload = 'auto';
        video.load();
      })));
      document.activeElement.blur();
    })()`);
    assert.equal(await evaluate('[...dom.preview.querySelectorAll("video")].every(media => media.muted)'), true, 'Muted by default');
    await space();
    assert.equal(await evaluate('dom.preview.querySelector("video").paused'), false, 'Space plays top video');
    assert.equal(await evaluate('state.autoplay'), false, 'Space leaves gallery autoplay alone');
    await space();
    assert.equal(await evaluate('dom.preview.querySelector("video").paused'), true, 'Space pauses top video');
    await evaluate(`dom.preview.querySelectorAll('video')[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
    await space();
    assert.equal(await evaluate('dom.preview.querySelectorAll("video")[1].paused'), false, 'Space targets last interaction');
    await space();
    await evaluate(`dom.preview.querySelector('video').muted = false`);
    await delay(100);
    assert.equal(await evaluate('[...dom.preview.querySelectorAll("video")].every(media => !media.muted)'), true, 'Unmute shared');
    await evaluate(`dom.preview.querySelectorAll('video')[1].muted = true`);
    await delay(100);
    assert.equal(await evaluate('[...dom.preview.querySelectorAll("video")].every(media => media.muted)'), true, 'Mute shared');
    await evaluate(`dom.preview.querySelector('video').volume = 0.35`);
    await delay(100);
    assert.equal(await evaluate('[...dom.preview.querySelectorAll("video")].every(media => media.volume === 0.35)'), true, 'Volume shared');
    await evaluate(`dom.previewSoundToggle.checked = true; dom.previewSoundToggle.dispatchEvent(new Event('change'))`);
    assert.equal(await evaluate('[...dom.preview.querySelectorAll("video")].every(media => !media.muted)'), true, 'Sound preference applied immediately');
    await evaluate(`selectMedia(state.media.find(item => item.name === 'sound.wav')); document.activeElement.blur()`);
    assert.equal(await evaluate('[...dom.preview.querySelectorAll("video, audio")].every(media => !media.muted && media.volume === 0.35)'), true, 'New media inherits sound');
    await evaluate(`state.lastPreviewMediaPath = null`);
    await space();
    assert.equal(await evaluate('dom.preview.querySelector("audio").paused'), false, 'Audio supports Space');
    await space();
    await clickNativeFullscreen();
    await delay(250);
    assert.equal(await evaluate('document.fullscreenElement?.tagName'), 'VIDEO', 'Native video fullscreen');
    await space();
    assert.equal(await evaluate('document.fullscreenElement?.tagName'), 'VIDEO', 'Space keeps fullscreen open');
    assert.equal(await evaluate('document.fullscreenElement.paused'), false, 'Fullscreen Space plays fullscreen media');
    assert.equal(await evaluate('dom.preview.querySelector("audio").paused'), true, 'Fullscreen Space leaves audio paused');
    await space();
    assert.equal(await evaluate('document.fullscreenElement?.tagName'), 'VIDEO', 'Pausing keeps fullscreen open');
    assert.equal(await evaluate('document.fullscreenElement.paused'), true, 'Fullscreen Space pauses');
    await evaluate('document.exitFullscreen()');
    await delay(200);
    await evaluate(`openSettings()`);
    await space();
    assert.equal(await evaluate('[...dom.preview.querySelectorAll("video, audio")].every(media => media.paused)'), true, 'Settings blocks playback shortcut');
    await evaluate(`closeSettings(); selectMedia(state.media.find(item => item.name === 'note.txt'))`);
    await delay(100);
    await evaluate(`dom.previewHistoryToggle.checked = false; dom.previewHistoryToggle.dispatchEvent(new Event('change'))`);
    await delay(100);
    await evaluate(`document.querySelector('.text-editor').focus(); document.querySelector('.text-editor').setSelectionRange(0, 0)`);
    await space();
    assert.equal(await evaluate('document.querySelector(".text-editor").value'), ' Editable text', 'Space types in editor');
    await evaluate(`selectMedia(state.media.find(item => item.name === 'one.webm')); document.activeElement.blur()`);
    await space();
    assert.equal(await evaluate('dom.preview.querySelector("video").paused'), false, 'Single preview supports Space');
    await space();
    await evaluate(`(async () => {
      const rootNode = [...dom.tree.querySelectorAll('.library-root-node')][0];
      const nestedNode = [...rootNode.querySelectorAll('.tree-node')].find(node => node.dataset.path === ${JSON.stringify(nested)});
      nestedNode.querySelector('.tree-chevron').click();
      await new Promise(resolve => setTimeout(resolve, 150));
      const deepNode = [...nestedNode.querySelectorAll('.tree-node')].find(node => node.dataset.path === ${JSON.stringify(deep)});
      deepNode.querySelector('.tree-chevron').click();
      const secondRoot = dom.tree.querySelectorAll('.library-root-node')[1];
      secondRoot.querySelector('.tree-chevron').click();
      await selectDirectory(${JSON.stringify(deep)});
      state.recursive = true;
      dom.restoreSessionToggle.checked = true;
      dom.restoreSessionToggle.dispatchEvent(new Event('change'));
      openSettings();
    })()`);
    await delay(300);
    const screenshotDirectory = path.join(__dirname, '..', 'release');
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    await window.webContents.capturePage().then((image) => fs.writeFileSync(path.join(screenshotDirectory, `settings-${app.getVersion()}.png`), image.toPNG()));
    assert.equal(await evaluate('dom.restoreSessionToggle.checked'), true);
  } else if (phase === 'restore') {
    assert.equal(await evaluate('state.roots.length'), 2, 'All roots restored');
    assert.equal(await evaluate('state.currentDirectory'), deep, 'Current nested folder restored');
    assert.equal(await evaluate('state.recursive'), true, 'Recursive view restored');
    assert.equal(await evaluate(`expandedTreePaths().has(normalizeComparablePath(${JSON.stringify(nested)}))`), true, 'Nested folder expanded');
    assert.equal(await evaluate(`expandedTreePaths().has(normalizeComparablePath(${JSON.stringify(deep)}))`), true, 'Deep folder expanded');
    assert.equal(await evaluate('dom.tree.querySelectorAll(".library-root-node")[1].querySelector(".tree-children").classList.contains("hidden")'), true, 'Collapsed root stays collapsed');
    assert.equal(await evaluate('dom.previewSoundToggle.checked'), true, 'Sound preference persists across restarts');
    await evaluate(`dom.restoreSessionToggle.checked = false; dom.restoreSessionToggle.dispatchEvent(new Event('change'))`);
  } else if (phase === 'disabled' || phase === 'corrupt') {
    assert.equal(await evaluate('state.roots.length'), 0, 'Starts empty when disabled or session damaged');
    assert.equal(await evaluate('dom.restoreSessionToggle.checked'), false);
  } else if (phase === 'missing') {
    assert.equal(await evaluate('state.roots.length'), 2, 'Missing root skipped');
    assert.equal(await evaluate('state.currentDirectory'), first, 'Missing current folder falls back to root');
  }
  await delay(200);
  assert.deepEqual(errors, [], 'No renderer errors');
  console.log(`PASS ${phase}`);
  window.close();
}

app.whenReady().then(test).catch((error) => {
  console.error(`FAIL ${phase}:`, error);
  app.exit(1);
});
