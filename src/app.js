const ICONS = {
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5v9A2.5 2.5 0 0 0 6 19h12a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 18 7h-6l-2-2H6a2.5 2.5 0 0 0-2.5 2.5Z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><circle cx="15.5" cy="8.5" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 4"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m10 9 5 3-5 3V9Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  reveal: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5v9A2.5 2.5 0 0 0 6 19h12a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 18 7h-6l-2-2H6a2.5 2.5 0 0 0-2.5 2.5Z"/><path d="m10 15 4-4M11 11h3v3"/></svg>'
};

const DEFAULT_THEME = { accent: '#b7f34a', background: '#080a0f', surface: '#0e1118' };
const GRID_GAP = 14;
const CARD_CAPTION_HEIGHT = 54;
const OVERSCAN_ROWS = 4;
const virtualCards = new Map();

const dom = {
  workspace: document.querySelector('#workspace'),
  openFolder: document.querySelector('#open-folder-button'),
  emptyOpen: document.querySelector('#empty-open-button'),
  rootTitle: document.querySelector('#root-title'),
  tree: document.querySelector('#tree-container'),
  breadcrumbs: document.querySelector('#breadcrumbs'),
  mediaSummary: document.querySelector('#media-summary'),
  recursive: document.querySelector('#recursive-toggle'),
  playAll: document.querySelector('#play-all-button'),
  playAllLabel: document.querySelector('#play-all-button span'),
  zoom: document.querySelector('#zoom-slider'),
  galleryScroll: document.querySelector('#gallery-scroll'),
  grid: document.querySelector('#media-grid'),
  emptyState: document.querySelector('#empty-state'),
  loadingState: document.querySelector('#loading-state'),
  loadingLabel: document.querySelector('#loading-label'),
  loadingProgressBar: document.querySelector('#loading-progress-bar'),
  loadingProgressText: document.querySelector('#loading-progress-text'),
  folderEmpty: document.querySelector('#folder-empty'),
  preview: document.querySelector('#preview-content'),
  leftToggle: document.querySelector('#left-panel-toggle'),
  rightToggle: document.querySelector('#right-panel-toggle'),
  leftCollapse: document.querySelector('#left-collapse'),
  rightCollapse: document.querySelector('#right-collapse'),
  leftRestore: document.querySelector('#left-restore'),
  rightRestore: document.querySelector('#right-restore'),
  leftResizer: document.querySelector('#left-resizer'),
  rightResizer: document.querySelector('#right-resizer'),
  settingsButton: document.querySelector('#settings-button'),
  settingsModal: document.querySelector('#settings-modal'),
  settingsClose: document.querySelector('#settings-close'),
  settingsDone: document.querySelector('#settings-done'),
  settingsReset: document.querySelector('#settings-reset'),
  confirmDeleteToggle: document.querySelector('#confirm-delete-toggle'),
  accentColor: document.querySelector('#accent-color'),
  backgroundColor: document.querySelector('#background-color'),
  surfaceColor: document.querySelector('#surface-color'),
  toastRegion: document.querySelector('#toast-region'),
  deleteModal: document.querySelector('#delete-modal'),
  deleteDescription: document.querySelector('#delete-description'),
  deleteCancel: document.querySelector('#delete-cancel'),
  deleteConfirm: document.querySelector('#delete-confirm')
};

const storedTileSize = Number(localStorage.getItem('lumina:tile-size')) || 230;
const storedConfirmDelete = localStorage.getItem('lumina:confirm-delete');
const state = {
  root: null,
  currentDirectory: null,
  media: [],
  selected: null,
  recursive: false,
  autoplay: false,
  requestId: 0,
  pendingDelete: null,
  confirmBeforeDelete: storedConfirmDelete === null ? true : storedConfirmDelete === 'true',
  deletingPaths: new Set(),
  preparedPaths: new Set(),
  warmedPaths: new Set(),
  virtual: { columns: 1, cardWidth: 230, rowHeight: 240, start: -1, end: -1 },
  tileSize: Math.min(420, Math.max(140, storedTileSize)),
  leftWidth: Math.min(520, Math.max(180, Number(localStorage.getItem('lumina:left-width')) || 280)),
  rightWidth: Math.min(600, Math.max(260, Number(localStorage.getItem('lumina:right-width')) || 360))
};

function normalizeHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : fallback;
}

function mixHex(left, right, amount) {
  const read = (value, offset) => Number.parseInt(value.slice(offset, offset + 2), 16);
  const channel = (a, b) => Math.round(a + (b - a) * amount).toString(16).padStart(2, '0');
  return `#${channel(read(left, 1), read(right, 1))}${channel(read(left, 3), read(right, 3))}${channel(read(left, 5), read(right, 5))}`;
}

function getStoredTheme() {
  try {
    const stored = JSON.parse(localStorage.getItem('lumina:theme') || '{}');
    return {
      accent: normalizeHex(stored.accent, DEFAULT_THEME.accent),
      background: normalizeHex(stored.background, DEFAULT_THEME.background),
      surface: normalizeHex(stored.surface, DEFAULT_THEME.surface)
    };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

function applyTheme(theme, persist = true) {
  const safeTheme = {
    accent: normalizeHex(theme.accent, DEFAULT_THEME.accent),
    background: normalizeHex(theme.background, DEFAULT_THEME.background),
    surface: normalizeHex(theme.surface, DEFAULT_THEME.surface)
  };
  const rgb = [1, 3, 5].map((offset) => Number.parseInt(safeTheme.accent.slice(offset, offset + 2), 16));
  const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--accent', safeTheme.accent);
  rootStyle.setProperty('--accent-strong', mixHex(safeTheme.accent, '#ffffff', 0.2));
  rootStyle.setProperty('--accent-ink', luminance > 150 ? '#101605' : '#ffffff');
  rootStyle.setProperty('--bg', safeTheme.background);
  rootStyle.setProperty('--gallery', mixHex(safeTheme.background, safeTheme.surface, 0.24));
  rootStyle.setProperty('--surface', safeTheme.surface);
  rootStyle.setProperty('--surface-raised', mixHex(safeTheme.surface, '#ffffff', 0.055));
  rootStyle.setProperty('--surface-hover', mixHex(safeTheme.surface, '#ffffff', 0.09));
  dom.accentColor.value = safeTheme.accent;
  dom.backgroundColor.value = safeTheme.background;
  dom.surfaceColor.value = safeTheme.surface;
  if (persist) localStorage.setItem('lumina:theme', JSON.stringify(safeTheme));
}

document.documentElement.style.setProperty('--tile-size', `${state.tileSize}px`);
document.documentElement.style.setProperty('--left-width', `${state.leftWidth}px`);
document.documentElement.style.setProperty('--right-width', `${state.rightWidth}px`);
dom.zoom.value = String(state.tileSize);
applyTheme(getStoredTheme(), false);

const videoObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    entry.target.dataset.inView = entry.isIntersecting ? 'true' : 'false';
    if (entry.isIntersecting && !entry.target.src && entry.target.dataset.src) {
      entry.target.src = entry.target.dataset.src;
      entry.target.preload = 'auto';
    }
    syncVideoPlayback(entry.target);
  }
}, { root: dom.galleryScroll, rootMargin: '300px 0px', threshold: 0.01 });

const previewWarmObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const card = entry.target;
    clearTimeout(card.previewWarmTimer);
    if (!entry.isIntersecting || !card.dataset.previewUrl) continue;
    card.previewWarmTimer = setTimeout(() => {
      if (card.isConnected) fetch(card.dataset.previewUrl, { method: 'HEAD' }).catch(() => {});
    }, 300);
  }
}, { root: dom.galleryScroll, threshold: 0.12 });

function syncVideoPlayback(video) {
  if (state.autoplay && video.dataset.inView === 'true') {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  dom.toastRegion.append(toast);
  setTimeout(() => toast.remove(), 3200);
}

function formatError(error) {
  const message = error?.message || String(error || 'Неизвестная ошибка');
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp));
}

function pluralFiles(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return `${count} файлов`;
  if (last === 1) return `${count} файл`;
  if (last >= 2 && last <= 4) return `${count} файла`;
  return `${count} файлов`;
}

function parentPath(filePath) {
  const index = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  return index > 0 ? filePath.slice(0, index) : filePath;
}

function joinPath(base, part) {
  const separator = base.includes('\\') ? '\\' : '/';
  return `${base.replace(/[\\/]$/, '')}${separator}${part}`;
}

function setGalleryView(view) {
  dom.emptyState.classList.toggle('hidden', view !== 'welcome');
  dom.loadingState.classList.toggle('hidden', view !== 'loading');
  dom.grid.classList.toggle('hidden', view !== 'grid');
  dom.folderEmpty.classList.toggle('hidden', view !== 'empty');
}

async function openFolder() {
  try {
    const root = await window.lumina.chooseFolder();
    if (!root) return;
    state.root = root;
    state.currentDirectory = root.path;
    state.selected = null;
    state.media = [];
    state.preparedPaths = new Set();
    state.warmedPaths = new Set();
    dom.rootTitle.textContent = root.name;
    renderEmptyPreview();
    await renderTree();
    await loadMedia({ prepareRoot: true });
  } catch (error) {
    showToast(`Не удалось открыть папку: ${formatError(error)}`, 'error');
  }
}

async function renderTree() {
  if (!state.root) return;
  dom.tree.replaceChildren();
  const rootNode = createTreeNode(state.root, 0, true);
  dom.tree.append(rootNode);
  const toggle = rootNode.querySelector('.tree-chevron');
  const children = rootNode.querySelector('.tree-children');
  await expandTreeNode(state.root, toggle, children, 1);
  updateSelectionClasses();
}

function createTreeNode(entry, depth, expanded = false) {
  const node = document.createElement('div');
  node.className = 'tree-node';
  node.dataset.path = entry.path;

  const row = document.createElement('div');
  row.className = 'tree-row';
  row.style.setProperty('--depth', depth);
  row.dataset.rowPath = entry.path;
  row.dataset.kind = entry.kind;
  row.title = entry.path;

  const chevron = document.createElement('button');
  chevron.className = `tree-chevron ${entry.kind === 'directory' ? '' : 'spacer'}`;
  chevron.innerHTML = ICONS.chevron;
  chevron.tabIndex = entry.kind === 'directory' ? 0 : -1;
  chevron.setAttribute('aria-label', entry.kind === 'directory' ? 'Развернуть папку' : '');

  const icon = document.createElement('span');
  icon.className = 'tree-icon';
  icon.innerHTML = ICONS[entry.kind] || ICONS.image;

  const name = document.createElement('span');
  name.className = 'tree-name';
  name.textContent = entry.name;

  row.append(chevron, icon, name);
  node.append(row);

  if (entry.kind === 'directory') {
    const children = document.createElement('div');
    children.className = 'tree-children';
    if (!expanded) children.classList.add('hidden');
    node.append(children);

    chevron.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (chevron.classList.contains('expanded')) {
        chevron.classList.remove('expanded');
        children.classList.add('hidden');
      } else {
        children.classList.remove('hidden');
        await expandTreeNode(entry, chevron, children, depth + 1);
      }
    });

    row.addEventListener('dblclick', async () => {
      children.classList.remove('hidden');
      await expandTreeNode(entry, chevron, children, depth + 1);
    });
    row.addEventListener('click', () => selectDirectory(entry.path));
  } else {
    row.addEventListener('click', () => selectMedia(entry));
  }
  return node;
}

async function expandTreeNode(entry, chevron, container, childDepth) {
  chevron.classList.add('expanded');
  if (container.dataset.loaded === 'true') return;

  const loading = document.createElement('div');
  loading.className = 'tree-loading';
  loading.style.setProperty('--depth', childDepth);
  loading.textContent = 'Загрузка…';
  container.append(loading);

  try {
    const entries = await window.lumina.getChildren(entry.path);
    container.replaceChildren(...entries.map((child) => createTreeNode(child, childDepth)));
    container.dataset.loaded = 'true';
  } catch (error) {
    loading.textContent = 'Нет доступа';
    showToast(formatError(error), 'error');
  }
}

async function selectDirectory(directoryPath) {
  if (state.currentDirectory === directoryPath) {
    updateSelectionClasses();
    return;
  }
  state.currentDirectory = directoryPath;
  dom.galleryScroll.scrollTop = 0;
  state.selected = null;
  renderEmptyPreview();
  updateSelectionClasses();
  await loadMedia();
}

async function loadMedia(options = {}) {
  if (!state.currentDirectory) return;
  const requestId = ++state.requestId;
  if (!options.quiet) {
    setGalleryView('loading');
    dom.loadingLabel.textContent = 'Сканируем папки…';
    dom.loadingProgressBar.style.width = '0%';
    dom.loadingProgressText.textContent = 'Подготовка списка файлов';
  }
  renderBreadcrumbs();
  dom.mediaSummary.textContent = state.recursive ? 'Поиск в папке и подпапках…' : 'Поиск в текущей папке…';

  try {
    const media = await window.lumina.getMedia(state.currentDirectory, state.recursive);
    if (requestId !== state.requestId) return;
    if (options.quiet && mediaListsEqual(media, state.media)) return;

    let libraryMedia = media;
    let itemsToPrepare = media.filter((item) => !state.preparedPaths.has(item.path));
    if (options.prepareRoot && state.root) {
      dom.loadingLabel.textContent = 'Сканируем всю медиатеку…';
      libraryMedia = await window.lumina.getMedia(state.root.path, true);
      if (requestId !== state.requestId) return;
      itemsToPrepare = libraryMedia.filter((item) => !state.preparedPaths.has(item.path));
    }

    if (itemsToPrepare.length) {
      if (!options.quiet) {
        dom.loadingLabel.textContent = 'Подготавливаем медиатеку…';
        dom.loadingProgressText.textContent = `0 / ${itemsToPrepare.length} файлов`;
      }
      await window.lumina.prepareMedia(
        itemsToPrepare.map((item) => ({ path: item.path, kind: item.kind })),
        requestId
      );
      if (requestId !== state.requestId) return;
      for (const item of itemsToPrepare) state.preparedPaths.add(item.path);
    }

    const itemsToWarm = (options.prepareRoot ? libraryMedia : itemsToPrepare)
      .filter((item) => !state.warmedPaths.has(item.path));
    if (itemsToWarm.length) {
      await warmMediaCache(itemsToWarm, requestId, options.quiet);
      if (requestId !== state.requestId) return;
      for (const item of itemsToWarm) state.warmedPaths.add(item.path);
    }

    state.media = media;
    if (state.selected && !media.some((item) => item.path === state.selected.path)) {
      state.selected = null;
      renderEmptyPreview();
    }
    renderGallery();
  } catch (error) {
    if (requestId !== state.requestId) return;
    state.media = [];
    setGalleryView('empty');
    dom.mediaSummary.textContent = 'Не удалось прочитать папку';
    showToast(formatError(error), 'error');
  }
}

function mediaListsEqual(left, right) {
  return left.length === right.length && left.every((item, index) => (
    item.path === right[index]?.path && item.kind === right[index]?.kind
  ));
}

async function warmMediaCache(items, requestId, quiet) {
  const resources = items.flatMap((item) => (
    item.kind === 'video' ? [item.thumbnailUrl, item.previewUrl] : [item.thumbnailUrl]
  )).filter(Boolean);
  let nextIndex = 0;
  let completed = 0;
  if (!quiet) {
    dom.loadingLabel.textContent = 'Загружаем быстрый кэш…';
    dom.loadingProgressBar.style.width = '0%';
    dom.loadingProgressText.textContent = `0 / ${resources.length} ресурсов`;
  }
  const worker = async () => {
    while (nextIndex < resources.length && requestId === state.requestId) {
      const resource = resources[nextIndex++];
      try {
        const response = await fetch(resource);
        if (response.ok) await response.arrayBuffer();
      } catch {}
      completed += 1;
      if (!quiet && requestId === state.requestId) {
        const percent = resources.length ? Math.round((completed / resources.length) * 100) : 100;
        dom.loadingProgressBar.style.width = `${percent}%`;
        dom.loadingProgressText.textContent = `${completed} / ${resources.length} ресурсов`;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(12, resources.length) }, () => worker()));
}

function renderBreadcrumbs() {
  dom.breadcrumbs.replaceChildren();
  if (!state.root || !state.currentDirectory) {
    dom.breadcrumbs.textContent = 'Галерея';
    return;
  }

  const rawRelative = state.currentDirectory.slice(state.root.path.length).replace(/^[\\/]+/, '');
  const parts = rawRelative ? rawRelative.split(/[\\/]+/) : [];
  let accumulated = state.root.path;
  const crumbs = [{ name: state.root.name, path: state.root.path }];
  for (const part of parts) {
    accumulated = joinPath(accumulated, part);
    crumbs.push({ name: part, path: accumulated });
  }

  crumbs.forEach((crumb, index) => {
    if (index) {
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '/';
      dom.breadcrumbs.append(separator);
    }
    const button = document.createElement('button');
    button.className = 'breadcrumb-button';
    button.textContent = crumb.name;
    button.title = crumb.path;
    button.addEventListener('click', () => selectDirectory(crumb.path));
    dom.breadcrumbs.append(button);
  });
}

function renderGallery() {
  clearVirtualCards();
  const videoCount = state.media.filter((item) => item.kind === 'video').length;
  const imageCount = state.media.length - videoCount;
  dom.playAll.disabled = videoCount === 0;
  dom.mediaSummary.textContent = `${pluralFiles(state.media.length)} · ${imageCount} фото · ${videoCount} видео${state.recursive ? ' · включая подпапки' : ''}`;

  if (!state.media.length) {
    setAutoplay(false);
    setGalleryView('empty');
    return;
  }

  setGalleryView('grid');
  state.virtual.start = -1;
  state.virtual.end = -1;
  requestAnimationFrame(() => layoutVirtualGrid(true));
}

function disposeCard(card) {
  clearTimeout(card.previewWarmTimer);
  previewWarmObserver.unobserve(card);
  const video = card.querySelector('video');
  if (video) {
    videoObserver.unobserve(video);
    video.pause();
  }
  card.remove();
  if (video) {
    const releaseVideo = () => {
      video.removeAttribute('src');
      video.load();
    };
    if ('requestIdleCallback' in window) requestIdleCallback(releaseVideo, { timeout: 1200 });
    else setTimeout(releaseVideo, 250);
  }
}

function clearVirtualCards() {
  for (const card of virtualCards.values()) disposeCard(card);
  virtualCards.clear();
  videoObserver.disconnect();
  previewWarmObserver.disconnect();
  dom.grid.replaceChildren();
}

function layoutVirtualGrid(force = false) {
  if (!state.media.length || dom.grid.classList.contains('hidden')) return;
  const availableWidth = Math.max(1, dom.grid.clientWidth);
  const columns = Math.max(1, Math.floor((availableWidth + GRID_GAP) / (state.tileSize + GRID_GAP)));
  const cardWidth = (availableWidth - GRID_GAP * (columns - 1)) / columns;
  const rowHeight = cardWidth * 0.75 + CARD_CAPTION_HEIGHT + GRID_GAP;
  const rowCount = Math.ceil(state.media.length / columns);
  const changed = columns !== state.virtual.columns || Math.abs(cardWidth - state.virtual.cardWidth) > 0.5;

  state.virtual.columns = columns;
  state.virtual.cardWidth = cardWidth;
  state.virtual.rowHeight = rowHeight;
  dom.grid.style.height = `${Math.max(1, rowCount * rowHeight - GRID_GAP)}px`;
  if (changed) {
    state.virtual.start = -1;
    state.virtual.end = -1;
  }
  renderVirtualWindow(force || changed);
}

function renderVirtualWindow(force = false) {
  if (!state.media.length) return;
  const { columns, cardWidth, rowHeight } = state.virtual;
  const viewportTop = Math.max(0, dom.galleryScroll.scrollTop - dom.grid.offsetTop);
  const firstRow = Math.max(0, Math.floor(viewportTop / rowHeight) - OVERSCAN_ROWS);
  const lastRow = Math.min(
    Math.ceil(state.media.length / columns) - 1,
    Math.ceil((viewportTop + dom.galleryScroll.clientHeight) / rowHeight) + OVERSCAN_ROWS
  );
  const start = firstRow * columns;
  const end = Math.min(state.media.length, (lastRow + 1) * columns);
  if (!force && start === state.virtual.start && end === state.virtual.end) return;

  state.virtual.start = start;
  state.virtual.end = end;

  for (const [index, card] of virtualCards) {
    const item = state.media[index];
    const wrongMode = card.dataset.autoplayMode !== String(state.autoplay);
    if (index < start || index >= end || !item || card.dataset.path !== item.path || wrongMode) {
      disposeCard(card);
      virtualCards.delete(index);
    }
  }

  const fragment = document.createDocumentFragment();
  for (let index = start; index < end; index += 1) {
    let card = virtualCards.get(index);
    if (!card) {
      card = createMediaCard(state.media[index]);
      virtualCards.set(index, card);
      fragment.append(card);
    }
    const row = Math.floor(index / columns);
    const column = index % columns;
    card.dataset.index = String(index);
    card.style.width = `${cardWidth}px`;
    card.style.left = `${column * (cardWidth + GRID_GAP)}px`;
    card.style.top = `${row * rowHeight}px`;
  }
  dom.grid.append(fragment);
}

function scrollToMediaIndex(index) {
  const { columns, rowHeight, cardWidth } = state.virtual;
  const row = Math.floor(index / columns);
  const top = dom.grid.offsetTop + row * rowHeight;
  const bottom = top + cardWidth * 0.75 + CARD_CAPTION_HEIGHT;
  const viewportTop = dom.galleryScroll.scrollTop;
  const viewportBottom = viewportTop + dom.galleryScroll.clientHeight;
  if (top < viewportTop) dom.galleryScroll.scrollTop = top;
  else if (bottom > viewportBottom) dom.galleryScroll.scrollTop = bottom - dom.galleryScroll.clientHeight;
  renderVirtualWindow(true);
}

function createMediaCard(item) {
  const card = document.createElement('article');
  card.className = 'media-card loading-media';
  card.dataset.path = item.path;
  card.dataset.autoplayMode = String(state.autoplay);
  if (item.path === state.selected?.path) card.classList.add('selected');
  card.tabIndex = 0;
  card.title = item.path;

  const frame = document.createElement('div');
  frame.className = 'media-frame';
  let mediaElement;
  const useThumbnail = item.kind === 'image' || !state.autoplay;
  if (useThumbnail) {
    mediaElement = document.createElement('img');
    mediaElement.src = item.thumbnailUrl || item.url;
    mediaElement.alt = item.name;
    mediaElement.loading = 'lazy';
    mediaElement.decoding = 'async';
    mediaElement.addEventListener('load', () => card.classList.remove('loading-media'), { once: true });
    mediaElement.addEventListener('error', () => {
      if (item.kind === 'image' && mediaElement.dataset.fallback !== 'true') {
        mediaElement.dataset.fallback = 'true';
        mediaElement.src = item.url;
      } else {
        card.classList.remove('loading-media');
      }
    });
  } else {
    mediaElement = document.createElement('video');
    mediaElement.dataset.src = item.previewUrl || item.url;
    mediaElement.poster = item.thumbnailUrl || '';
    mediaElement.muted = true;
    mediaElement.loop = true;
    mediaElement.playsInline = true;
    mediaElement.preload = 'none';
    mediaElement.addEventListener('loadeddata', () => card.classList.remove('loading-media'), { once: true });
    videoObserver.observe(mediaElement);
  }
  if (!useThumbnail) {
    mediaElement.addEventListener('error', () => card.classList.remove('loading-media'), { once: true });
  }

  const badge = document.createElement('span');
  badge.className = 'media-badge';
  badge.innerHTML = `${ICONS[item.kind]}<span>${item.kind === 'video' ? 'Видео' : 'Фото'}</span>`;

  const remove = document.createElement('button');
  remove.className = 'card-delete';
  remove.innerHTML = ICONS.trash;
  remove.title = 'Переместить в корзину';
  remove.setAttribute('aria-label', `Удалить ${item.name}`);
  remove.addEventListener('click', (event) => {
    event.stopPropagation();
    requestDelete(item);
  });

  frame.append(mediaElement, badge, remove);

  const caption = document.createElement('div');
  caption.className = 'media-caption';
  const name = document.createElement('div');
  name.className = 'media-name';
  name.textContent = item.name;
  const location = document.createElement('div');
  location.className = 'media-path';
  location.textContent = state.recursive && item.relativeDirectory !== '.' ? item.relativeDirectory : item.kind === 'video' ? 'Видео' : 'Изображение';
  caption.append(name, location);
  card.append(frame, caption);

  card.addEventListener('click', () => selectMedia(item));
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectMedia(item);
    }
  });
  if (item.kind === 'video' && useThumbnail && item.previewUrl) {
    card.dataset.previewUrl = item.previewUrl;
    previewWarmObserver.observe(card);
  }
  return card;
}

function selectMedia(item) {
  state.selected = item;
  updateSelectionClasses();
  renderPreview(item);
}

function updateSelectionClasses() {
  document.querySelectorAll('.media-card').forEach((card) => {
    card.classList.toggle('selected', card.dataset.path === state.selected?.path);
  });
  document.querySelectorAll('.tree-row').forEach((row) => {
    const selectedPath = state.selected?.path || state.currentDirectory;
    row.classList.toggle('selected', row.dataset.rowPath === selectedPath);
  });
}

function renderEmptyPreview() {
  dom.preview.replaceChildren();
  const placeholder = document.createElement('div');
  placeholder.className = 'panel-placeholder';
  placeholder.innerHTML = `
    <div class="placeholder-icon eye">
      <svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
    </div>
    <p>Выберите фото или видео<br>для предпросмотра</p>`;
  dom.preview.append(placeholder);
  updateSelectionClasses();
}

async function renderPreview(item) {
  const active = document.createElement('div');
  active.className = 'preview-active';

  const stage = document.createElement('div');
  stage.className = 'preview-stage';
  let mediaElement;
  if (item.kind === 'image') {
    mediaElement = document.createElement('img');
    mediaElement.src = item.url;
    mediaElement.alt = item.name;
  } else {
    mediaElement = document.createElement('video');
    mediaElement.src = item.url;
    mediaElement.controls = true;
    mediaElement.preload = 'metadata';
  }
  stage.append(mediaElement);

  const details = document.createElement('div');
  details.className = 'preview-details';
  const title = document.createElement('h3');
  title.className = 'preview-name';
  title.textContent = item.name;
  const kind = document.createElement('span');
  kind.className = 'preview-kind';
  kind.textContent = item.kind === 'video' ? 'Видео' : 'Изображение';

  const list = document.createElement('dl');
  list.className = 'detail-list';
  const filePath = document.createElement('div');
  filePath.className = 'detail-row';
  const filePathTerm = document.createElement('dt');
  filePathTerm.textContent = 'Папка';
  const filePathValue = document.createElement('dd');
  filePathValue.textContent = parentPath(item.path);
  filePath.append(filePathTerm, filePathValue);

  const size = createDetailRow('Размер', 'Загрузка…');
  const modified = createDetailRow('Изменён', 'Загрузка…');
  list.append(filePath, size.row, modified.row);

  const actions = document.createElement('div');
  actions.className = 'preview-actions';
  const reveal = document.createElement('button');
  reveal.className = 'button ghost';
  reveal.innerHTML = `${ICONS.reveal}<span>В папке</span>`;
  reveal.addEventListener('click', async () => {
    try {
      await window.lumina.revealItem(item.path);
    } catch (error) {
      showToast(formatError(error), 'error');
    }
  });
  const remove = document.createElement('button');
  remove.className = 'button ghost danger-outline';
  remove.innerHTML = `${ICONS.trash}<span>Удалить</span>`;
  remove.addEventListener('click', () => requestDelete(item));
  actions.append(reveal, remove);

  details.append(title, kind, list, actions);
  active.append(stage, details);
  dom.preview.replaceChildren(active);

  try {
    const info = await window.lumina.getItemInfo(item.path);
    if (state.selected?.path !== item.path) return;
    size.value.textContent = formatBytes(info.size);
    modified.value.textContent = formatDate(info.modifiedAt);
  } catch {
    if (state.selected?.path === item.path) {
      size.value.textContent = 'Недоступно';
      modified.value.textContent = 'Недоступно';
    }
  }
}

function createDetailRow(label, initialValue) {
  const row = document.createElement('div');
  row.className = 'detail-row';
  const term = document.createElement('dt');
  term.textContent = label;
  const value = document.createElement('dd');
  value.textContent = initialValue;
  row.append(term, value);
  return { row, value };
}

function setAutoplay(enabled) {
  state.autoplay = Boolean(enabled && state.media.some((item) => item.kind === 'video'));
  dom.playAll.classList.toggle('active', state.autoplay);
  dom.playAllLabel.textContent = state.autoplay ? 'Видео: вкл.' : 'Видео: выкл.';
  if (state.media.length) renderVirtualWindow(true);
}

function requestDelete(item) {
  if (!state.confirmBeforeDelete) {
    void deleteItem(item);
    return;
  }
  state.pendingDelete = item;
  dom.deleteDescription.textContent = `«${item.name}» исчезнет из исходной папки, но его можно будет восстановить из Корзины Windows.`;
  dom.deleteModal.classList.remove('hidden');
  dom.deleteConfirm.focus();
}

function closeDeleteModal() {
  state.pendingDelete = null;
  dom.deleteModal.classList.add('hidden');
}

async function deleteItem(item, fromModal = false) {
  if (!item || state.deletingPaths.has(item.path)) return;
  state.deletingPaths.add(item.path);
  if (fromModal) {
    dom.deleteConfirm.disabled = true;
    dom.deleteConfirm.textContent = 'Удаление…';
  }
  try {
    await window.lumina.moveToTrash(item.path);
    if (fromModal) closeDeleteModal();
    state.preparedPaths.delete(item.path);
    state.warmedPaths.delete(item.path);
    if (state.selected?.path === item.path) {
      state.selected = null;
      renderEmptyPreview();
    }
    state.media = state.media.filter((media) => media.path !== item.path);
    renderGallery();
    showToast('Файл перемещён в Корзину');
    setTimeout(() => renderTree(), 100);
  } catch (error) {
    showToast(`Не удалось удалить файл: ${formatError(error)}`, 'error');
  } finally {
    state.deletingPaths.delete(item.path);
    if (fromModal) {
      dom.deleteConfirm.disabled = false;
      dom.deleteConfirm.textContent = 'В корзину';
    }
  }
}

async function confirmDelete() {
  await deleteItem(state.pendingDelete, true);
}

function togglePanel(side, visible) {
  const className = `${side}-hidden`;
  const shouldHide = visible === undefined ? !dom.workspace.classList.contains(className) : !visible;
  dom.workspace.classList.toggle(className, shouldHide);
  dom[`${side}Restore`].classList.toggle('hidden', !shouldHide);
}

function bindResizer(element, side) {
  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    element.classList.add('dragging');
    document.body.classList.add('resizing');
    const startX = event.clientX;
    const startWidth = side === 'left' ? state.leftWidth : state.rightWidth;

    const onMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const next = side === 'left' ? startWidth + delta : startWidth - delta;
      const min = side === 'left' ? 180 : 260;
      const max = side === 'left' ? 520 : 600;
      const width = Math.min(max, Math.max(min, next));
      state[`${side}Width`] = width;
      document.documentElement.style.setProperty(`--${side}-width`, `${width}px`);
    };
    const onUp = () => {
      element.classList.remove('dragging');
      document.body.classList.remove('resizing');
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      localStorage.setItem(`lumina:${side}-width`, String(state[`${side}Width`]));
    };
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
  });

  element.addEventListener('dblclick', () => {
    const width = side === 'left' ? 280 : 360;
    state[`${side}Width`] = width;
    document.documentElement.style.setProperty(`--${side}-width`, `${width}px`);
    localStorage.setItem(`lumina:${side}-width`, String(width));
  });
}

function openSettings() {
  dom.settingsModal.classList.remove('hidden');
  dom.settingsClose.focus();
}

function closeSettings() {
  dom.settingsModal.classList.add('hidden');
  dom.settingsButton.focus();
}

function applyThemeInputs() {
  applyTheme({
    accent: dom.accentColor.value,
    background: dom.backgroundColor.value,
    surface: dom.surfaceColor.value
  });
}

dom.openFolder.addEventListener('click', openFolder);
dom.emptyOpen.addEventListener('click', openFolder);
dom.recursive.addEventListener('change', async () => {
  state.recursive = dom.recursive.checked;
  await loadMedia();
});
dom.playAll.addEventListener('click', () => setAutoplay(!state.autoplay));
dom.zoom.addEventListener('input', () => {
  state.tileSize = Number(dom.zoom.value);
  document.documentElement.style.setProperty('--tile-size', `${state.tileSize}px`);
  localStorage.setItem('lumina:tile-size', String(state.tileSize));
  layoutVirtualGrid(true);
});
dom.settingsButton.addEventListener('click', openSettings);
dom.settingsClose.addEventListener('click', closeSettings);
dom.settingsDone.addEventListener('click', closeSettings);
dom.settingsReset.addEventListener('click', () => applyTheme(DEFAULT_THEME));
dom.confirmDeleteToggle.addEventListener('change', () => {
  state.confirmBeforeDelete = dom.confirmDeleteToggle.checked;
  localStorage.setItem('lumina:confirm-delete', String(state.confirmBeforeDelete));
});
[dom.accentColor, dom.backgroundColor, dom.surfaceColor].forEach((input) => {
  input.addEventListener('input', applyThemeInputs);
});
document.querySelectorAll('.theme-preset').forEach((button) => {
  button.addEventListener('click', () => applyTheme({
    accent: button.dataset.accent,
    background: button.dataset.background,
    surface: button.dataset.surface
  }));
});
dom.settingsModal.addEventListener('click', (event) => {
  if (event.target === dom.settingsModal) closeSettings();
});
dom.leftToggle.addEventListener('click', () => togglePanel('left'));
dom.leftCollapse.addEventListener('click', () => togglePanel('left', false));
dom.leftRestore.querySelector('button').addEventListener('click', () => togglePanel('left', true));
dom.rightToggle.addEventListener('click', () => togglePanel('right'));
dom.rightCollapse.addEventListener('click', () => togglePanel('right', false));
dom.rightRestore.querySelector('button').addEventListener('click', () => togglePanel('right', true));
dom.deleteCancel.addEventListener('click', closeDeleteModal);
dom.deleteConfirm.addEventListener('click', confirmDelete);
dom.deleteModal.addEventListener('click', (event) => {
  if (event.target === dom.deleteModal) closeDeleteModal();
});

bindResizer(dom.leftResizer, 'left');
bindResizer(dom.rightResizer, 'right');

dom.confirmDeleteToggle.checked = state.confirmBeforeDelete;

let galleryScrollFrame;
dom.galleryScroll.addEventListener('scroll', () => {
  if (galleryScrollFrame) return;
  galleryScrollFrame = requestAnimationFrame(() => {
    galleryScrollFrame = null;
    renderVirtualWindow();
  });
}, { passive: true });

const galleryResizeObserver = new ResizeObserver(() => {
  requestAnimationFrame(() => layoutVirtualGrid());
});
galleryResizeObserver.observe(document.querySelector('#gallery-panel'));

window.addEventListener('keydown', (event) => {
  const tag = event.target.tagName;
  const isEditing = tag === 'INPUT' || tag === 'TEXTAREA';
  if (event.key === 'Escape' && !dom.deleteModal.classList.contains('hidden')) {
    closeDeleteModal();
    return;
  }
  if (event.key === 'Escape' && !dom.settingsModal.classList.contains('hidden')) {
    closeSettings();
    return;
  }
  if (isEditing || !dom.deleteModal.classList.contains('hidden') || !dom.settingsModal.classList.contains('hidden')) return;
  if (event.ctrlKey && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    openFolder();
  } else if (event.key === 'Delete' && state.selected) {
    event.preventDefault();
    requestDelete(state.selected);
  } else if (event.key === ' ' && state.media.some((item) => item.kind === 'video')) {
    event.preventDefault();
    setAutoplay(!state.autoplay);
  } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && state.media.length) {
    const currentIndex = state.media.findIndex((item) => item.path === state.selected?.path);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = currentIndex < 0 ? 0 : Math.min(state.media.length - 1, Math.max(0, currentIndex + direction));
    selectMedia(state.media[nextIndex]);
    scrollToMediaIndex(nextIndex);
  }
});

let filesystemRefreshTimer;
window.lumina.onFilesystemChanged(() => {
  clearTimeout(filesystemRefreshTimer);
  filesystemRefreshTimer = setTimeout(async () => {
    if (!state.root) return;
    await loadMedia({ quiet: true });
  }, 1200);
});

window.lumina.onPrepareProgress((progress) => {
  if (progress.requestId !== state.requestId || dom.loadingState.classList.contains('hidden')) return;
  const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 100;
  dom.loadingProgressBar.style.width = `${percent}%`;
  dom.loadingProgressText.textContent = `${progress.completed} / ${progress.total} файлов${progress.errors ? ` · ошибок: ${progress.errors}` : ''}`;
});
