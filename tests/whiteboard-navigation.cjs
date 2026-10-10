const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateBoard } = require('../electron/board.cjs');

module.exports = async function testBoardNavigation(window, directory) {
  window.hide(); window.webContents.setBackgroundThrottling(false);
  if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
  const evaluate = (script) => window.webContents.executeJavaScript(script, true);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let buttons = 0;
  const mouse = async (type, point, button = 'left', clickCount = 1) => {
    if (type === 'mousePressed') buttons = button === 'middle' ? 4 : button === 'right' ? 2 : 1;
    if (type === 'mouseReleased') buttons = 0;
    await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
      type, ...point, button: type === 'mouseMoved' && !buttons ? 'none' : button,
      buttons, clickCount: type === 'mouseMoved' ? 0 : clickCount
    });
    await delay(20);
  };
  const click = async (point, button = 'left', count = 1) => {
    await mouse('mousePressed', point, button, count); await mouse('mouseReleased', point, button, count);
  };
  const drag = async (point, dx, dy, button = 'left') => {
    await mouse('mousePressed', point, button);
    const end = { x: point.x + dx, y: point.y + dy };
    await mouse('mouseMoved', end, button); await mouse('mouseReleased', end, button);
  };
  const home = async () => {
    await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
      type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, modifiers: 2
    });
    await window.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
      type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, modifiers: 2
    });
    await delay(30);
  };
  const viewportPoint = (x, y) => evaluate(`(() => { const r = whiteboard.scroll.getBoundingClientRect(); return { x: r.left + ${x}, y: r.top + ${y} }; })()`);
  const file = () => evaluate('whiteboard.data.nodes.find(n => n.id === navigationVideoId)');
  const filePoint = (x, y) => evaluate(`(() => { const r = whiteboard.items.querySelector('[data-id="' + navigationVideoId + '"]').getBoundingClientRect(); return { x: r.left + r.width * ${x}, y: r.top + r.height * ${y} }; })()`);
  const visibleFiles = async () => {
    assert.equal(await evaluate(`(() => {
      const view = whiteboard.scroll.getBoundingClientRect();
      return [...whiteboard.items.querySelectorAll('.board-file')].every(element => {
        const r = element.getBoundingClientRect();
        return r.left >= view.left - 1 && r.top >= view.top - 1 && r.right <= view.right + 1 && r.bottom <= view.bottom + 1;
      });
    })()`), true, 'Returning to attachments makes all file cards visible');
  };
  const boardPath = path.join(directory, 'Навигация.board');
  await evaluate(`(async () => {
    state.rightWidth = 600; fitPanelWidths();
    const item = await window.lumina.createBoard(${JSON.stringify(directory)}, 'Навигация');
    await whiteboard.open(item);
    await whiteboard.attach(state.allMedia.filter(n => n.name === 'one.webm').map(n => n.path), { x: 40, y: 30 });
    window.navigationVideoId = whiteboard.data.nodes.find(n => n.type === 'file').id;
    await whiteboard.save();
  })()`);
  await home(); await visibleFiles();
  assert.equal(await evaluate('whiteboard.items.querySelectorAll(".board-file-move").length'), 0, 'No separate move icon');
  assert.equal(await evaluate('whiteboard.items.querySelectorAll(".board-file .board-node-resize").length'), 4, 'Every corner can resize a file');
  assert.equal(await evaluate(`[...whiteboard.items.querySelectorAll('.board-node-resize')].every(n => getComputedStyle(n).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(n).borderWidth === '0px')`), true, 'Resize corners have no visible squares');

  // Drag actual video pixels in different parts of the card, including near its controls.
  for (const [fraction, dx, dy] of [[.3, -100, -80], [.5, 25, -40], [.75, -55, 30]]) {
    const before = await file(), zoom = await evaluate('whiteboard.zoom');
    const paused = await evaluate('whiteboard.items.querySelector("video").paused');
    await drag(await filePoint(fraction, fraction), dx, dy);
    const after = await file();
    assert(Math.abs(after.x - before.x - dx / zoom) < 1 && Math.abs(after.y - before.y - dy / zoom) < 1, `Video moves when dragged by its surface: ${JSON.stringify({ fraction, before, after, zoom })}`);
    assert.equal(await evaluate('whiteboard.items.querySelector("video").paused'), paused, 'Dragging does not toggle playback');
    await home();
  }
  assert((await file()).x < 0 && (await file()).y < 0, 'Files can cross the former top-left boundary');
  for (const corner of ['nw', 'ne', 'sw', 'se']) {
    await home();
    await evaluate('whiteboard.selected = null; whiteboard.selection()');
    const before = await file(), zoom = await evaluate('whiteboard.zoom');
    const point = await filePoint(corner.includes('w') ? .005 : .995, corner.includes('n') ? .005 : .995);
    const dx = corner.includes('w') ? -20 : 20, dy = corner.includes('n') ? -15 : 15;
    await drag(point, dx, dy);
    const after = await file();
    assert(Math.abs(after.width - before.width - 20 / zoom) < 1 && Math.abs(after.height - before.height - 15 / zoom) < 1, `Resize from ${corner} changes size`);
    assert(Math.abs((corner.includes('w') ? after.x + after.width - before.x - before.width : after.x - before.x)) < 1, 'Opposite horizontal edge stays fixed');
    assert(Math.abs((corner.includes('n') ? after.y + after.height - before.y - before.height : after.y - before.y)) < 1, 'Opposite vertical edge stays fixed');
  }

  // Playback controls still respond to a click rather than a drag.
  window.showInactive(); await home(); await delay(150);
  const playPoint = await evaluate(`(() => { const r = whiteboard.items.querySelector('.board-media-play').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const beforePlay = await file();
  await click(playPoint); await delay(100);
  assert.equal(await evaluate('whiteboard.items.querySelector("video").paused'), false, 'Click still plays video');
  assert.deepEqual(await file(), beforePlay, 'Playback click does not move the file');
  await drag(playPoint, 25, -25);
  assert(Math.abs((await file()).x - beforePlay.x - 25) < 1, 'Dragging even the play button moves the video');
  assert.equal(await evaluate('whiteboard.items.querySelector("video").paused'), false, 'Dragging the play button does not pause playback');
  const seekPoint = await evaluate(`(() => { const r = whiteboard.items.querySelector('.board-media-seek').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await click(seekPoint);
  assert(await evaluate('whiteboard.items.querySelector("video").currentTime > 10'), 'Timeline clicks seek through the video');
  const beforeSeekDrag = await file();
  await drag(seekPoint, -20, -20);
  assert(Math.abs((await file()).x - beforeSeekDrag.x + 20) < 1, 'Timeline surface can also move the card');
  await evaluate('whiteboard.items.querySelector("video").pause(); whiteboard.save()');
  window.hide();

  const savedBeforePan = fs.readFileSync(boardPath, 'utf8'), history = await evaluate('whiteboard.history.length');
  await evaluate('whiteboard.setZoom(.5)');
  for (const [dx, dy] of [[120, 100], [120, 100], [-140, -110], [-140, -110]]) {
    const before = await evaluate('({ camera: whiteboard.camera, zoom: whiteboard.zoom })');
    const start = await viewportPoint(250, 250), anchor = await evaluate(`whiteboard.point({clientX: ${start.x}, clientY: ${start.y}})`);
    await drag(start, dx, dy, 'middle');
    const camera = await evaluate('whiteboard.camera');
    assert(Math.abs(camera.x - before.camera.x + dx / before.zoom) < .001 && Math.abs(camera.y - before.camera.y + dy / before.zoom) < .001, 'Middle drag moves the canvas with the hand');
    const end = { x: start.x + dx, y: start.y + dy };
    const point = await evaluate(`whiteboard.point({clientX: ${end.x}, clientY: ${end.y}})`);
    assert(Math.abs(point.x - anchor.x) < .001 && Math.abs(point.y - anchor.y) < .001, 'The grabbed world point stays under the pointer');
    await delay(100);
    assert.deepEqual(await evaluate('whiteboard.camera'), camera, 'Canvas stops on release without sliding');
  }
  assert.equal(await evaluate('whiteboard.gesture'), null, 'Middle drag releases capture');
  assert.equal(await evaluate('whiteboard.dirty'), false, 'Navigating does not dirty the board');
  assert.equal(await evaluate('whiteboard.history.length'), history, 'Navigating creates no undo records');
  assert.equal(fs.readFileSync(boardPath, 'utf8'), savedBeforePan, 'Panning does not write or change saved objects');

  const anchor = await viewportPoint(180, 160);
  const beforeZoom = await evaluate(`whiteboard.point({clientX: ${anchor.x}, clientY: ${anchor.y}})`);
  await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseWheel', ...anchor, deltaX: 0, deltaY: -120, modifiers: 2 });
  await delay(30);
  const afterZoom = await evaluate(`whiteboard.point({clientX: ${anchor.x}, clientY: ${anchor.y}})`);
  assert(Math.abs(afterZoom.x - beforeZoom.x) < .001 && Math.abs(afterZoom.y - beforeZoom.y) < .001, 'Zoom stays anchored after panning');

  // Travel beyond the old coordinate limit and create content in every direction.
  await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseWheel', ...anchor, deltaX: -300000, deltaY: -300000 });
  await delay(30);
  const negative = await evaluate(`whiteboard.point({clientX: ${anchor.x}, clientY: ${anchor.y}})`);
  assert(negative.x < -100000 && negative.y < -100000, 'No top or left boundary');
  await click(anchor); await click(anchor, 'left', 2);
  assert.equal(await evaluate('whiteboard.data.nodes.filter(n => n.type === "note").length'), 1, 'Blank negative space supports double-click notes');
  await home(); await visibleFiles();
  await evaluate(`(async () => { await whiteboard.attach(state.allMedia.filter(n => n.kind === 'image').slice(0, 1).map(n => n.path), { x: -600, y: -350 }); })()`);
  assert.equal(await evaluate('whiteboard.data.nodes.filter(n => n.type === "file").length'), 2, 'Home check uses multiple attachments');
  await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseWheel', ...anchor, deltaX: 600000, deltaY: 600000 });
  await delay(30);
  const positive = await evaluate(`whiteboard.point({clientX: ${anchor.x}, clientY: ${anchor.y}})`);
  assert(positive.x > 100000 && positive.y > 100000, 'No bottom or right boundary');
  await evaluate('whiteboard.setTool("rectangle")'); await drag(anchor, 70, 60);
  assert.equal(await evaluate('whiteboard.data.nodes.filter(n => n.type === "rectangle").length'), 1, 'Drawing works far from the origin');
  await evaluate('document.querySelector("#settings-button").focus()');
  await home(); await visibleFiles();
  const videoPoint = await filePoint(.5, .5);
  await click(videoPoint, 'right'); await evaluate('whiteboard.menu.querySelector("[data-action=arrow]").click()');
  await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseWheel', ...anchor, deltaX: -300000, deltaY: -300000 });
  await delay(30); await click(anchor);
  assert.equal(await evaluate('whiteboard.data.nodes.some(n => n.type === "arrow" && n.end.x < 0 && n.end.y < 0)'), true, 'Arrow can end at negative coordinates');
  await evaluate('whiteboard.save()');
  const saved = JSON.parse(fs.readFileSync(boardPath, 'utf8')); validateBoard(saved);
  assert(saved.nodes.some(n => n.x < -100000), 'Negative world coordinates are saved');
  await evaluate(`(async () => { await whiteboard.close(); await whiteboard.open({ name: 'Навигация.board', path: ${JSON.stringify(boardPath)} }); })()`);
  assert.deepEqual(await evaluate('whiteboard.data'), saved, 'Reopening preserves all world coordinates');
  await visibleFiles();
  assert(fs.existsSync(path.join(directory, 'one.webm')), 'Original video stays in place');
  await evaluate(`state.boardAutosave = true; whiteboard.addNote({ x: -800, y: -500 });`);
  const panStart = await viewportPoint(250, 250);
  await mouse('mousePressed', panStart, 'middle'); await delay(450);
  assert.equal(await evaluate('whiteboard.dirty'), true, 'Active gestures defer autosave');
  await mouse('mouseReleased', panStart, 'middle');
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await evaluate('!whiteboard.dirty && !whiteboard.saving')) break;
    await delay(30);
  }
  assert.equal(await evaluate('whiteboard.dirty'), false, 'Deferred autosave resumes after the middle button is released');
  await evaluate('state.boardAutosave = false');
  await home(); await delay(150);
  const screenshotDirectory = path.join(__dirname, '..', 'release'); fs.mkdirSync(screenshotDirectory, { recursive: true });
  fs.writeFileSync(path.join(screenshotDirectory, 'whiteboard-navigation-windows.png'), (await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
  await evaluate('whiteboard.close()');
  console.log('Infinite board, grab panning, home shortcut, video dragging and four-corner resizing checks passed.');
};
