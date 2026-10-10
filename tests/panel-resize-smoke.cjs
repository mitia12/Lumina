const assert = require('node:assert/strict');

module.exports = async function testPanelResize(window, restored = false) {
  window.webContents.setBackgroundThrottling(false);
  if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
  const evaluate = (script) => window.webContents.executeJavaScript(script, true);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await evaluate('document.querySelectorAll(".media-card").length > 0')) break;
    await delay(50);
  }
  window.hide();
  const fits = async () => {
    await delay(100);
    const layout = await evaluate(`(() => {
      const gallery = document.querySelector('#gallery-panel').getBoundingClientRect();
      const selectors = ['.gallery-toolbar', '.gallery-scroll', '.media-grid', '.media-card',
        '.toolbar-controls > *', '.media-filter', '.location-block'];
      return { right: document.querySelector('#right-panel').getBoundingClientRect().right,
        viewport: dom.workspace.clientWidth, gallery: gallery.width,
        cards: document.querySelectorAll('.media-card').length,
        overflowing: [...document.querySelectorAll(selectors.join(','))].filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && (rect.left < gallery.left - 1 || rect.right > gallery.right + 1);
        }).map(element => ({ className: element.className, right: element.getBoundingClientRect().right,
          galleryRight: gallery.right })) };
    })()`);
    assert(layout.right <= layout.viewport + 1, 'Right panel stays inside the window');
    assert(layout.gallery >= 360, 'Gallery retains its usable minimum width');
    assert(layout.cards > 0, 'Resize check uses a populated gallery');
    assert.deepEqual(layout.overflowing, [], 'Gallery cards and controls stay inside the central panel');
  };
  if (restored) {
    assert(await evaluate('state.rightWidth > 600'), 'Saved width above 600 is restored after restart');
    assert.equal(await evaluate('state.rightWidth'), await evaluate('Number(localStorage.getItem("lumina:right-width"))'));
    await fits();
    console.log('Panel width restoration checked.');
    return;
  }
  const drag = async (distance) => {
    const start = await evaluate(`(() => { const rect = dom.rightResizer.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + 100 }; })()`);
    const send = (type, x, buttons) => window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {
      type, x, y: start.y, button: 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1
    });
    await send('mousePressed', start.x, 1);
    await send('mouseMoved', Math.max(1, start.x - distance), 1);
    await send('mouseReleased', Math.max(1, start.x - distance), 0);
  };
  await drag(500);
  const expanded = await evaluate('state.rightWidth');
  assert(expanded > 600, 'Right panel can be dragged beyond the former fixed limit');
  assert.equal(await evaluate('Number(localStorage.getItem("lumina:right-width"))'), expanded, 'Expanded width is saved');
  await fits();
  await evaluate(`state.tileSize = 420; layoutVirtualGrid(true); void 0;`);
  await fits();
  assert.equal(await evaluate('document.body.classList.contains("resizing")'), false, 'Drag releases pointer capture');
  await evaluate('togglePanel("left", false)');
  await drag(500);
  assert(await evaluate('state.rightWidth') > expanded, 'Collapsed left panel makes its space available to the right panel');
  await fits();
  await evaluate('togglePanel("left", true)');
  await fits();
  window.setSize(1000, 720);
  await delay(150);
  await fits();
  assert(await evaluate('state.rightWidth') < expanded, 'Shrinking the window adjusts panel widths');
  window.setSize(1500, 940);
  await delay(150);
  await drag(500);
  await fits();
  assert(await evaluate('state.rightWidth') > 600);
  console.log('Panel dragging, available width and window resize checks passed.');
};
