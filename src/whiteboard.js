/* Board files contain references to attachments, never imported or moved files. */
class Whiteboard {
  constructor(panel, callbacks) {
    this.callbacks = callbacks;
    this.panel = panel;
    this.tool = 'select';
    this.zoom = 1;
    this.camera = { x: 0, y: 0 };
    this.history = [];
    this.future = [];
    this.attachments = {};
    this.element = document.createElement('section');
    this.element.className = 'whiteboard hidden';
    this.element.innerHTML = `
      <header class="board-heading"><div><span class="eyebrow">Whiteboard</span><h2 class="board-title"></h2></div><button class="button ghost board-close" title="Закрыть доску">Закрыть</button></header>
      <div class="board-toolbar" role="toolbar" aria-label="Инструменты доски">
        <button data-tool="select" title="Выделение и перемещение">Курсор</button>
        <button data-tool="note">Заметка</button><button data-tool="rectangle">Прямоугольник</button>
        <button data-tool="square">Квадрат</button><button data-tool="circle">Круг</button>
        <button data-tool="arrow" title="Нажмите на первый, затем на второй элемент">Стрелка</button><button data-tool="brush">Кисть</button>
        <label title="Цвет линии или фигуры">Цвет <input class="board-color" type="color" value="#b7f34a" aria-label="Цвет линии" /></label>
        <label>Линия <input class="board-line-width" type="number" min="1" max="30" value="3" aria-label="Толщина линии" /></label>
        <label><input class="board-dashed" type="checkbox" /> Пунктир</label>
        <button class="board-undo" title="Ctrl+Z">Отменить</button><button class="board-redo" title="Ctrl+Shift+Z">Повторить</button>
        <button class="board-delete">Удалить элемент</button><button class="board-save" title="Ctrl+S">Сохранить</button><button class="board-save-copy" title="Сохранить доску в новый файл">Сохранить копию</button>
        <button class="board-zoom-out" aria-label="Уменьшить доску">−</button><output class="board-zoom">100%</output><button class="board-zoom-in" aria-label="Увеличить доску">+</button>
      </div>
      <div class="board-status" role="status"></div>
      <div class="board-scroll" tabindex="0" aria-label="Доска: перетащите сюда файлы из галереи">
        <div class="board-space"><div class="board-surface"><svg class="board-lines" xmlns="http://www.w3.org/2000/svg"></svg><div class="board-items"></div></div></div>
      </div>
      <div class="board-help">Средняя кнопка: двигать холст · Ctrl+Пробел: к объектам · Ctrl+колесо: масштаб · Двойной клик: заметка · Ctrl+S: сохранить</div>
      <div class="board-leave-modal hidden" role="dialog" aria-modal="true" aria-label="Несохранённые изменения доски">
        <div class="board-leave-content"><h3>Сохранить изменения доски?</h3><p>На доске есть несохранённые изменения.</p>
          <button class="button primary" data-leave="save">Сохранить</button><button class="button ghost" data-leave="discard">Не сохранять</button><button class="button ghost" data-leave="cancel">Отмена</button>
        </div>
      </div>`;
    panel.append(this.element);
    this.scroll = this.element.querySelector('.board-scroll');
    this.surface = this.element.querySelector('.board-surface');
    this.items = this.element.querySelector('.board-items');
    this.svg = this.element.querySelector('.board-lines');
    this.status = this.element.querySelector('.board-status');
    this.color = this.element.querySelector('.board-color');
    this.lineWidth = this.element.querySelector('.board-line-width');
    this.dashed = this.element.querySelector('.board-dashed');
    this.leaveModal = this.element.querySelector('.board-leave-modal');
    this.menu = document.createElement('div'); this.menu.className = 'file-context-menu board-context-menu hidden'; this.menu.setAttribute('role', 'menu'); document.body.append(this.menu);
    this.leaveModal.querySelectorAll('[data-leave]').forEach((button) => button.addEventListener('click', async () => {
      if (button.dataset.leave === 'save') {
        button.disabled = true;
        try { await this.save(); } catch { button.disabled = false; return; }
        button.disabled = false;
      } else if (button.dataset.leave === 'discard') { this.dirty = false; clearTimeout(this.saveTimer); }
      this.leaveModal.classList.add('hidden');
      this.resolveLeave?.(button.dataset.leave !== 'cancel'); this.resolveLeave = null;
    }));
    document.addEventListener('pointerdown', (event) => { if (!this.menu.contains(event.target)) this.hideMenu(); });
    this.menu.addEventListener('keydown', (event) => {
      const buttons = [...this.menu.querySelectorAll('button:not(:disabled)')];
      if (event.key === 'Escape') { event.preventDefault(); this.hideMenu(); this.scroll.focus(); }
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const index = buttons.indexOf(document.activeElement);
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    });
    window.addEventListener('blur', () => {
      this.hideMenu();
      if (this.gesture) this.pointerUp({ pointerId: this.gesture.pointerId, preventDefault() {}, stopPropagation() {} }, true);
    });
    this.scroll.addEventListener('scroll', () => this.hideMenu());
    this.scroll.addEventListener('contextmenu', (event) => this.contextMenu(event));
    this.scroll.addEventListener('dblclick', (event) => {
      if (!this.current || event.target.closest('[data-id]') || this.gesture) return;
      event.preventDefault(); event.stopPropagation(); this.addNote(this.point(event));
    });
    this.scroll.addEventListener('wheel', (event) => {
      if (!this.current || this.gesture || document.fullscreenElement) return;
      event.preventDefault(); event.stopPropagation();
      const point = this.point(event), rect = this.scroll.getBoundingClientRect();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.scroll.clientHeight : 1;
      if (event.ctrlKey) {
        this.setZoom(this.zoom * Math.exp(-event.deltaY * unit * 0.002));
        this.camera.x = point.x - (event.clientX - rect.left) / this.zoom;
        this.camera.y = point.y - (event.clientY - rect.top) / this.zoom;
      } else {
        this.camera.x += (event.shiftKey ? event.deltaY || event.deltaX : event.deltaX) * unit / this.zoom;
        this.camera.y += (event.shiftKey ? 0 : event.deltaY) * unit / this.zoom;
      }
      this.hideMenu(); this.layout();
    }, { passive: false });
    this.element.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => this.setTool(button.dataset.tool)));
    this.element.querySelector('.board-close').addEventListener('click', () => void this.close());
    this.element.querySelector('.board-save').addEventListener('click', () => void this.save().catch(() => {}));
    this.element.querySelector('.board-save-copy').addEventListener('click', () => void this.saveCopy().catch((error) => this.callbacks.error(error)));
    this.element.querySelector('.board-delete').addEventListener('click', () => this.removeSelected());
    this.element.querySelector('.board-undo').addEventListener('click', () => this.undo());
    this.element.querySelector('.board-redo').addEventListener('click', () => this.undo(true));
    this.element.querySelector('.board-zoom-out').addEventListener('click', () => this.setZoom(this.zoom - 0.1));
    this.element.querySelector('.board-zoom-in').addEventListener('click', () => this.setZoom(this.zoom + 0.1));
    [this.color, this.lineWidth, this.dashed].forEach((input) => input.addEventListener('change', () => {
      const node = this.data?.nodes.find((n) => n.id === this.selected);
      if (!node || node.type === 'file' || node.type === 'note') return;
      this.remember(); Object.assign(node, this.style()); this.changed(); this.render();
    }));
    this.scroll.addEventListener('pointerdown', (event) => this.pointerDown(event), true);
    window.addEventListener('pointermove', (event) => {
      if (this.gesture || this.scroll.contains(event.target)) this.pointerMove(event);
    }, true);
    window.addEventListener('pointerup', (event) => this.pointerUp(event), true);
    this.scroll.addEventListener('pointercancel', (event) => this.pointerUp(event, true));
    this.scroll.addEventListener('lostpointercapture', (event) => {
      if (event.target === this.scroll && this.gesture) this.pointerUp(event, true);
    });
    this.scroll.addEventListener('mousedown', (event) => { if (event.button === 1) event.preventDefault(); }, true);
    this.scroll.addEventListener('auxclick', (event) => { if (event.button === 1) event.preventDefault(); });
    this.scroll.addEventListener('click', (event) => {
      if (this.suppressClick && event.detail > 0) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    new ResizeObserver(() => this.layout()).observe(this.scroll);
    this.scroll.addEventListener('dragover', (event) => {
      if (!this.current || !this.callbacks.draggedPaths().length) return;
      event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy';
      this.scroll.classList.add('board-drop-target');
    });
    this.scroll.addEventListener('dragleave', (event) => { if (!this.scroll.contains(event.relatedTarget)) this.scroll.classList.remove('board-drop-target'); });
    this.scroll.addEventListener('drop', (event) => {
      const paths = this.callbacks.draggedPaths();
      if (!this.current || !paths.length) return;
      event.preventDefault(); event.stopPropagation();
      this.callbacks.cancelExternalDrag();
      const position = this.point(event);
      this.callbacks.resetDrag(); this.scroll.classList.remove('board-drop-target');
      void this.attach(paths, position).catch((error) => this.callbacks.error(error));
    });
    this.element.addEventListener('keydown', (event) => {
      const editing = event.target.matches('input, textarea, select');
      if (event.ctrlKey && event.key.toLowerCase() === 's') { event.preventDefault(); void this.save().catch(() => {}); }
      else if (!editing && event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); this.undo(event.shiftKey); }
      else if (!editing && event.key === 'Delete') { event.preventDefault(); this.removeSelected(); }
      else if (event.key === 'Escape') {
        if (!this.leaveModal.classList.contains('hidden')) this.leaveModal.querySelector('[data-leave="cancel"]').click();
        else if (!this.menu.classList.contains('hidden')) this.hideMenu();
        else if (!editing) { this.selected = null; this.setTool('select'); this.render(); }
      }
    });
    this.setTool('select');
    window.addEventListener('beforeunload', (event) => {
      if (!this.dirty && !this.saving) return;
      event.preventDefault(); event.returnValue = false;
      void this.requestLeave().then((leave) => { if (leave) window.close(); }).catch(() => {});
    });
  }

  async open(item) {
    if (this.current?.path === item.path) return;
    const request = this.openRequest = (this.openRequest || 0) + 1;
    try {
      if (!await this.requestLeave()) return;
      const result = await window.lumina.readBoard(item.path);
      if (this.openRequest !== request) return;
      this.current = item; this.data = result.data; this.modifiedAt = result.modifiedAt;
      this.attachments = result.attachments; this.history = []; this.future = []; this.selected = null; this.dirty = false;
      this.element.querySelector('.board-title').textContent = item.name;
      this.element.classList.remove('hidden'); this.panel.classList.add('board-mode');
      this.panel.querySelectorAll('#preview-content video, #preview-content audio').forEach((media) => media.pause());
      this.camera = { x: 0, y: 0 };
      this.callbacks.showPanel(); this.setTool('select'); this.setZoom(1); this.render();
      if (this.data.nodes.length) this.homeObjects();
      this.status.textContent = 'Все изменения сохранены';
      this.scroll.focus({ preventScroll: true });
    } catch (error) { this.callbacks.error(error); }
  }

  async close() {
    try { if (!await this.requestLeave()) return; } catch { return; }
    this.hideMenu(); clearTimeout(this.saveTimer);
    this.openRequest = (this.openRequest || 0) + 1;
    this.current = null; this.data = null; this.items.replaceChildren(); this.svg.replaceChildren();
    this.panel.classList.remove('board-mode'); this.element.classList.add('hidden');
    this.callbacks.closed();
  }

  style() {
    return { color: this.color.value, lineWidth: Math.max(1, Math.min(30, Number(this.lineWidth.value) || 3)), dashed: this.dashed.checked };
  }
  hideMenu() { this.menu?.classList.add('hidden'); }
  menuAction(label, action, key, disabled = false) {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'menuitem'); button.dataset.action = key;
    const text = document.createElement('span'); text.textContent = label; button.append(text); button.disabled = disabled;
    button.addEventListener('click', () => { this.hideMenu(); this.scroll.focus(); action(); }); this.menu.append(button);
    return button;
  }
  showMenu(position) {
    this.callbacks.hideFileMenu(); this.menu.classList.remove('hidden');
    this.menu.style.left = `${Math.max(8, Math.min(position.clientX, innerWidth - this.menu.offsetWidth - 8))}px`;
    this.menu.style.top = `${Math.max(8, Math.min(position.clientY, innerHeight - this.menu.offsetHeight - 8))}px`;
    this.menu.querySelector('button:not(:disabled)')?.focus();
  }
  contextMenu(event) {
    if (!this.current) return;
    event.preventDefault(); event.stopPropagation(); this.menu.replaceChildren();
    const node = this.data.nodes.find((n) => n.id === event.target.closest('[data-id]')?.dataset.id);
    const point = this.point(event);
    if (node) {
      this.selected = node.id; this.selection();
      if (node.type === 'file') {
        const item = this.attachments[node.id];
        this.menuAction('Открыть файл', () => this.callbacks.openFile(item), 'open-file', !item || Boolean(item.error));
      }
      if (!['stroke', 'arrow'].includes(node.type)) this.menuAction('Нарисовать стрелку', () => {
        this.setTool('arrow'); this.arrowFrom = node.id; this.selected = node.id; this.selection();
        this.status.textContent = 'Выберите конечный элемент или точку на доске';
      }, 'arrow');
      if (node.type !== 'file') this.menuAction(node.type === 'note' ? 'Цвет заметки' : 'Изменить цвет',
        () => this.nodeColorMenu(node, event), node.type === 'note' ? 'note-color' : 'color');
      this.menuAction('Удалить элемент', () => this.removeSelected(), 'delete');
    } else {
      this.menuAction('Курсор', () => this.setTool('select'), 'select');
      this.menuAction('Заметка', () => this.addNote(point), 'note');
      for (const [tool, label] of [['rectangle', 'Прямоугольник'], ['square', 'Квадрат'], ['circle', 'Круг'], ['arrow', 'Стрелка'], ['brush', 'Кисть']]) {
        this.menuAction(label, () => this.setTool(tool), tool);
      }
    }
    this.showMenu(event);
  }
  nodeColorMenu(node, position) {
    this.menu.replaceChildren();
    const palette = node.type === 'note'
      ? [['#fff0ae', 'Жёлтый'], ['#ffd3e1', 'Розовый'], ['#c6e8ff', 'Голубой'], ['#d2f3c2', 'Зелёный'], ['#e0d1ff', 'Сиреневый'], ['#f4f6fb', 'Белый']]
      : [['#b7f34a', 'Зелёный'], ['#ff6b6b', 'Красный'], ['#ffd166', 'Жёлтый'], ['#57a5ff', 'Синий'], ['#b28dff', 'Фиолетовый'], ['#ff87bf', 'Розовый'], ['#f4f6fb', 'Белый'], ['#30343f', 'Тёмный']];
    for (const [color, label] of palette) {
      const button = this.menuAction(label, () => this.setNodeColor(node, color), color);
      const swatch = document.createElement('span'); swatch.className = 'board-note-swatch'; swatch.style.backgroundColor = color; button.prepend(swatch);
    }
    const custom = document.createElement('label'); custom.className = 'board-custom-color'; custom.textContent = 'Другой цвет';
    const input = document.createElement('input'); input.type = 'color'; input.value = node.color || '#fff0ae'; input.setAttribute('aria-label', 'Другой цвет элемента');
    input.addEventListener('change', () => { this.hideMenu(); this.setNodeColor(node, input.value); });
    custom.append(input); this.menu.append(custom);
    this.showMenu(position);
  }
  setNodeColor(node, color) {
    if (!this.data?.nodes.includes(node) || node.type === 'file' || node.color === color) return;
    this.remember(); node.color = color;
    const element = this.items.querySelector(`[data-id="${CSS.escape(node.id)}"]`);
    if (node.type === 'note') this.noteAppearance(element, color);
    else {
      this.color.value = color;
      element?.querySelector('svg > rect, svg > ellipse')?.setAttribute('stroke', color);
    }
    this.changed(); this.drawLines(); this.selection();
  }
  noteAppearance(element, color) {
    if (!element) return;
    element.style.backgroundColor = color;
    const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
    element.style.color = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 150 ? '#342c16' : '#f4f6fb';
  }
  addNote(point) {
    this.remember();
    const note = { id: crypto.randomUUID(), type: 'note', text: '', color: '#fff0ae', x: point.x, y: point.y, width: 220, height: 180 };
    this.data.nodes.push(note); this.selected = note.id; this.setTool('select'); this.changed(); this.render();
    this.items.querySelector(`[data-id="${note.id}"] textarea`).focus();
  }
  setTool(tool) {
    this.tool = tool; this.arrowFrom = null; this.arrowEnd = null; this.hideMenu();
    this.element.querySelectorAll('[data-tool]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tool === tool)));
    this.surface.dataset.tool = tool;
    if (this.data) this.drawLines();
    if (this.current) this.status.textContent = tool === 'arrow' ? 'Выберите начальный элемент, затем конечный элемент или точку на доске' : this.dirty ? 'Есть несохранённые изменения · Ctrl+S' : 'Все изменения сохранены';
  }
  setZoom(value) {
    this.zoom = Math.max(0.01, Math.min(2, Math.round(value * 1000) / 1000));
    this.element.querySelector('.board-zoom').textContent = `${Math.round(this.zoom * 100)}%`;
    this.layout();
  }
  layout() {
    const width = Math.max(1, this.scroll.clientWidth / this.zoom);
    const height = Math.max(1, this.scroll.clientHeight / this.zoom);
    this.surface.style.width = `${width}px`; this.surface.style.height = `${height}px`;
    this.surface.style.transform = `translate(${-this.camera.x * this.zoom}px, ${-this.camera.y * this.zoom}px) scale(${this.zoom})`;
    this.scroll.style.setProperty('--board-zoom', this.zoom);
    this.scroll.style.backgroundSize = `${20 * this.zoom}px ${20 * this.zoom}px`;
    this.scroll.style.backgroundPosition = `${-this.camera.x * this.zoom}px ${-this.camera.y * this.zoom}px`;
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  homeObjects() {
    if (!this.current || this.gesture) return;
    this.callbacks.showPanel(); this.hideMenu();
    const files = this.data.nodes.filter((node) => node.type === 'file');
    const nodes = files.length ? files : this.data.nodes.filter((node) => node.type !== 'arrow');
    if (!nodes.length) { this.camera = { x: 0, y: 0 }; this.setZoom(1); return; }
    const left = Math.min(...nodes.map((node) => node.x)), top = Math.min(...nodes.map((node) => node.y));
    const right = Math.max(...nodes.map((node) => node.x + node.width)), bottom = Math.max(...nodes.map((node) => node.y + node.height));
    this.setZoom(Math.min(1, Math.max(1, this.scroll.clientWidth - 80) / (right - left), Math.max(1, this.scroll.clientHeight - 80) / (bottom - top)));
    this.camera = { x: (left + right) / 2 - this.scroll.clientWidth / (2 * this.zoom),
      y: (top + bottom) / 2 - this.scroll.clientHeight / (2 * this.zoom) };
    this.layout();
  }
  point(event) {
    const rect = this.scroll.getBoundingClientRect();
    return { x: this.camera.x + (event.clientX - rect.left) / this.zoom, y: this.camera.y + (event.clientY - rect.top) / this.zoom };
  }
  snapshot() { return JSON.stringify(this.data); }
  remember(snapshot = this.snapshot()) {
    this.history.push(snapshot); if (this.history.length > 60) this.history.shift(); this.future = [];
  }
  changed() {
    this.dirty = true; this.status.textContent = this.autoSave ? 'Изменения…' : 'Есть несохранённые изменения · Ctrl+S'; this.controls();
    clearTimeout(this.saveTimer);
    if (this.autoSave) this.saveTimer = setTimeout(() => { if (!this.gesture) void this.save().catch(() => {}); }, 300);
  }
  get autoSave() { return this.callbacks.autosaveEnabled(); }
  autosavePreferenceChanged() {
    clearTimeout(this.saveTimer);
    if (this.dirty) this.changed();
  }
  async requestLeave() {
    if (this.saving) await this.saving;
    if (!this.dirty) return true;
    if (this.autoSave) { await this.save(); return true; }
    if (this.leavePromise) return this.leavePromise;
    this.callbacks.showPanel(); this.hideMenu();
    this.leaveModal.classList.remove('hidden');
    this.leaveModal.querySelector('[data-leave="save"]').focus();
    this.leavePromise = new Promise((resolve) => { this.resolveLeave = resolve; });
    try { return await this.leavePromise; } finally { this.leavePromise = null; }
  }
  async save() {
    clearTimeout(this.saveTimer);
    if (this.saving) { await this.saving; if (this.dirty) return this.save(); return; }
    if (!this.current || !this.dirty) return;
    const itemPath = this.current.path, snapshot = this.snapshot();
    this.status.textContent = 'Сохранение…';
    this.saving = window.lumina.writeBoard(itemPath, JSON.parse(snapshot), this.modifiedAt);
    try {
      const result = await this.saving;
      this.modifiedAt = result.modifiedAt; this.dirty = this.snapshot() !== snapshot;
      this.status.textContent = this.dirty ? 'Изменения…' : 'Все изменения сохранены';
    } catch (error) {
      this.status.textContent = `Не сохранено: ${error.message}`; this.callbacks.error(error); throw error;
    } finally { this.saving = null; }
    if (this.dirty) return this.save();
  }
  async saveCopy() {
    if (!this.current || this.copying) return;
    this.copying = true;
    clearTimeout(this.saveTimer);
    try {
      if (this.saving) await this.saving.catch(() => {});
      const previous = this.current, snapshot = this.snapshot();
      const name = `${previous.name.replace(/\.board$/i, '').slice(0, 160)} — копия ${Date.now()}.board`;
      const created = await window.lumina.createBoard(this.callbacks.directoryFor(previous.path), name, JSON.parse(snapshot));
      const result = await window.lumina.readBoard(created.path);
      if (this.current !== previous) return;
      this.current = created; this.modifiedAt = result.modifiedAt;
      this.dirty = this.snapshot() !== snapshot;
      this.element.querySelector('.board-title').textContent = created.name;
      this.status.textContent = 'Копия сохранена';
      if (this.dirty) this.changed();
    } finally { this.copying = false; }
  }
  undo(redo = false) {
    if (!this.current || this.gesture) return;
    const source = redo ? this.future : this.history, target = redo ? this.history : this.future;
    if (!source.length) return;
    target.push(this.snapshot()); this.data = JSON.parse(source.pop()); this.selected = null;
    this.changed(); this.render();
  }
  removeSelected() {
    if (!this.selected || !this.current) return;
    this.remember();
    this.data.nodes = this.data.nodes.filter((n) => n.id !== this.selected && n.from !== this.selected && n.to !== this.selected);
    this.selected = null; this.changed(); this.render();
  }
  controls() {
    this.element.querySelector('.board-undo').disabled = !this.history.length;
    this.element.querySelector('.board-redo').disabled = !this.future.length;
    this.element.querySelector('.board-delete').disabled = !this.selected;
  }
  async attach(paths, position = { x: 40, y: 40 }) {
    if (!this.current) return;
    const current = this.current;
    const files = await window.lumina.attachBoardFiles(current.path, paths);
    if (this.current !== current) return;
    this.remember();
    files.forEach(({ path, item }, index) => {
      const node = { id: crypto.randomUUID(), type: 'file', path, x: position.x + index * 30, y: position.y + index * 30, width: 240, height: 210 };
      this.data.nodes.push(node); this.attachments[node.id] = item; this.selected = node.id;
    });
    this.changed(); this.render();
  }

  async remapPaths(remap) {
    if (!this.current) return;
    const previousPath = this.current.path;
    const next = remap(this.current);
    const nodes = this.data.nodes.filter((n) => n.type === 'file' && this.attachments[n.id]?.path);
    const mapped = nodes.map((n) => remap(this.attachments[n.id]));
    if (next.path === previousPath && mapped.every((item, i) => item.path === this.attachments[nodes[i].id].path)) return;
    this.current = next;
    this.element.querySelector('.board-title').textContent = next.name;
    const files = await window.lumina.attachBoardFiles(next.path, mapped.map((item) => item.path));
    files.forEach((file, i) => { nodes[i].path = file.path; this.attachments[nodes[i].id] = file.item; });
    this.history = []; this.future = []; this.changed(); this.render();
    if (this.autoSave) await this.save();
  }

  render() {
    if (!this.data) return;
    this.items.replaceChildren();
    for (const node of this.data.nodes) {
      if (node.type === 'arrow' || node.type === 'stroke') continue;
      const element = document.createElement('article'); element.className = `board-node board-${node.type}`; element.dataset.id = node.id;
      if (node.type === 'note' || node.type === 'file') {
        if (node.type === 'note') {
          const handle = document.createElement('div'); handle.className = 'board-node-handle'; handle.textContent = 'Заметка';
          this.noteAppearance(element, node.color || '#fff0ae');
          const picker = document.createElement('button'); picker.type = 'button'; picker.className = 'board-note-color';
          picker.setAttribute('aria-label', 'Цвет заметки'); picker.setAttribute('aria-haspopup', 'menu'); picker.title = 'Цвет заметки';
          picker.addEventListener('click', (event) => {
            event.stopPropagation(); const rect = picker.getBoundingClientRect();
            this.selected = node.id; this.selection(); this.nodeColorMenu(node, { clientX: rect.right, clientY: rect.bottom });
          });
          handle.append(picker); element.append(handle);
          const text = document.createElement('textarea'); text.value = node.text; text.placeholder = 'Напишите заметку…'; text.setAttribute('aria-label', 'Текст заметки');
          let baseline;
          text.addEventListener('focus', () => { baseline = this.snapshot(); });
          text.addEventListener('input', () => { node.text = text.value; this.changed(); });
          text.addEventListener('blur', () => { if (baseline && baseline !== this.snapshot()) { this.remember(baseline); this.controls(); } });
          element.append(text);
        } else {
          const item = this.attachments[node.id];
          const body = document.createElement('div'); body.className = 'board-file-body';
          if (!item || item.error) { body.textContent = 'Файл недоступен'; body.title = item?.error || ''; }
          else if (['image', 'video', 'audio'].includes(item.kind)) {
            const media = document.createElement(item.kind === 'image' ? 'img' : item.kind);
            media.src = item.url; media.draggable = false;
            if (item.kind === 'image') media.alt = item.name;
            else { media.preload = 'metadata'; media.muted = true; }
            if (item.kind === 'video' && item.thumbnailUrl) media.poster = item.thumbnailUrl;
            media.addEventListener('error', () => { body.classList.add('board-media-error'); body.title = 'Не удалось загрузить файл'; });
            body.append(media);
            if (item.kind !== 'image') this.mediaControls(body, media, item.kind);
          } else {
            if (/\.(txt|md)$/i.test(item.name)) {
              const excerpt = document.createElement('pre'); body.append(excerpt);
              void window.lumina.readTextFile(item.path).then((result) => { excerpt.textContent = result.text.slice(0, 4000); }).catch(() => { excerpt.textContent = 'Текст недоступен'; });
            } else {
              const icon = this.svgElement('svg', { viewBox: '0 0 24 24', 'aria-label': 'Прикреплённый файл' });
              icon.append(this.svgElement('path', { d: 'M6 3h8l4 4v14H6ZM14 3v4h4M9 12h6M9 16h6' })); body.append(icon);
            }
          }
          element.append(body);
        }
      } else {
        const svg = this.svgElement('svg', { viewBox: `0 0 ${node.width} ${node.height}`, preserveAspectRatio: 'none' });
        const margin = node.lineWidth / 2 + 1;
        const attrs = { fill: 'none', stroke: node.color, 'stroke-width': node.lineWidth, 'stroke-dasharray': node.dashed ? '8 6' : 'none' };
        svg.append(node.type === 'circle'
          ? this.svgElement('ellipse', { ...attrs, cx: node.width / 2, cy: node.height / 2, rx: Math.max(1, node.width / 2 - margin), ry: Math.max(1, node.height / 2 - margin) })
          : this.svgElement('rect', { ...attrs, x: margin, y: margin, width: Math.max(1, node.width - 2 * margin), height: Math.max(1, node.height - 2 * margin) }));
        element.append(svg);
      }
      for (const corner of ['nw', 'ne', 'sw', 'se']) {
        const resize = document.createElement('div'); resize.className = 'board-node-resize';
        resize.dataset.corner = corner; resize.title = 'Изменить размер'; element.append(resize);
      }
      this.items.append(element); this.positionNode(node, element);
    }
    this.layout(); this.drawLines(); this.selection();
  }
  svgElement(name, attrs = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }
  mediaControls(body, media, kind) {
    const controls = document.createElement('div'); controls.className = 'board-player-controls';
    const button = (className, label, action) => {
      const element = document.createElement('button'); element.type = 'button'; element.className = className;
      element.title = label; element.setAttribute('aria-label', label);
      element.addEventListener('click', (event) => { event.stopPropagation(); action(); });
      controls.append(element); return element;
    };
    const toggle = () => { if (media.paused) void media.play().catch((error) => this.callbacks.error(error)); else media.pause(); };
    const play = button('board-media-play', 'Воспроизвести', toggle);
    const updatePlay = () => {
      play.textContent = media.paused ? '▶' : 'Ⅱ'; play.title = media.paused ? 'Воспроизвести' : 'Пауза';
      play.setAttribute('aria-label', play.title);
    };
    media.addEventListener('play', updatePlay); media.addEventListener('pause', updatePlay); updatePlay();
    const seek = document.createElement('input'); seek.type = 'range'; seek.className = 'board-media-seek';
    seek.min = '0'; seek.max = '100'; seek.step = '.1'; seek.value = '0'; seek.setAttribute('aria-label', 'Позиция воспроизведения');
    const canSeek = () => Number.isFinite(media.duration) && media.duration > 0;
    const updateSeek = () => { seek.setAttribute('aria-disabled', String(!canSeek())); seek.value = canSeek() ? String(media.currentTime / media.duration * 100) : '0'; };
    media.addEventListener('loadedmetadata', updateSeek); media.addEventListener('timeupdate', updateSeek); updateSeek();
    seek.addEventListener('input', () => { if (canSeek()) media.currentTime = Number(seek.value) / 100 * media.duration; });
    // A timeline click seeks; dragging its surface moves the card like every other area.
    seek.addEventListener('click', (event) => {
      event.stopPropagation(); if (!canSeek()) return;
      const rect = seek.getBoundingClientRect();
      media.currentTime = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * media.duration;
      updateSeek();
    });
    controls.append(seek);
    const mute = button('board-media-mute', 'Включить звук', () => { media.muted = !media.muted; updateMute(); });
    const updateMute = () => {
      mute.textContent = media.muted ? '♪̸' : '♪'; mute.title = media.muted ? 'Включить звук' : 'Выключить звук';
      mute.setAttribute('aria-label', mute.title); mute.setAttribute('aria-pressed', String(!media.muted));
    };
    media.addEventListener('volumechange', updateMute); updateMute();
    if (kind === 'video') {
      button('board-media-fullscreen', 'Полный экран', () => {
        void media.requestFullscreen().catch((error) => this.callbacks.error(error));
      }).textContent = '⛶';
      media.addEventListener('click', toggle);
      media.addEventListener('fullscreenchange', () => { media.controls = document.fullscreenElement === media; });
    } else {
      body.classList.add('board-audio-body');
      const icon = this.svgElement('svg', { viewBox: '0 0 24 24', 'aria-label': 'Аудиофайл' });
      icon.append(this.svgElement('path', { d: 'M9 17V6l10-2v11M9 9l10-2M9 17a3 3 0 1 1-3-3 3 3 0 0 1 3 3ZM19 15a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 })); body.append(icon);
    }
    body.append(controls);
  }
  positionNode(node, element = this.items.querySelector(`[data-id="${CSS.escape(node.id)}"]`)) {
    if (!element) return;
    Object.assign(element.style, { left: `${node.x}px`, top: `${node.y}px`, width: `${node.width}px`, height: `${node.height}px` });
  }
  boundary(node, target) {
    const x = node.x + node.width / 2, y = node.y + node.height / 2;
    const dx = target.x + target.width / 2 - x, dy = target.y + target.height / 2 - y;
    const scale = node.type === 'circle'
      ? 1 / Math.max(0.001, Math.sqrt((dx / (node.width / 2)) ** 2 + (dy / (node.height / 2)) ** 2))
      : 1 / Math.max(0.001, Math.abs(dx) / (node.width / 2), Math.abs(dy) / (node.height / 2));
    return { x: x + dx * Math.min(1, scale), y: y + dy * Math.min(1, scale) };
  }
  drawLines() {
    this.svg.replaceChildren();
    const defs = this.svgElement('defs'), marker = this.svgElement('marker', { id: 'board-arrowhead', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    marker.append(this.svgElement('path', { d: 'M0 0 L10 5 L0 10 Z', fill: 'context-stroke', stroke: 'none' })); defs.append(marker); this.svg.append(defs);
    for (const node of this.data.nodes) {
      if (!['stroke', 'arrow'].includes(node.type)) continue;
      let d;
      if (node.type === 'stroke') d = node.points.map((p, i) => `${i ? 'L' : 'M'}${p[0] + node.x},${p[1] + node.y}`).join(' ');
      else {
        const from = this.data.nodes.find((n) => n.id === node.from);
        const to = node.to !== undefined ? this.data.nodes.find((n) => n.id === node.to) : { ...node.end, width: 0, height: 0 };
        if (!from || !to) continue;
        const a = this.boundary(from, to), b = node.to !== undefined ? this.boundary(to, from) : node.end;
        d = `M${a.x},${a.y} L${b.x},${b.y}`;
      }
      const line = this.svgElement('path', { d, fill: 'none', stroke: node.color, 'stroke-width': node.lineWidth,
        'stroke-dasharray': node.dashed ? '8 6' : 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-id': node.id,
        ...(node.type === 'arrow' ? { 'marker-end': 'url(#board-arrowhead)' } : {}) });
      line.classList.add('board-line'); if (node.id === this.selected) line.classList.add('selected'); this.svg.append(line);
    }
    if (this.arrowFrom && this.arrowEnd) {
      const from = this.data.nodes.find((n) => n.id === this.arrowFrom);
      if (from) {
        const start = this.boundary(from, { ...this.arrowEnd, width: 0, height: 0 });
        this.svg.append(this.svgElement('path', { d: `M${start.x},${start.y} L${this.arrowEnd.x},${this.arrowEnd.y}`, fill: 'none', stroke: this.color.value,
          'stroke-width': this.style().lineWidth, 'stroke-dasharray': '6 5', 'marker-end': 'url(#board-arrowhead)', class: 'board-arrow-preview' }));
      }
    }
  }
  selection() {
    this.element.querySelectorAll('[data-id]').forEach((element) => element.classList.toggle('selected', element.dataset.id === this.selected || element.dataset.id === this.arrowFrom));
    this.controls();
  }
  pointerDown(event) {
    if (!this.current || this.gesture || document.fullscreenElement) return;
    this.suppressClick = false;
    if (event.button === 1) {
      event.preventDefault(); event.stopPropagation(); this.hideMenu();
      this.gesture = { mode: 'pan', pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, camera: { ...this.camera } };
      this.scroll.classList.add('board-panning'); this.scroll.setPointerCapture(event.pointerId); return;
    }
    if (event.button !== 0) return;
    const target = event.target.closest('[data-id]'), node = this.data.nodes.find((n) => n.id === target?.dataset.id);
    const corner = event.target.closest('.board-node-resize')?.dataset.corner;
    if (!corner && event.target.closest('button') && node?.type !== 'file') return;
    if (!corner && event.target.closest('textarea, input') && node?.type !== 'file' && this.tool === 'select') {
      this.selected = node?.id || null; this.selection(); return;
    }
    const mediaClick = node?.type === 'file' && !corner && this.tool === 'select' && event.target.closest('video, audio, .board-player-controls');
    if (event.target.closest('.board-media-seek')) event.preventDefault();
    if (!mediaClick) { event.preventDefault(); this.scroll.focus({ preventScroll: true }); }
    const point = this.point(event);
    if (this.tool === 'arrow') {
      if (node && ['arrow', 'stroke'].includes(node.type)) return;
      if (!this.arrowFrom && node) { this.arrowFrom = node.id; this.selected = node.id; this.selection(); this.status.textContent = 'Теперь выберите конечный элемент или точку'; }
      else if (this.arrowFrom && node?.id !== this.arrowFrom) {
        const arrow = { id: crypto.randomUUID(), type: 'arrow', from: this.arrowFrom, ...(node ? { to: node.id } : { end: point }), ...this.style() };
        this.remember(); this.data.nodes.push(arrow); this.selected = arrow.id;
        this.setTool('select'); this.changed(); this.drawLines(); this.selection();
      }
      return;
    }
    if (this.tool === 'note') {
      this.addNote(point); return;
    }
    const before = this.snapshot();
    if (this.tool === 'select') {
      this.selected = node?.id || null; this.selection();
      if (!node || node.type === 'arrow') return;
      this.gesture = { mode: corner ? 'resize' : 'move', corner, node, point, original: { ...node }, before,
        pending: node.type === 'file' && !corner, clientX: event.clientX, clientY: event.clientY };
    } else {
      const type = this.tool === 'brush' ? 'stroke' : this.tool;
      const created = { id: crypto.randomUUID(), type, x: point.x, y: point.y, width: 1, height: 1, ...this.style(), ...(type === 'stroke' ? { points: [[0, 0], [0, 0]] } : {}) };
      this.data.nodes.push(created); this.selected = created.id;
      this.gesture = { mode: 'draw', node: created, point, before }; this.render();
    }
    this.gesture.pointerId = event.pointerId;
    clearTimeout(this.saveTimer);
    if (!this.gesture.pending) this.scroll.setPointerCapture(event.pointerId);
  }
  pointerMove(event) {
    const gesture = this.gesture;
    if (!gesture) {
      if (this.tool === 'arrow' && this.arrowFrom) { this.arrowEnd = this.point(event); this.drawLines(); }
      return;
    }
    if (gesture.pointerId !== event.pointerId) return;
    if (gesture.mode === 'pan') {
      event.preventDefault();
      this.camera = { x: gesture.camera.x - (event.clientX - gesture.clientX) / this.zoom,
        y: gesture.camera.y - (event.clientY - gesture.clientY) / this.zoom };
      this.layout(); return;
    }
    if (gesture.pending) {
      if (Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY) < 4) return;
      gesture.pending = false; this.scroll.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const point = this.point(event), node = gesture.node, dx = point.x - gesture.point.x, dy = point.y - gesture.point.y;
    if (gesture.mode === 'move') {
      node.x = gesture.original.x + dx; node.y = gesture.original.y + dy;
    } else if (gesture.mode === 'resize') {
      const west = gesture.corner.includes('w'), north = gesture.corner.includes('n');
      node.width = Math.max(50, gesture.original.width + (west ? -dx : dx));
      node.height = Math.max(50, gesture.original.height + (north ? -dy : dy));
      if (['square', 'circle'].includes(node.type)) node.width = node.height = Math.max(node.width, node.height);
      node.x = west ? gesture.original.x + gesture.original.width - node.width : gesture.original.x;
      node.y = north ? gesture.original.y + gesture.original.height - node.height : gesture.original.y;
    } else if (node.type === 'stroke') {
      node.points.push([dx, dy]); node.width = Math.max(node.width, dx + 1); node.height = Math.max(node.height, dy + 1);
    } else {
      let width = Math.max(10, Math.abs(dx)), height = Math.max(10, Math.abs(dy));
      if (['square', 'circle'].includes(node.type)) width = height = Math.max(width, height);
      node.x = gesture.point.x - (dx < 0 ? width : 0); node.y = gesture.point.y - (dy < 0 ? height : 0);
      node.width = width; node.height = height;
    }
    this.positionNode(node); this.layout(); this.drawLines();
    if (!['file', 'note', 'stroke'].includes(node.type)) {
      const shape = this.items.querySelector(`[data-id="${CSS.escape(node.id)}"] svg`);
      shape.setAttribute('viewBox', `0 0 ${node.width} ${node.height}`);
      const geometry = shape.firstElementChild, margin = node.lineWidth / 2 + 1;
      const attrs = node.type === 'circle' ? { cx: node.width / 2, cy: node.height / 2, rx: Math.max(1, node.width / 2 - margin), ry: Math.max(1, node.height / 2 - margin) }
        : { width: Math.max(1, node.width - 2 * margin), height: Math.max(1, node.height - 2 * margin) };
      Object.entries(attrs).forEach(([key, value]) => geometry.setAttribute(key, value));
    }
  }
  pointerUp(event, cancelled = false) {
    const gesture = this.gesture; if (!gesture) return;
    if (gesture.pointerId !== event.pointerId) return;
    if (!cancelled) this.pointerMove(event);
    this.gesture = null;
    if (this.scroll.hasPointerCapture(event.pointerId)) this.scroll.releasePointerCapture(event.pointerId);
    this.scroll.classList.remove('board-panning');
    if (gesture.mode === 'pan') {
      event.preventDefault(); event.stopPropagation();
      if (cancelled) { this.camera = gesture.camera; this.layout(); }
      if (this.dirty) this.changed();
      return;
    }
    if (gesture.pending) { if (this.dirty) this.changed(); return; }
    this.suppressClick = true;
    if (cancelled) { this.data = JSON.parse(gesture.before); this.render(); if (this.dirty) this.changed(); return; }
    const node = gesture.node;
    if (node.type === 'stroke' && gesture.mode === 'draw') {
      const minX = Math.min(...node.points.map((p) => p[0])), minY = Math.min(...node.points.map((p) => p[1]));
      const maxX = Math.max(...node.points.map((p) => p[0])), maxY = Math.max(...node.points.map((p) => p[1]));
      node.x += minX; node.y += minY; node.width = Math.max(1, maxX - minX); node.height = Math.max(1, maxY - minY);
      node.points = node.points.map((p) => [p[0] - minX, p[1] - minY]);
    }
    if (this.snapshot() !== gesture.before) { this.remember(gesture.before); this.changed(); }
    if (gesture.mode === 'draw' && node.type !== 'stroke') this.setTool('select');
    this.layout(); this.drawLines(); this.controls();
  }
}
