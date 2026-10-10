const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { validateBoard } = require('../electron/board.cjs');

module.exports = async function testWhiteboard(window, first, nested) {
  window.hide();
  window.webContents.setBackgroundThrottling(false);
  if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
  const evaluate = async (script) => {
    try { return await window.webContents.executeJavaScript(script, true); }
    catch (error) { console.error('Whiteboard script failed:', script); throw error; }
  };
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (script) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(script)) return; await delay(50); }
    assert.fail(`Timed out: ${script}`);
  };
  const boardPath = path.join(first, 'Проверка.board');
  await evaluate(`(async () => {
    state.rightWidth = 600; fitPanelWidths();
    dom.tree.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 150 }));
    dom.contextCreateBoard.click(); dom.nameInput.value = 'Проверка';
    await submitNameAction(new Event('submit', { cancelable: true }));
  })()`);
  await until('whiteboard.current?.name === "Проверка.board"');
  assert(fs.existsSync(boardPath), 'Create board menu produces a file');
  assert.equal(await evaluate('whiteboard.panel.classList.contains("board-mode")'), true, 'Board opens in right panel');
  assert.equal(await evaluate('isBoardFile(state.allMedia.find(item => item.name === "Проверка.board"))'), true, 'Board recognized in gallery');
  await evaluate('whiteboard.setZoom(0.5)');
  let pressed = false;
  const mouse = async (type, x, y) => {
    const point = await evaluate(`(() => { const r = whiteboard.surface.getBoundingClientRect(); return { x: Math.round(r.left + ${x} * whiteboard.zoom), y: Math.round(r.top + ${y} * whiteboard.zoom) }; })()`);
    if (type === 'mouseDown') pressed = true;
    if (type === 'mouseUp') pressed = false;
    await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
      type: { mouseDown: 'mousePressed', mouseUp: 'mouseReleased', mouseMove: 'mouseMoved' }[type], ...point,
      button: type === 'mouseMove' && !pressed ? 'none' : 'left', buttons: pressed ? 1 : 0, clickCount: type === 'mouseMove' ? 0 : 1
    });
    await delay(30);
  };
  const click = async (x, y) => { await mouse('mouseDown', x, y); await mouse('mouseUp', x, y); };
  const draw = async (tool, start, end) => {
    await evaluate(`whiteboard.setTool(${JSON.stringify(tool)})`);
    await mouse('mouseMove', ...start); await mouse('mouseDown', ...start);
    await mouse('mouseMove', ...end); await mouse('mouseUp', ...end);
  };
  await evaluate('whiteboard.setTool("note")'); await click(30, 30);
  await until('whiteboard.data.nodes.some(n => n.type === "note")');
  await evaluate(`(() => { const text = whiteboard.items.querySelector('textarea'); text.value = ${JSON.stringify('Идея проекта\nВторая строка')}; text.dispatchEvent(new Event('input')); text.blur(); whiteboard.dashed.checked = true; })()`);
  await draw('rectangle', [300, 40], [460, 150]);
  await draw('square', [520, 40], [660, 120]);
  await draw('circle', [720, 40], [840, 160]);
  await draw('brush', [300, 300], [430, 340]);
  console.log('Whiteboard pointer tools checked.');
  const types = await evaluate('whiteboard.data.nodes.map(n => n.type)');
  if (types.length !== 5) {
    console.error(await evaluate(`({ rect: whiteboard.surface.getBoundingClientRect().toJSON(), viewport: [innerWidth, innerHeight], gesture: whiteboard.gesture?.mode, tool: whiteboard.tool, nodes: whiteboard.data.nodes })`));
    fs.writeFileSync(path.join(__dirname, '..', 'release', 'board-debug.png'), (await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
  }
  assert.deepEqual(types, ['note', 'rectangle', 'square', 'circle', 'stroke'], 'Native pointer gestures create all tools');
  const geometry = await evaluate('whiteboard.data.nodes.filter(n => ["square", "circle"].includes(n.type)).map(n => [n.width, n.height, n.dashed])');
  assert(geometry.every(([w, h, dashed]) => w === h && dashed), 'Squares/circles constrain proportions and support dashed lines');
  await evaluate(`whiteboard.setTool('select'); selectMedia(state.allMedia.find(n => n.name === 'photo.png'))`);
  assert.equal(await evaluate('whiteboard.current.name'), 'Проверка.board', 'Gallery selection leaves board available for dropping');
  await evaluate(`(() => {
    const photo = state.allMedia.find(n => n.name === 'photo.png');
    layoutVirtualGrid(true);
    const card = [...dom.grid.querySelectorAll('.media-card')].find(card => card.dataset.path === photo.path);
    const transfer = new DataTransfer(); card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
    const r = whiteboard.surface.getBoundingClientRect();
    const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: r.left + 20, clientY: r.top + 230 });
    whiteboard.scroll.dispatchEvent(over);
    if (!over.defaultPrevented || !whiteboard.scroll.classList.contains('board-drop-target')) throw new Error('Board must accept the gallery drop');
    whiteboard.scroll.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: r.left + 20, clientY: r.top + 230 }));
  })()`);
  await until('whiteboard.data.nodes.some(n => n.type === "file")');
  console.log('Whiteboard copy drop checked.');
  assert(fs.existsSync(path.join(first, 'photo.png')), 'Drop keeps the source file');
  assert.equal(await evaluate('state.allMedia.some(n => n.name === "photo.png")'), true, 'Drop keeps the gallery item');
  await evaluate(`(async () => { await whiteboard.attach(state.allMedia.filter(n => ['one.webm','sound.wav','note.txt'].includes(n.name)).map(n => n.path), { x: 350, y: 460 }); })()`);
  assert.equal(await evaluate('whiteboard.items.querySelectorAll("video, audio, pre").length'), 3, 'Video/audio/text attachments render');
  await evaluate('whiteboard.setTool("arrow")'); await click(45, 45); await click(55, 475);
  assert.equal(await evaluate('whiteboard.data.nodes.filter(n => n.type === "arrow").length'), 1, 'Arrow joins note and attachment');
  await evaluate('whiteboard.setTool("select"); whiteboard.undo()');
  assert.equal(await evaluate('whiteboard.data.nodes.filter(n => n.type === "arrow").length'), 0, 'Undo removes arrow');
  await evaluate('whiteboard.undo(true); whiteboard.scroll.focus()');
  const oldArrow = await evaluate('whiteboard.svg.querySelector("[marker-end]").getAttribute("d")');
  await mouse('mouseDown', 45, 45); await mouse('mouseMove', 80, 80); await mouse('mouseUp', 80, 80);
  assert.notEqual(await evaluate('whiteboard.svg.querySelector("[marker-end]").getAttribute("d")'), oldArrow, 'Moving a node updates the connection');
  await evaluate(`whiteboard.selected = whiteboard.data.nodes.find(n => n.type === 'square').id; whiteboard.selection()`);
  await mouse('mouseDown', 660, 180); await mouse('mouseMove', 700, 210); await mouse('mouseUp', 700, 210);
  assert.deepEqual(await evaluate(`(() => { const node = whiteboard.data.nodes.find(n => n.type === 'square'); return [node.width, node.height]; })()`), [180, 180], 'Resize maintains square proportions');
  await evaluate('whiteboard.save()');
  console.log('Whiteboard saving checked.');
  const saved = JSON.parse(fs.readFileSync(boardPath, 'utf8')); validateBoard(saved);
  assert.equal(saved.nodes.filter(n => n.type === 'file').length, 4, 'All attachment references saved');
  assert(saved.nodes.filter(n => n.type === 'file').every(n => !path.isAbsolute(n.path)), 'References stored relative to board');
  const screenshotDirectory = path.join(__dirname, '..', 'release'); fs.mkdirSync(screenshotDirectory, { recursive: true });
  fs.writeFileSync(path.join(screenshotDirectory, 'whiteboard-windows.png'), (await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
  await evaluate(`(async () => { await whiteboard.close(); await whiteboard.open(state.allMedia.find(n => n.name === 'Проверка.board')); })()`);
  assert.deepEqual(await evaluate('whiteboard.data'), saved, 'Reopening preserves board content');
  await evaluate(`whiteboard.selected = whiteboard.data.nodes.find(n => n.type === 'file' && n.path === 'photo.png').id; whiteboard.removeSelected()`);
  assert.equal(await evaluate('whiteboard.data.nodes.filter(n => n.type === "arrow").length'), 0, 'Removing an endpoint removes its connections');
  assert(fs.existsSync(path.join(first, 'photo.png')), 'Removing board attachment retains source');
  await evaluate('whiteboard.undo(); whiteboard.save()');
  await evaluate(`(async () => {
    const photo = state.allMedia.find(n => n.name === 'photo.png');
    openNameModal('rename', photo); dom.nameInput.value = 'renamed-photo.png';
    await submitNameAction(new Event('submit', { cancelable: true }));
  })()`);
  assert.equal(await evaluate('whiteboard.data.nodes.find(n => n.type === "file" && n.path.includes("photo")).path'), 'renamed-photo.png', 'Rename updates attachment references');
  await evaluate(`(async () => { await copyItems(state.allMedia.find(n => n.name === 'renamed-photo.png')); await pasteItems(${JSON.stringify(first)}); await pasteItems(${JSON.stringify(nested)}); })()`);
  assert(fs.existsSync(path.join(first, 'renamed-photo — копия.png')), 'Paste resolves collisions without overwriting');
  assert(fs.existsSync(path.join(nested, 'renamed-photo.png')), 'Paste copies to another folder');
  assert(fs.existsSync(path.join(first, 'renamed-photo.png')), 'Copy retains original');
  await evaluate(`(async () => { await copyItems(state.allMedia.find(n => n.name === 'note.txt')); await pasteItems(${JSON.stringify(nested)}); })()`);
  assert.equal(fs.readFileSync(path.join(nested, 'note.txt'), 'utf8'), 'Editable text', 'Copy preserves file contents');
  await evaluate(`(async () => { await whiteboard.save(); await whiteboard.close(); })()`);
  const missingData = structuredClone(saved); missingData.nodes.find(n => n.type === 'file').path = 'missing-photo.png';
  fs.writeFileSync(boardPath, JSON.stringify(missingData));
  const missing = await evaluate(`window.lumina.readBoard(${JSON.stringify(boardPath)})`);
  assert(Object.values(missing.attachments).some(n => n.error), 'Missing attachment does not prevent opening board');
  const outsideData = structuredClone(saved); outsideData.nodes.find(n => n.type === 'file').path = path.join(path.dirname(first), 'outside.txt');
  fs.writeFileSync(path.join(path.dirname(first), 'outside.txt'), 'outside root'); fs.writeFileSync(boardPath, JSON.stringify(outsideData));
  const outside = await evaluate(`window.lumina.readBoard(${JSON.stringify(boardPath)})`);
  assert(Object.values(outside.attachments).some(n => n.error), 'Board cannot access files outside opened roots');
  fs.writeFileSync(boardPath, JSON.stringify(saved));
  const revision = (await evaluate(`window.lumina.readBoard(${JSON.stringify(boardPath)})`)).modifiedAt;
  fs.writeFileSync(boardPath, '{corrupt'); fs.utimesSync(boardPath, new Date(), new Date(Date.now() + 1000));
  assert.equal(await evaluate(`window.lumina.writeBoard(${JSON.stringify(boardPath)}, ${JSON.stringify(saved)}, ${revision}).then(() => false, () => true)`), true, 'Save rejects external changes');
  assert.equal(fs.readFileSync(boardPath, 'utf8'), '{corrupt', 'Conflicting file is preserved');
  assert.equal(await evaluate(`window.lumina.readBoard(${JSON.stringify(boardPath)}).then(() => false, () => true)`), true, 'Malformed board rejected');
  fs.writeFileSync(boardPath, JSON.stringify(saved));
  const broken = structuredClone(saved); broken.nodes.find(n => n.type === 'arrow').to = 'absent';
  assert.throws(() => validateBoard(broken), /Стрелка/, 'Invalid references rejected');
  await evaluate(`(async () => { await whiteboard.open({ name: 'Проверка.board', path: ${JSON.stringify(boardPath)}, kind: 'file' }); })()`);
  await evaluate(`whiteboard.data.nodes.find(n => n.type === 'note').text = 'Несохранённая идея'; whiteboard.changed()`);
  fs.writeFileSync(boardPath, JSON.stringify({ ...saved, external: true }));
  fs.utimesSync(boardPath, new Date(), new Date(Date.now() + 2000));
  await evaluate('whiteboard.save().catch(() => {})');
  await evaluate('whiteboard.saveCopy()');
  const copyPath = await evaluate('whiteboard.current.path');
  assert.notEqual(copyPath, boardPath, 'Save copy switches to a new board file');
  assert.equal(JSON.parse(fs.readFileSync(copyPath, 'utf8')).nodes.find(n => n.type === 'note').text, 'Несохранённая идея', 'Save copy recovers unsaved changes after conflict');
  assert.equal(JSON.parse(fs.readFileSync(boardPath, 'utf8')).external, true, 'Save copy preserves externally edited original');
  await evaluate('whiteboard.close()');
  console.log('Whiteboard, copy/paste and source preservation checks passed.');
};
