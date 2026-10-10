const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateBoard } = require('../electron/board.cjs');

module.exports = async function testBoardInteractions(window, directory) {
  window.hide(); window.webContents.setBackgroundThrottling(false);
  if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
  const evaluate = async (script) => {
    try { return await window.webContents.executeJavaScript(script, true); }
    catch (error) { console.error('Board interaction script failed:', script); throw error; }
  };
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (script) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(script)) return; await delay(30); }
    assert.fail(`Timed out: ${script}`);
  };
  const boardPath = path.join(directory, 'Управление.board');
  await evaluate(`(async () => {
    state.rightWidth = 600; fitPanelWidths();
    const item = await window.lumina.createBoard(${JSON.stringify(directory)}, 'Управление'); await whiteboard.open(item);
    whiteboard.setZoom(.5);
    await whiteboard.attach(state.allMedia.filter(n => /photo\.png$/.test(n.name)).map(n => n.path), { x: 40, y: 200 });
  })()`);
  assert.equal(await evaluate('whiteboard.autoSave'), false, 'Autosave defaults to off');
  const mouse = async (type, x, y, button = 'left', clickCount = 1) => {
    const point = await evaluate(`(() => { const r = whiteboard.surface.getBoundingClientRect(); return { x: r.left + ${x} * whiteboard.zoom, y: r.top + ${y} * whiteboard.zoom }; })()`);
    await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type, ...point, button,
      buttons: type === 'mousePressed' ? button === 'right' ? 2 : 1 : type === 'mouseMoved' && button === 'left' ? 1 : 0, clickCount });
    await delay(20);
  };
  const click = async (x, y, button = 'left', count = 1) => { await mouse('mousePressed', x, y, button, count); await mouse('mouseReleased', x, y, button, count); };
  const lineMenu = async (type) => {
    const point = await evaluate(`(() => {
      const node = whiteboard.data.nodes.find(n => n.type === ${JSON.stringify(type)});
      const line = whiteboard.svg.querySelector('[data-id="' + node.id + '"]');
      const point = line.getPointAtLength(line.getTotalLength() / 2); return { x: point.x, y: point.y };
    })()`);
    await click(point.x, point.y, 'right');
  };
  await delay(500);
  assert.equal(JSON.parse(fs.readFileSync(boardPath, 'utf8')).nodes.length, 0, 'Manual mode does not write changes automatically');
  assert.equal(await evaluate('whiteboard.items.querySelectorAll(".board-file .board-node-handle, .board-open-file, .board-file-label").length'), 0, 'File cards have no names or open buttons');
  assert.equal(await evaluate('getComputedStyle(whiteboard.scroll).scrollbarWidth'), 'none', 'Board scrollbars are hidden');
  assert.equal(await evaluate('getComputedStyle(whiteboard.items.querySelector(".board-file-body")).overflow'), 'hidden', 'Attachments have no scrollable body');
  assert.equal(await evaluate(`(() => { const node = whiteboard.items.querySelector('.board-file'), image = node.querySelector('img'); return image.clientHeight === node.clientHeight && image.clientWidth === node.clientWidth; })()`), true, 'Media occupies its entire card');
  await click(120, 250, 'right');
  assert.equal(await evaluate('whiteboard.menu.classList.contains("hidden")'), false, 'File right-click opens board menu');
  assert.equal(await evaluate('whiteboard.menu.querySelector("[data-action=open-file]").textContent'), 'Открыть файл');
  assert.equal(await evaluate('whiteboard.menu.querySelector("[data-action=color], [data-action=note-color]")'), null, 'File cards do not offer an unsupported color change');
  await evaluate(`window.previousBoardOpen = whiteboard.callbacks.openFile; whiteboard.callbacks.openFile = item => { window.openedBoardFile = item.path; }; whiteboard.menu.querySelector('[data-action=open-file]').click(); whiteboard.callbacks.openFile = previousBoardOpen; void 0`);
  assert.equal(await evaluate('openedBoardFile'), await evaluate('whiteboard.attachments[whiteboard.data.nodes.find(n => n.type === "file").id].path'), 'Menu opens the clicked file');
  await click(120, 250, 'right'); await evaluate(`whiteboard.menu.querySelector('[data-action=arrow]').click()`);
  await mouse('mouseMoved', 460, 250, 'none');
  assert.equal(await evaluate('whiteboard.svg.querySelectorAll(".board-arrow-preview").length'), 1, 'Arrow preview follows pointer');
  await click(460, 250);
  assert.equal(await evaluate('whiteboard.tool'), 'select', 'Arrow completion selects cursor');
  assert.deepEqual(await evaluate('whiteboard.data.nodes.find(n => n.type === "arrow").end'), { x: 460, y: 250 }, 'File arrow ends at chosen empty location');
  await lineMenu('arrow');
  assert.equal(await evaluate('whiteboard.menu.querySelector("[data-action=color]").textContent'), 'Изменить цвет', 'Arrow right-click offers recoloring');
  await evaluate(`whiteboard.menu.querySelector('[data-action=color]').click(); whiteboard.menu.querySelector('[data-action="#57a5ff"]').click()`);
  assert.equal(await evaluate('whiteboard.data.nodes.find(n => n.type === "arrow").color'), '#57a5ff', 'Palette recolors the existing arrow');
  assert.equal(await evaluate('whiteboard.svg.querySelector(".board-line").getAttribute("stroke")'), '#57a5ff', 'Arrow redraws immediately');
  await evaluate('whiteboard.undo()');
  assert.equal(await evaluate('whiteboard.data.nodes.find(n => n.type === "arrow").color'), '#b7f34a', 'Undo restores the previous color');
  await evaluate('whiteboard.undo(true)');
  assert.equal(await evaluate('whiteboard.data.nodes.find(n => n.type === "arrow").color'), '#57a5ff', 'Redo reapplies the new color');
  validateBoard(await evaluate('whiteboard.data'));
  await click(340, 360); await click(340, 360, 'left', 2);
  assert.equal(await evaluate('whiteboard.data.nodes.filter(n => n.type === "note").length'), 1, 'Native double-click creates a note');
  assert.deepEqual(await evaluate(`(() => { const n = whiteboard.data.nodes.find(n => n.type === 'note'); return [n.x, n.y]; })()`), [340, 360], 'Note appears at double-click location');
  await evaluate(`whiteboard.items.querySelector('.board-note-color').click(); whiteboard.menu.querySelector('[data-action="#ffd3e1"]').click()`);
  assert.equal(await evaluate('whiteboard.data.nodes.find(n => n.type === "note").color'), '#ffd3e1', 'Note palette changes note color');
  assert.equal(await evaluate('getComputedStyle(whiteboard.items.querySelector(".board-note")).backgroundColor'), 'rgb(255, 211, 225)');
  await click(720, 360, 'right');
  assert.deepEqual(await evaluate('[...whiteboard.menu.querySelectorAll("button")].map(n => n.dataset.action)'), ['select', 'note', 'rectangle', 'square', 'circle', 'arrow', 'brush'], 'Empty space menu offers every tool');
  await evaluate('whiteboard.menu.querySelector("[data-action=rectangle]").click()');
  await mouse('mousePressed', 700, 40); await mouse('mouseMoved', 840, 140); await mouse('mouseReleased', 840, 140);
  assert.equal(await evaluate('whiteboard.tool'), 'select', 'Shape completion selects cursor');
  await click(760, 80, 'right');
  await evaluate(`whiteboard.menu.querySelector('[data-action=color]').click(); whiteboard.menu.querySelector('[data-action="#ff6b6b"]').click()`);
  assert.equal(await evaluate('whiteboard.items.querySelector(".board-rectangle rect").getAttribute("stroke")'), '#ff6b6b', 'Shape context menu recolors its outline');
  await evaluate('whiteboard.setTool("brush")');
  for (const y of [200, 300]) {
    await mouse('mousePressed', 720, y); await mouse('mouseMoved', 820, y + 30); await mouse('mouseReleased', 820, y + 30);
  }
  assert.equal(await evaluate('whiteboard.tool'), 'brush', 'Brush remains active for repeated strokes');
  assert.equal(await evaluate('whiteboard.data.nodes.filter(n => n.type === "stroke").length'), 2);
  await lineMenu('stroke');
  await evaluate(`whiteboard.menu.querySelector('[data-action=color]').click(); const input = whiteboard.menu.querySelector('input[type=color]'); input.value = '#123456'; input.dispatchEvent(new Event('change'));`);
  assert.equal(await evaluate('whiteboard.data.nodes.find(n => n.type === "stroke").color'), '#123456', 'Brush lines support a custom color');
  const anchor = await evaluate(`(() => { const r = whiteboard.surface.getBoundingClientRect(); return { x: r.left + 300, y: r.top + 150 }; })()`);
  const before = await evaluate(`({ zoom: whiteboard.zoom, point: whiteboard.point({ clientX: ${anchor.x}, clientY: ${anchor.y} }) })`);
  await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseWheel', ...anchor, deltaX: 0, deltaY: -120, modifiers: 2 });
  await delay(50);
  const after = await evaluate(`({ zoom: whiteboard.zoom, point: whiteboard.point({ clientX: ${anchor.x}, clientY: ${anchor.y} }) })`);
  assert(after.zoom > before.zoom, 'Ctrl+wheel zooms in');
  assert(Math.abs(after.point.x - before.point.x) < 3 && Math.abs(after.point.y - before.point.y) < 3, 'Zoom anchors the board under the pointer');
  await evaluate('whiteboard.setTool("select"); whiteboard.setZoom(.5); whiteboard.scroll.scrollTo(0,0)');
  await evaluate(`dom.galleryScroll.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 's', code: 'KeyS' }))`);
  await until('!whiteboard.dirty && !whiteboard.saving');
  const saved = JSON.parse(fs.readFileSync(boardPath, 'utf8')); assert.deepEqual(saved, await evaluate('whiteboard.data'), 'Ctrl+S saves when focus is outside board');
  await evaluate(`openSettings(); dom.boardAutosaveToggle.checked = true; dom.boardAutosaveToggle.dispatchEvent(new Event('change')); closeSettings()`);
  assert.equal(await evaluate('localStorage.getItem("lumina:board-autosave")'), 'true', 'Autosave preference persists');
  await evaluate(`(() => { const text = whiteboard.items.querySelector('textarea'); text.focus(); text.value = 'Автосохранённая заметка'; text.dispatchEvent(new Event('input')); text.blur(); })()`);
  await until('!whiteboard.dirty && !whiteboard.saving');
  assert.equal(JSON.parse(fs.readFileSync(boardPath, 'utf8')).nodes.find(n => n.type === 'note').text, 'Автосохранённая заметка', 'Autosave writes note changes');
  await evaluate(`dom.boardAutosaveToggle.checked = false; dom.boardAutosaveToggle.dispatchEvent(new Event('change'));
    const text = whiteboard.items.querySelector('textarea'); text.focus(); text.value = 'Ручной режим'; text.dispatchEvent(new Event('input')); text.blur();`);
  await delay(500);
  assert.equal(JSON.parse(fs.readFileSync(boardPath, 'utf8')).nodes.find(n => n.type === 'note').text, 'Автосохранённая заметка', 'Disabling autosave stops subsequent writes');
  await evaluate('togglePanel("right", false)');
  await evaluate('void (window.closingBoard = whiteboard.close())');
  await until('!whiteboard.leaveModal.classList.contains("hidden")');
  assert.equal(await evaluate('dom.workspace.classList.contains("right-hidden")'), false, 'Unsaved dialog opens the collapsed board panel');
  await evaluate(`whiteboard.leaveModal.querySelector('[data-leave=cancel]').click()`);
  await evaluate('closingBoard');
  assert.equal(await evaluate('Boolean(whiteboard.current)'), true, 'Cancel keeps unsaved board open');
  await evaluate('void (window.closingBoard = whiteboard.close())');
  await until('!whiteboard.leaveModal.classList.contains("hidden")');
  await evaluate(`whiteboard.leaveModal.querySelector('[data-leave=discard]').click()`); await evaluate('closingBoard');
  assert.equal(await evaluate('whiteboard.current'), null, 'Discard closes board');
  assert.equal(JSON.parse(fs.readFileSync(boardPath, 'utf8')).nodes.find(n => n.type === 'note').text, 'Автосохранённая заметка', 'Discard retains last saved contents');
  await evaluate(`(async () => { await whiteboard.open({ name: 'Управление.board', path: ${JSON.stringify(boardPath)}, kind: 'file' }); })()`);
  assert.deepEqual(await evaluate('whiteboard.data.nodes.find(n => n.type === "arrow").end'), { x: 460, y: 250 }, 'Reopening preserves free arrow endpoint');
  assert.equal(await evaluate('whiteboard.data.nodes.find(n => n.type === "note").color'), '#ffd3e1', 'Reopening preserves note color');
  assert.equal(await evaluate('whiteboard.data.nodes.find(n => n.type === "arrow").color'), '#57a5ff', 'Reopening preserves arrow color');
  assert.equal(await evaluate('whiteboard.data.nodes.find(n => n.type === "rectangle").color'), '#ff6b6b', 'Reopening preserves shape color');
  assert.equal(await evaluate('whiteboard.data.nodes.find(n => n.type === "stroke").color'), '#123456', 'Reopening preserves the custom stroke color');
  await evaluate('whiteboard.close()');
  await evaluate(`(async () => { const item = await window.lumina.createBoard(${JSON.stringify(directory)}, 'Новая'); await whiteboard.open(item);
    whiteboard.addNote({ x: 30, y: 30 }); })()`);
  await evaluate('void (window.closingBoard = whiteboard.close())'); await until('!whiteboard.leaveModal.classList.contains("hidden")');
  await evaluate(`whiteboard.leaveModal.querySelector('[data-leave=save]').click()`); await evaluate('closingBoard');
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'Новая.board'), 'utf8')).nodes.length, 1, 'Save on closing preserves changes');
  console.log('Board menus, notes, arrows, zoom, manual save and autosave checks passed.');
};
