const ICONS = {
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5v9A2.5 2.5 0 0 0 6 19h12a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 18 7h-6l-2-2H6a2.5 2.5 0 0 0-2.5 2.5Z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><circle cx="15.5" cy="8.5" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 4"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m10 9 5 3-5 3V9Z"/></svg>',
  audio: '<svg viewBox="0 0 24 24"><path d="M9 17.5V6l10-2v11.5M9 9l10-2"/><circle cx="6" cy="17.5" r="3"/><circle cx="16" cy="15.5" r="3"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M6 3.5h8l4 4V20.5H6Z"/><path d="M14 3.5v4h4M9 11h6M9 14h6M9 17h4"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M12 2.8 14 4l2.4-.3.9 2.2 2.1 1.2-.5 2.4 1.4 2-1.4 2 .5 2.4-2.1 1.2-.9 2.2-2.4-.3-2 1.2-2-1.2-2.4.3-.9-2.2-2.1-1.2.5-2.4-1.4-2 1.4-2-.5-2.4 2.1-1.2.9-2.2L10 4l2-1.2Z"/><circle cx="12" cy="12" r="3"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  reveal: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5v9A2.5 2.5 0 0 0 6 19h12a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 18 7h-6l-2-2H6a2.5 2.5 0 0 0-2.5 2.5Z"/><path d="m10 15 4-4M11 11h3v3"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>'
};

const DEFAULT_THEME = { accent: '#b7f34a', background: '#080a0f', surface: '#0e1118' };
const MEDIA_KINDS = ['image', 'video', 'audio', 'file'];
const MEDIA_LABELS = { image: 'Фото', video: 'Видео', audio: 'Аудио', file: 'Файл' };
const GRID_GAP = 14;
const CARD_CAPTION_HEIGHT = 54;
const OVERSCAN_ROWS = 4;
const MAX_PREVIEW_HISTORY = 100;
const virtualCards = new Map();
const customScrollbars = [];

const dom = {
  workspace: document.querySelector('#workspace'),
  openFolder: document.querySelector('#open-folder-button'),
  emptyOpen: document.querySelector('#empty-open-button'),
  rootTitle: document.querySelector('#root-title'),
  tree: document.querySelector('#tree-container'),
  breadcrumbs: document.querySelector('#breadcrumbs'),
  mediaSummary: document.querySelector('#media-summary'),
  mediaFilters: [...document.querySelectorAll('.media-filter')],
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
  folderEmptyTitle: document.querySelector('#folder-empty-title'),
  folderEmptyCopy: document.querySelector('#folder-empty-copy'),
  preview: document.querySelector('#preview-content'),
  previewHistoryToggle: document.querySelector('#preview-history-toggle'),
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
  queueAutoplayToggle: document.querySelector('#queue-autoplay-toggle'),
  accentColor: document.querySelector('#accent-color'),
  backgroundColor: document.querySelector('#background-color'),
  surfaceColor: document.querySelector('#surface-color'),
  toastRegion: document.querySelector('#toast-region'),
  contextMenu: document.querySelector('#file-context-menu'),
  contextOpenDefault: document.querySelector('#context-open-default'),
  contextReveal: document.querySelector('#context-reveal'),
  contextFavorite: document.querySelector('#context-favorite'),
  contextLoopVideo: document.querySelector('#context-loop-video'),
  contextRename: document.querySelector('#context-rename'),
  contextCreateFolder: document.querySelector('#context-create-folder'),
  contextDetachRoot: document.querySelector('#context-detach-root'),
  contextDelete: document.querySelector('#context-delete'),
  nameModal: document.querySelector('#name-modal'),
  nameForm: document.querySelector('#name-form'),
  nameTitle: document.querySelector('#name-modal-title'),
  nameDescription: document.querySelector('#name-modal-description'),
  nameInput: document.querySelector('#name-input'),
  nameCancel: document.querySelector('#name-cancel'),
  nameSubmit: document.querySelector('#name-submit'),
  deleteModal: document.querySelector('#delete-modal'),
  deleteDescription: document.querySelector('#delete-description'),
  deleteCancel: document.querySelector('#delete-cancel'),
  deleteConfirm: document.querySelector('#delete-confirm')
};

const storedTileSize = Number(localStorage.getItem('lumina:tile-size')) || 230;
const storedConfirmDelete = localStorage.getItem('lumina:confirm-delete');
const storedQueueAutoplay = localStorage.getItem('lumina:queue-autoplay');
const storedPreviewHistory = localStorage.getItem('lumina:preview-history');
const state = {
  roots: [],
  root: null,
  currentDirectory: null,
  media: [],
  allMedia: [],
  mediaFilters: getStoredMediaFilters(),
  selected: null,
  selectedPaths: new Set(),
  selectionAnchorPath: null,
  previewHistory: [],
  previewHistoryEnabled: storedPreviewHistory === 'true',
  favoriteItems: getStoredFavorites(),
  recursive: false,
  autoplay: false,
  requestId: 0,
  contextItem: null,
  nameAction: null,
  draggedItem: null,
  draggedItems: [],
  externalDraggedItems: [],
  externalDragStarted: false,
  externalDragCancelled: false,
  moveInProgress: false,
  pendingDelete: null,
  confirmBeforeDelete: storedConfirmDelete === null ? true : storedConfirmDelete === 'true',
  queueAutoplay: storedQueueAutoplay === 'true',
  deletingPaths: new Set(),
  preparedPaths: new Set(),
  warmedPaths: new Set(),
  preparingPaths: new Set(),
  loopVideoPaths: new Set(),
  virtual: { columns: 1, cardWidth: 230, rowHeight: 240, start: -1, end: -1 },
  tileSize: Math.min(420, Math.max(140, storedTileSize)),
  leftWidth: Math.min(520, Math.max(180, Number(localStorage.getItem('lumina:left-width')) || 280)),
  rightWidth: Math.min(600, Math.max(260, Number(localStorage.getItem('lumina:right-width')) || 360))
};

function getStoredMediaFilters() {
  try {
    const stored = JSON.parse(localStorage.getItem('lumina:media-filters') || 'null');
    const valid = Array.isArray(stored) ? stored.filter((kind) => MEDIA_KINDS.includes(kind)) : MEDIA_KINDS;
    return new Set(valid.length ? valid : MEDIA_KINDS);
  } catch {
    return new Set(MEDIA_KINDS);
  }
}

function getStoredFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem('lumina:favorites') || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) => item && typeof item.path === 'string'
      && typeof item.name === 'string' && typeof item.kind === 'string');
  } catch {
    return [];
  }
}

function favoriteKey(itemPath) {
  return normalizeComparablePath(itemPath);
}

function isFavorite(itemPath) {
  const key = favoriteKey(itemPath);
  return state.favoriteItems.some((item) => favoriteKey(item.path) === key);
}

function persistFavorites() {
  localStorage.setItem('lumina:favorites', JSON.stringify(state.favoriteItems));
}

function toggleFavorite(item) {
  if (!item) return;
  const key = favoriteKey(item.path);
  if (isFavorite(item.path)) {
    state.favoriteItems = state.favoriteItems.filter((entry) => favoriteKey(entry.path) !== key);
    showToast(`«${item.name}» удалён из избранного`);
  } else {
    state.favoriteItems = [{ ...item }, ...state.favoriteItems];
    showToast(`«${item.name}» добавлен в избранное`);
  }
  persistFavorites();
  renderFavoritesSection();
}

function createFavoriteToggle(entry) {
  const button = document.createElement('button');
  button.className = 'tree-favorite-toggle';
  button.type = 'button';
  button.dataset.favoritePath = entry.path;
  button.innerHTML = ICONS.star;
  button.addEventListener('pointerdown', (event) => event.stopPropagation());
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(entry);
  });
  updateFavoriteToggle(button, entry.path);
  return button;
}

function updateFavoriteToggle(button, itemPath) {
  const active = isFavorite(itemPath);
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
  button.title = active ? 'Убрать из избранного' : 'Добавить в избранное';
  button.setAttribute('aria-label', button.title);
}
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

function updateCustomScrollbars() {
  for (const scrollbar of customScrollbars) scrollbar.update();
}

function initCustomScrollbar(scroller) {
  const track = document.createElement('div');
  track.className = 'custom-scrollbar';
  const thumb = document.createElement('div');
  thumb.className = 'custom-scrollbar-thumb';
  track.append(thumb);
  document.body.append(track);

  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const rect = scroller.getBoundingClientRect();
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const visible = maxScroll > 1 && rect.width > 20 && rect.height > 20
        && getComputedStyle(scroller).visibility !== 'hidden';
      track.classList.toggle('visible', visible);
      if (!visible) return;
      const trackHeight = Math.max(0, rect.height - 8);
      const thumbHeight = Math.max(32, trackHeight * (scroller.clientHeight / scroller.scrollHeight));
      const travel = Math.max(0, trackHeight - thumbHeight);
      const thumbTop = maxScroll > 0 ? (scroller.scrollTop / maxScroll) * travel : 0;
      track.style.left = `${Math.round(rect.right - 11)}px`;
      track.style.top = `${Math.round(rect.top + 4)}px`;
      track.style.height = `${Math.round(trackHeight)}px`;
      thumb.style.height = `${Math.round(thumbHeight)}px`;
      thumb.style.transform = `translateY(${Math.round(thumbTop)}px)`;
    });
  };

  thumb.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    thumb.setPointerCapture(event.pointerId);
    thumb.classList.add('dragging');
    document.body.classList.add('scrollbar-dragging');
    const startY = event.clientY;
    const startScroll = scroller.scrollTop;
    const trackHeight = track.clientHeight;
    const travel = Math.max(1, trackHeight - thumb.offsetHeight);
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const onMove = (moveEvent) => {
      scroller.scrollTop = startScroll + (moveEvent.clientY - startY) * (maxScroll / travel);
    };
    const onEnd = () => {
      thumb.classList.remove('dragging');
      document.body.classList.remove('scrollbar-dragging');
      thumb.removeEventListener('pointermove', onMove);
      thumb.removeEventListener('pointerup', onEnd);
      thumb.removeEventListener('pointercancel', onEnd);
    };
    thumb.addEventListener('pointermove', onMove);
    thumb.addEventListener('pointerup', onEnd);
    thumb.addEventListener('pointercancel', onEnd);
  });

  track.addEventListener('pointerdown', (event) => {
    if (event.target !== track || event.button !== 0) return;
    event.preventDefault();
    const ratio = Math.min(1, Math.max(0, event.offsetY / track.clientHeight));
    scroller.scrollTop = ratio * (scroller.scrollHeight - scroller.clientHeight) - scroller.clientHeight / 2;
  });
  scroller.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(scroller);
  new MutationObserver(update).observe(scroller, { childList: true, subtree: true });
  window.addEventListener('resize', update, { passive: true });
  const api = { update };
  customScrollbars.push(api);
  update();
  return api;
}

function initCustomScrollbars() {
  [dom.tree, dom.galleryScroll, dom.preview].forEach(initCustomScrollbar);
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

function normalizeComparablePath(value) {
  return String(value || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

function isPathWithinDirectory(candidatePath, directoryPath) {
  const candidate = normalizeComparablePath(candidatePath);
  const directory = normalizeComparablePath(directoryPath);
  return candidate === directory || candidate.startsWith(`${directory}\\`);
}

function rootForPath(candidatePath) {
  return state.roots
    .filter((root) => isPathWithinDirectory(candidatePath, root.path))
    .sort((left, right) => right.path.length - left.path.length)[0] || null;
}

function isLibraryRootPath(candidatePath) {
  return state.roots.some((root) => normalizeComparablePath(root.path) === normalizeComparablePath(candidatePath));
}

function updateRootTitle() {
  dom.rootTitle.textContent = state.roots.length > 1 ? `Папки · ${state.roots.length}` : (state.roots[0]?.name || 'Папки');
}

function replacePathPrefix(candidatePath, oldPath, newPath) {
  if (!isPathWithinDirectory(candidatePath, oldPath)) return candidatePath;
  return newPath + candidatePath.slice(oldPath.length);
}

function isTextFile(item) {
  return item?.kind === 'file' && /\.(txt|md)$/i.test(item.name || '');
}

function isExternalFileDrag(event) {
  return !state.draggedItem && Array.from(event.dataTransfer?.types || []).includes('Files');
}

function clearExternalDropTargets() {
  dom.galleryScroll.classList.remove('external-drop-target');
  dom.tree.classList.remove('external-drop-target');
  document.querySelectorAll('.tree-row.external-drop-target').forEach((row) => row.classList.remove('external-drop-target'));
}

function droppedFilePaths(fileList) {
  return Array.from(fileList || [], (file) => window.lumina.getDroppedFilePath(file)).filter(Boolean);
}

function setGalleryView(view) {
  dom.emptyState.classList.toggle('hidden', view !== 'welcome');
  dom.loadingState.classList.toggle('hidden', view !== 'loading');
  dom.grid.classList.toggle('hidden', view !== 'grid');
  dom.folderEmpty.classList.toggle('hidden', view !== 'empty');
}

async function openFolder() {
  try {
    const roots = await window.lumina.chooseFolder();
    if (!roots?.length) return;
    const previousPaths = new Set(state.roots.map((root) => normalizeComparablePath(root.path)));
    const addedRoots = roots.filter((root) => !previousPaths.has(normalizeComparablePath(root.path)));
    const firstOpen = state.roots.length === 0;
    state.roots = roots;
    if (firstOpen || !state.currentDirectory) {
      state.root = addedRoots[0] || roots[0];
      state.currentDirectory = state.root.path;
      state.selected = null;
      state.selectedPaths = new Set();
      state.selectionAnchorPath = null;
      state.media = [];
      state.allMedia = [];
      state.preparedPaths = new Set();
      state.warmedPaths = new Set();
      renderEmptyPreview();
    } else {
      state.root = rootForPath(state.currentDirectory) || roots[0];
    }
    updateRootTitle();
    await renderTree();
    await loadMedia({ prepareRoots: true });
    if (!firstOpen && addedRoots.length) {
      showToast(addedRoots.length === 1
        ? `Папка «${addedRoots[0].name}» добавлена`
        : `Добавлено папок: ${addedRoots.length}`);
    }
  } catch (error) {
    showToast(`Не удалось добавить папку: ${formatError(error)}`, 'error');
  }
}

function expandedTreePaths() {
  return new Set([...dom.tree.querySelectorAll('.tree-node')]
    .filter((node) => !node.querySelector(':scope > .tree-children')?.classList.contains('hidden'))
    .map((node) => normalizeComparablePath(node.dataset.path)));
}

async function restoreExpandedTreeNodes(container, paths) {
  const nodes = [...container.querySelectorAll(':scope > .tree-node')];
  for (const node of nodes) {
    if (!paths.has(normalizeComparablePath(node.dataset.path))) continue;
    const row = node.querySelector(':scope > .tree-row');
    const children = node.querySelector(':scope > .tree-children');
    const chevron = row?.querySelector('.tree-chevron');
    if (!row || !children || !chevron) continue;
    children.classList.remove('hidden');
    const depth = Number(row.style.getPropertyValue('--depth')) || 0;
    await expandTreeNode({ path: node.dataset.path, kind: 'directory' }, chevron, children, depth + 1);
    await restoreExpandedTreeNodes(children, paths);
  }
}

async function renderTree() {
  if (!state.roots.length) return;
  const hadTree = Boolean(dom.tree.querySelector('.tree-node'));
  const pathsToRestore = hadTree
    ? expandedTreePaths()
    : new Set(state.roots.map((root) => normalizeComparablePath(root.path)));
  dom.tree.replaceChildren();
  const fragment = document.createDocumentFragment();
  const favorites = createFavoritesSection();
  if (favorites) fragment.append(favorites);
  const rootNodes = state.roots.map((root) => {
    const rootNode = createTreeNode(root, 0, pathsToRestore.has(normalizeComparablePath(root.path)));
    rootNode.classList.add('library-root-node');
    fragment.append(rootNode);
    return { root, rootNode };
  });
  dom.tree.append(fragment);
  await Promise.all(rootNodes
    .filter(({ root }) => pathsToRestore.has(normalizeComparablePath(root.path)))
    .map(({ root, rootNode }) => expandTreeNode(
      root,
      rootNode.querySelector('.tree-chevron'),
      rootNode.querySelector('.tree-children'),
      1
    )));
  for (const { rootNode } of rootNodes) {
    await restoreExpandedTreeNodes(rootNode.querySelector(':scope > .tree-children'), pathsToRestore);
  }
  updateSelectionClasses();
}

function createFavoritesSection() {
  const favorites = state.favoriteItems.filter((item) => rootForPath(item.path));
  if (!favorites.length) return null;
  const section = document.createElement('section');
  section.className = 'tree-favorites';
  const heading = document.createElement('div');
  heading.className = 'tree-favorites-heading';
  heading.innerHTML = `${ICONS.star}<span>Избранное</span>`;
  const list = document.createElement('div');
  list.className = 'tree-favorites-list';
  list.append(...favorites.map(createFavoriteRow));
  section.append(heading, list);
  return section;
}

function createFavoriteRow(entry) {
  const row = document.createElement('div');
  row.className = 'tree-row favorite-row';
  row.dataset.rowPath = entry.path;
  row.dataset.kind = entry.kind;
  row.title = entry.path;
  const icon = document.createElement('span');
  icon.className = 'tree-icon';
  icon.innerHTML = isTextFile(entry) ? ICONS.text : (ICONS[entry.kind] || ICONS.file);
  const name = document.createElement('span');
  name.className = 'tree-name';
  name.textContent = entry.name;
  row.append(icon, name, createFavoriteToggle(entry));
  bindEntryDrag(row, entry);
  if (entry.kind === 'directory') bindSimpleDirectoryDrop(row, entry.path);
  row.addEventListener('click', () => entry.kind === 'directory' ? selectDirectory(entry.path) : selectMedia(entry));
  row.addEventListener('contextmenu', (event) => showFileContextMenu(event, entry));
  return row;
}

function renderFavoritesSection() {
  dom.tree.querySelector('.tree-favorites')?.remove();
  const section = createFavoritesSection();
  if (section) dom.tree.prepend(section);
  document.querySelectorAll('.tree-favorite-toggle').forEach((button) => {
    updateFavoriteToggle(button, button.dataset.favoritePath);
  });
  updateSelectionClasses();
  updateCustomScrollbars();
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
  row.classList.toggle('text-file-row', isTextFile(entry));
  row.title = entry.path;
  bindEntryDrag(row, entry);

  const chevron = document.createElement('button');
  chevron.className = `tree-chevron ${entry.kind === 'directory' ? '' : 'spacer'}`;
  chevron.innerHTML = ICONS.chevron;
  chevron.tabIndex = entry.kind === 'directory' ? 0 : -1;
  chevron.setAttribute('aria-label', entry.kind === 'directory' ? 'Развернуть папку' : '');

  const icon = document.createElement('span');
  icon.className = 'tree-icon';
  icon.innerHTML = isTextFile(entry) ? ICONS.text : (ICONS[entry.kind] || ICONS.image);

  const name = document.createElement('span');
  name.className = 'tree-name';
  name.textContent = entry.name;

  row.append(chevron, icon, name, createFavoriteToggle(entry));
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
    const clearDragExpand = () => {
      clearTimeout(row.dragExpandTimer);
      row.dragExpandTimer = null;
    };
    row.addEventListener('dragenter', (event) => {
      if ((!state.draggedItem && !isExternalFileDrag(event)) || state.moveInProgress) return;
      event.preventDefault();
      row.classList.add(state.draggedItem ? 'drop-target' : 'external-drop-target');
      clearDragExpand();
    });
    row.addEventListener('dragover', (event) => {
      if ((!state.draggedItem && !isExternalFileDrag(event)) || state.moveInProgress) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      row.classList.add(state.draggedItem ? 'drop-target' : 'external-drop-target');
    });
    row.addEventListener('dragleave', (event) => {
      if (row.contains(event.relatedTarget)) return;
      clearDragExpand();
      row.classList.remove('drop-target', 'external-drop-target');
    });
    row.addEventListener('drop', (event) => {
      const externalPaths = isExternalFileDrag(event) ? droppedFilePaths(event.dataTransfer.files) : [];
      if ((!state.draggedItem && !externalPaths.length) || state.moveInProgress) return;
      event.preventDefault();
      event.stopPropagation();
      clearDragExpand();
      if (state.draggedItem) {
        const items = state.draggedItems.length ? [...state.draggedItems] : [state.draggedItem];
        resetFileDragState();
        void moveItemsToDirectory(items, entry.path);
      } else {
        clearExternalDropTargets();
        void importExternalFilesToDirectory(externalPaths, entry.path);
      }
    });
  } else {
    row.addEventListener('click', () => selectMedia(entry));
  }
  row.addEventListener('contextmenu', (event) => showFileContextMenu(event, entry));
  return node;
}

function selectedMediaItems() {
  return state.media.filter((item) => state.selectedPaths.has(item.path));
}

function bindEntryDrag(element, entry) {
  const isRoot = isLibraryRootPath(entry.path);
  element.draggable = !isRoot;
  if (isRoot) return;
  element.addEventListener('dragstart', (event) => {
    if (event.target.closest('button') || state.moveInProgress) {
      event.preventDefault();
      return;
    }
    const selected = state.selectedPaths.has(entry.path) ? selectedMediaItems() : [];
    const items = selected.length ? selected : [entry];
    state.draggedItems = items;
    state.draggedItem = items[0];
    element.classList.add('dragging');
    document.body.classList.add('file-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-lumina-paths', JSON.stringify(items.map((item) => item.path)));
    event.dataTransfer.setData('text/plain', items.map((item) => item.path).join('\n'));
  });
  element.addEventListener('dragend', resetFileDragState);
}

function bindSimpleDirectoryDrop(row, destinationPath) {
  row.addEventListener('dragenter', (event) => {
    if ((!state.draggedItem && !isExternalFileDrag(event)) || state.moveInProgress) return;
    event.preventDefault();
    row.classList.add(state.draggedItem ? 'drop-target' : 'external-drop-target');
  });
  row.addEventListener('dragover', (event) => {
    if ((!state.draggedItem && !isExternalFileDrag(event)) || state.moveInProgress) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  });
  row.addEventListener('dragleave', (event) => {
    if (!row.contains(event.relatedTarget)) row.classList.remove('drop-target', 'external-drop-target');
  });
  row.addEventListener('drop', (event) => {
    const externalPaths = isExternalFileDrag(event) ? droppedFilePaths(event.dataTransfer.files) : [];
    if ((!state.draggedItem && !externalPaths.length) || state.moveInProgress) return;
    event.preventDefault();
    event.stopPropagation();
    if (state.draggedItem) {
      const items = state.draggedItems.length ? [...state.draggedItems] : [state.draggedItem];
      resetFileDragState();
      void moveItemsToDirectory(items, destinationPath);
    } else {
      clearExternalDropTargets();
      void importExternalFilesToDirectory(externalPaths, destinationPath);
    }
  });
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

function resetFileDragState() {
  state.draggedItem = null;
  state.draggedItems = [];
  document.body.classList.remove('file-dragging');
  document.querySelectorAll('.tree-row.drop-target').forEach((row) => {
    clearTimeout(row.dragExpandTimer);
    row.dragExpandTimer = null;
    row.classList.remove('drop-target');
  });
  document.querySelectorAll('.media-card.dragging').forEach((card) => card.classList.remove('dragging'));
  document.querySelectorAll('.tree-row.dragging').forEach((row) => row.classList.remove('dragging'));
}

async function importExternalFilesToDirectory(sourcePaths, destinationPath) {
  if (!sourcePaths.length || !destinationPath || state.moveInProgress) return;
  state.moveInProgress = true;
  try {
    const result = await window.lumina.importExternalFiles(sourcePaths, destinationPath);
    await refreshTreeDirectory(destinationPath);
    const destinationVisible = state.recursive
      ? isPathWithinDirectory(destinationPath, state.currentDirectory)
      : normalizeComparablePath(destinationPath) === normalizeComparablePath(state.currentDirectory);
    if (destinationVisible) await loadMedia({ quiet: true });

    if (result.imported.length) {
      showToast(result.imported.length === 1
        ? `«${result.imported[0].name}» перемещён в «${destinationPath.split(/[\\/]/).pop()}»`
        : `${result.imported.length} файлов перемещено в «${destinationPath.split(/[\\/]/).pop()}»`);
    }
    if (result.errors.length) {
      const firstError = result.errors[0];
      const suffix = result.errors.length > 1 ? ` Ещё ошибок: ${result.errors.length - 1}.` : '';
      showToast(`Не удалось переместить «${firstError.name}»: ${firstError.message}.${suffix}`, 'error');
    }
  } catch (error) {
    showToast(`Не удалось переместить файл из Проводника: ${formatError(error)}`, 'error');
  } finally {
    state.moveInProgress = false;
    clearExternalDropTargets();
  }
}

async function refreshTreeAfterMove(sourcePath, destinationPath) {
  const sourceNode = [...dom.tree.querySelectorAll('.tree-node')]
    .find((node) => normalizeComparablePath(node.dataset.path) === normalizeComparablePath(sourcePath));
  sourceNode?.remove();

  const destinationNode = [...dom.tree.querySelectorAll('.tree-node')]
    .find((node) => normalizeComparablePath(node.dataset.path) === normalizeComparablePath(destinationPath));
  if (!destinationNode) return;
  const children = destinationNode.querySelector(':scope > .tree-children');
  if (!children || children.dataset.loaded !== 'true') return;
  const row = destinationNode.querySelector(':scope > .tree-row');
  const chevron = row?.querySelector('.tree-chevron');
  if (!row || !chevron) return;
  const depth = Number(row.style.getPropertyValue('--depth')) || 0;
  delete children.dataset.loaded;
  children.replaceChildren();
  await expandTreeNode({ path: destinationPath, kind: 'directory' }, chevron, children, depth + 1);
}

async function refreshTreeDirectory(directoryPath) {
  const directoryNode = [...dom.tree.querySelectorAll('.tree-node')]
    .find((node) => normalizeComparablePath(node.dataset.path) === normalizeComparablePath(directoryPath));
  if (!directoryNode) return;
  const children = directoryNode.querySelector(':scope > .tree-children');
  const row = directoryNode.querySelector(':scope > .tree-row');
  const chevron = row?.querySelector('.tree-chevron');
  if (!children || !row || !chevron || children.dataset.loaded !== 'true') return;
  const depth = Number(row.style.getPropertyValue('--depth')) || 0;
  delete children.dataset.loaded;
  children.replaceChildren();
  await expandTreeNode({ path: directoryPath, kind: 'directory' }, chevron, children, depth + 1);
  updateSelectionClasses();
}

function itemWithPath(item, nextPath) {
  const kind = item.kind;
  return {
    ...item,
    name: nextPath.split(/[\\/]/).pop(),
    path: nextPath,
    directory: parentPath(nextPath),
    url: kind === 'directory' ? null : `lumina-media://asset/?path=${encodeURIComponent(nextPath)}`,
    thumbnailUrl: kind === 'image' || kind === 'video' || kind === 'audio'
      ? `lumina-media://thumb/?path=${encodeURIComponent(nextPath)}`
      : null,
    previewUrl: kind === 'video' ? `lumina-media://preview/?path=${encodeURIComponent(nextPath)}` : null
  };
}

function remapTrackedItems(oldPath, newPath, exactItem) {
  const remap = (entry) => {
    if (!isPathWithinDirectory(entry.path, oldPath)) return entry;
    const nextEntryPath = replacePathPrefix(entry.path, oldPath, newPath);
    return entry.path === oldPath && exactItem ? exactItem : itemWithPath(entry, nextEntryPath);
  };
  state.previewHistory = state.previewHistory.map(remap);
  state.favoriteItems = state.favoriteItems.map(remap);
  persistFavorites();
}

async function moveItemsToDirectory(items, destinationPath) {
  const uniqueItems = [...new Map((items || []).filter(Boolean).map((item) => [item.path, item])).values()];
  if (!uniqueItems.length || state.moveInProgress || !state.currentDirectory) return;
  state.moveInProgress = true;
  const moved = [];
  const errors = [];
  try {
    for (const item of uniqueItems) {
      try {
        const result = await window.lumina.moveItem(item.path, destinationPath, state.currentDirectory);
        if (result.moved) moved.push({ item, next: result.item });
      } catch (error) {
        errors.push({ item, error });
      }
    }
    if (!moved.length && !errors.length) {
      showToast('Все выбранные элементы уже находятся в этой папке');
      return;
    }

    const movedByOldPath = new Map();
    for (const { item, next } of moved) {
      movedByOldPath.set(item.path, next);
      state.preparedPaths.delete(item.path);
      state.warmedPaths.delete(item.path);
      remapTrackedItems(item.path, next.path, next);
      if (item.kind === 'directory' && isPathWithinDirectory(state.currentDirectory, item.path)) {
        state.currentDirectory = replacePathPrefix(state.currentDirectory, item.path, next.path);
        state.root = rootForPath(state.currentDirectory) || state.root;
      }
    }

    state.selectedPaths = new Set([...state.selectedPaths].map((itemPath) => movedByOldPath.get(itemPath)?.path || itemPath));
    const activeNext = state.selected ? movedByOldPath.get(state.selected.path) : null;
    if (activeNext) {
      const remainsVisible = state.recursive
        ? isPathWithinDirectory(activeNext.path, state.currentDirectory)
        : normalizeComparablePath(parentPath(activeNext.path)) === normalizeComparablePath(state.currentDirectory);
      state.selected = remainsVisible ? activeNext : null;
    }

    await renderTree();
    await loadMedia({ quiet: true });
    if (!state.selected) renderEmptyPreview();
    else if (state.previewHistoryEnabled) renderPreviewHistory();
    else renderPreview(state.selected);
    updateSelectionClasses();

    if (moved.length) {
      showToast(moved.length === 1
        ? `«${moved[0].item.name}» перемещён в «${destinationPath.split(/[\\/]/).pop()}»`
        : `${moved.length} элементов перемещено в «${destinationPath.split(/[\\/]/).pop()}»`);
    }
    if (errors.length) showToast(`Не удалось переместить ${errors.length} элементов: ${formatError(errors[0].error)}`, 'error');
  } finally {
    state.moveInProgress = false;
  }
}

async function moveItemToDirectory(item, destinationPath) {
  return moveItemsToDirectory([item], destinationPath);
}

async function selectDirectory(directoryPath) {
  const nextRoot = rootForPath(directoryPath);
  if (nextRoot) state.root = nextRoot;
  if (state.currentDirectory === directoryPath) {
    updateSelectionClasses();
    return;
  }
  state.currentDirectory = directoryPath;
  dom.galleryScroll.scrollTop = 0;
  state.selected = null;
  state.selectedPaths = new Set();
  state.selectionAnchorPath = null;
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
    if (options.quiet && mediaListsEqual(media, state.allMedia)) return;

    let libraryMedia = media;
    let itemsToPrepare = media.filter((item) => !state.preparedPaths.has(item.path));
    if (options.prepareRoots && state.roots.length) {
      dom.loadingLabel.textContent = state.roots.length > 1 ? 'Сканируем все открытые папки…' : 'Сканируем всю медиатеку…';
      const rootMedia = await Promise.all(state.roots.map((root) => window.lumina.getMedia(root.path, true)));
      if (requestId !== state.requestId) return;
      libraryMedia = [...new Map(rootMedia.flat().map((item) => [normalizeComparablePath(item.path), item])).values()];
      itemsToPrepare = libraryMedia.filter((item) => !state.preparedPaths.has(item.path));
    }

    state.allMedia = media;
    const availablePaths = new Set(media.map((item) => item.path));
    state.selectedPaths = new Set([...state.selectedPaths].filter((itemPath) => availablePaths.has(itemPath)));
    if (state.selected && !media.some((item) => item.path === state.selected.path)) {
      removeFromPreviewHistory(state.selected.path);
      state.selected = null;
      renderEmptyPreview();
    }
    applyMediaFilters({ resetScroll: false });

    const backgroundItems = itemsToPrepare.filter((item) => !state.preparingPaths.has(item.path));
    for (const item of backgroundItems) state.preparingPaths.add(item.path);
    if (backgroundItems.length) void prepareMediaInBackground(backgroundItems, requestId);
  } catch (error) {
    if (requestId !== state.requestId) return;
    state.media = [];
    state.allMedia = [];
    setGalleryView('empty');
    dom.mediaSummary.textContent = 'Не удалось прочитать папку';
    showToast(formatError(error), 'error');
  }
}

async function prepareMediaInBackground(items, requestId) {
  try {
    await window.lumina.prepareMedia(
      items.map((item) => ({ path: item.path, kind: item.kind })),
      requestId
    );
    for (const item of items) state.preparedPaths.add(item.path);
    const itemsToWarm = items.filter((item) => !state.warmedPaths.has(item.path));
    await warmMediaCache(itemsToWarm, requestId, true);
    if (requestId === state.requestId) {
      for (const item of itemsToWarm) state.warmedPaths.add(item.path);
    }
  } catch {
    // Cards still load lazily when optional background preparation fails.
  } finally {
    for (const item of items) state.preparingPaths.delete(item.path);
  }
}

function mediaListsEqual(left, right) {
  return left.length === right.length && left.every((item, index) => (
    item.path === right[index]?.path && item.kind === right[index]?.kind
  ));
}

function isAnimatedImage(item) {
  return item?.kind === 'image' && /\.(gif|webp)$/i.test(item.name || '');
}

function isAutoplayMedia(item) {
  return item?.kind === 'video' || isAnimatedImage(item);
}

async function warmMediaCache(items, requestId, quiet) {
  const resources = items.flatMap((item) => (
    item.kind === 'video'
      ? [item.thumbnailUrl, item.previewUrl]
      : isAnimatedImage(item) ? [item.thumbnailUrl, item.url] : [item.thumbnailUrl]
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
        const response = await fetch(resource, { signal: AbortSignal.timeout(15000) });
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
  const imageCount = state.media.filter((item) => item.kind === 'image').length;
  const audioCount = state.media.filter((item) => item.kind === 'audio').length;
  const fileCount = state.media.filter((item) => item.kind === 'file').length;
  dom.playAll.disabled = !state.media.some(isAutoplayMedia);
  const filteredSuffix = state.media.length !== state.allMedia.length ? ` из ${state.allMedia.length}` : '';
  dom.mediaSummary.textContent = `${pluralFiles(state.media.length)}${filteredSuffix} · ${imageCount} фото · ${videoCount} видео · ${audioCount} аудио · прочие: ${fileCount}${state.recursive ? ' · включая подпапки' : ''}`;

  if (!state.media.length) {
    setAutoplay(false);
    const filteredEmpty = state.allMedia.length > 0;
    dom.folderEmptyTitle.textContent = filteredEmpty ? 'Нет файлов выбранных типов' : 'Файлов не найдено';
    dom.folderEmptyCopy.textContent = filteredEmpty
      ? 'Измените фильтры «Фото», «Видео», «Аудио» и «Файлы» в верхней панели.'
      : 'Попробуйте включить «С подпапками» или выбрать другую папку.';
    setGalleryView('empty');
    return;
  }

  setGalleryView('grid');
  state.virtual.start = -1;
  state.virtual.end = -1;
  requestAnimationFrame(() => layoutVirtualGrid(true));
}

function syncMediaFilters() {
  for (const button of dom.mediaFilters) {
    const active = state.mediaFilters.has(button.dataset.kind);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function applyMediaFilters(options = {}) {
  state.media = state.allMedia.filter((item) => state.mediaFilters.has(item.kind));
  if (options.resetScroll !== false) dom.galleryScroll.scrollTop = 0;
  syncMediaFilters();
  renderGallery();
}

function toggleMediaFilter(kind) {
  if (!MEDIA_KINDS.includes(kind)) return;
  if (state.mediaFilters.has(kind)) {
    if (state.mediaFilters.size === 1) {
      showToast('Должен быть включён хотя бы один тип файлов', 'error');
      return;
    }
    state.mediaFilters.delete(kind);
  } else {
    state.mediaFilters.add(kind);
  }
  localStorage.setItem('lumina:media-filters', JSON.stringify(MEDIA_KINDS.filter((item) => state.mediaFilters.has(item))));
  applyMediaFilters();
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
  if (state.selectedPaths.has(item.path)) card.classList.add('selected');
  card.tabIndex = 0;
  card.draggable = true;
  card.title = item.path;
  const textFile = isTextFile(item);
  if (textFile) card.classList.add('text-file-card');
  bindEntryDrag(card, item);

  const frame = document.createElement('div');
  frame.className = 'media-frame';
  let mediaElement;
  const animatedImage = isAnimatedImage(item);
  const useThumbnail = (item.kind !== 'video' && !animatedImage) || !state.autoplay;
  if (item.kind === 'audio') {
    mediaElement = document.createElement('div');
    mediaElement.className = 'audio-card-visual';
    mediaElement.innerHTML = `<span class="audio-card-icon">${ICONS.audio}</span><span class="audio-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>`;
    if (item.thumbnailUrl) {
      const cover = document.createElement('img');
      cover.className = 'audio-cover';
      cover.src = item.thumbnailUrl;
      cover.alt = '';
      cover.loading = 'lazy';
      cover.decoding = 'async';
      cover.addEventListener('load', () => {
        mediaElement.classList.add('has-cover');
        card.classList.remove('loading-media');
      }, { once: true });
      cover.addEventListener('error', () => {
        cover.remove();
        card.classList.remove('loading-media');
      }, { once: true });
      mediaElement.prepend(cover);
    } else {
      card.classList.remove('loading-media');
    }
  } else if (textFile) {
    mediaElement = document.createElement('div');
    mediaElement.className = 'text-card-visual';
    const textType = /\.md$/i.test(item.name) ? 'MD' : 'TXT';
    mediaElement.innerHTML = `
      <span class="text-card-sheet">
        <span class="text-card-type">${textType}</span>
        <i></i><i></i><i></i><i></i>
      </span>`;
    card.classList.remove('loading-media');
  } else if (item.kind === 'file') {
    mediaElement = document.createElement('div');
    mediaElement.className = 'file-card-visual';
    mediaElement.innerHTML = `<span class="file-card-icon">${ICONS.file}</span>`;
    card.classList.remove('loading-media');
  } else if (useThumbnail) {
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
  } else if (animatedImage) {
    mediaElement = document.createElement('img');
    mediaElement.src = item.url;
    mediaElement.alt = item.name;
    mediaElement.decoding = 'async';
    mediaElement.addEventListener('load', () => card.classList.remove('loading-media'), { once: true });
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
  const badgeIcon = textFile ? ICONS.text : ICONS[item.kind];
  const badgeLabel = textFile ? (/\.md$/i.test(item.name) ? 'Markdown' : 'Текст') : MEDIA_LABELS[item.kind];
  badge.innerHTML = `${badgeIcon}<span>${badgeLabel}</span>`;

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
  location.textContent = state.recursive && item.relativeDirectory !== '.'
    ? item.relativeDirectory
    : (textFile ? 'Редактируемый текст' : MEDIA_LABELS[item.kind]);
  caption.append(name, location);
  card.append(frame, caption);

  card.addEventListener('click', (event) => selectMediaWithModifiers(item, event));
  card.addEventListener('contextmenu', (event) => showFileContextMenu(event, item));
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

function selectMedia(item, options = {}) {
  state.selectedPaths = new Set([item.path]);
  state.selectionAnchorPath = item.path;
  setActiveMedia(item, options);
}

function setActiveMedia(item, options = {}, recordHistory = true) {
  state.selected = item;
  updateSelectionClasses();
  if (state.previewHistoryEnabled) {
    if (recordHistory) {
      state.previewHistory = [item, ...state.previewHistory.filter((entry) => entry.path !== item.path)]
        .slice(0, MAX_PREVIEW_HISTORY);
    }
    renderPreviewHistory(options);
  } else {
    renderPreview(item, options);
  }
}

function selectMediaWithModifiers(item, event) {
  if (!event.shiftKey && !event.ctrlKey) {
    selectMedia(item);
    return;
  }

  if (event.shiftKey) {
    const anchorIndex = state.media.findIndex((entry) => entry.path === state.selectionAnchorPath);
    const itemIndex = state.media.findIndex((entry) => entry.path === item.path);
    if (anchorIndex < 0 || itemIndex < 0) {
      selectMedia(item);
      return;
    }
    const start = Math.min(anchorIndex, itemIndex);
    const end = Math.max(anchorIndex, itemIndex);
    const rangePaths = state.media.slice(start, end + 1).map((entry) => entry.path);
    state.selectedPaths = new Set([...state.selectedPaths, ...rangePaths]);
    setActiveMedia(item);
    return;
  }

  state.selectionAnchorPath = item.path;
  if (state.selectedPaths.has(item.path)) {
    state.selectedPaths.delete(item.path);
    const nextItem = [...state.media].reverse().find((entry) => state.selectedPaths.has(entry.path)) || null;
    state.selected = nextItem;
    updateSelectionClasses();
    if (nextItem) setActiveMedia(nextItem, {}, false);
    else renderEmptyPreview();
  } else {
    state.selectedPaths.add(item.path);
    setActiveMedia(item);
  }
}

function updateSelectionClasses() {
  document.querySelectorAll('.media-card').forEach((card) => {
    card.classList.toggle('selected', state.selectedPaths.has(card.dataset.path));
  });
  document.querySelectorAll('.tree-row').forEach((row) => {
    const rowPath = row.dataset.rowPath;
    row.classList.toggle('selected', state.selectedPaths.has(rowPath)
      || (!state.selectedPaths.size && rowPath === state.currentDirectory));
  });
}

function renderEmptyPreview() {
  if (state.previewHistoryEnabled && state.previewHistory.length) {
    renderPreviewHistory();
    updateSelectionClasses();
    return;
  }
  dom.preview.classList.remove('history-mode');
  dom.preview.replaceChildren();
  const placeholder = document.createElement('div');
  placeholder.className = 'panel-placeholder';
  placeholder.innerHTML = `
    <div class="placeholder-icon eye">
      <svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
    </div>
    <p>Выберите файл<br>для предпросмотра</p>`;
  dom.preview.append(placeholder);
  updateSelectionClasses();
}

function createHistoryPreviewItem(item, index, options = {}) {
  const entry = document.createElement('article');
  entry.className = `preview-history-item${index === 0 ? ' current' : ''}`;
  entry.dataset.path = item.path;

  const stage = document.createElement('div');
  stage.className = 'preview-history-stage';
  if (item.kind === 'image') {
    const image = document.createElement('img');
    image.src = item.url;
    image.alt = item.name;
    image.loading = index === 0 ? 'eager' : 'lazy';
    image.decoding = 'async';
    stage.append(image);
  } else if (item.kind === 'video') {
    const video = document.createElement('video');
    video.src = item.url;
    video.poster = item.thumbnailUrl || '';
    video.controls = true;
    video.loop = state.loopVideoPaths.has(item.path);
    video.preload = index === 0 ? 'metadata' : 'none';
    if (index === 0) video.addEventListener('ended', () => playNextInQueue(item));
    stage.append(video);
    if (index === 0 && options.autoplay) video.play().catch(() => {});
  } else if (item.kind === 'audio') {
    stage.classList.add('audio-history-stage');
    const artwork = document.createElement('div');
    artwork.className = 'history-audio-art';
    artwork.innerHTML = ICONS.audio;
    if (item.thumbnailUrl) {
      const cover = document.createElement('img');
      cover.src = item.thumbnailUrl;
      cover.alt = '';
      cover.loading = index === 0 ? 'eager' : 'lazy';
      cover.addEventListener('error', () => cover.remove(), { once: true });
      artwork.append(cover);
    }
    const audio = document.createElement('audio');
    audio.src = item.url;
    audio.controls = true;
    audio.preload = index === 0 ? 'metadata' : 'none';
    if (index === 0) audio.addEventListener('ended', () => playNextInQueue(item));
    stage.append(artwork, audio);
    if (index === 0 && options.autoplay) audio.play().catch(() => {});
  } else {
    stage.classList.add('file-history-stage');
    const artwork = document.createElement('div');
    artwork.className = `history-file-art${isTextFile(item) ? ' text' : ''}`;
    const label = isTextFile(item) ? (/\.md$/i.test(item.name) ? 'MD' : 'TXT') : 'Файл';
    artwork.innerHTML = `${isTextFile(item) ? ICONS.text : ICONS.file}<span>${label}</span>`;
    stage.append(artwork);
  }

  const name = document.createElement('h3');
  name.className = 'preview-history-name';
  name.textContent = item.name;
  entry.append(stage, name);
  entry.addEventListener('contextmenu', (event) => showFileContextMenu(event, item));
  return entry;
}

function renderPreviewHistory(options = {}) {
  dom.preview.classList.add('history-mode');
  const list = document.createElement('div');
  list.className = 'preview-history-list';
  if (!state.previewHistory.length) {
    const placeholder = document.createElement('div');
    placeholder.className = 'panel-placeholder';
    placeholder.innerHTML = `
      <div class="placeholder-icon eye">
        <svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
      </div>
      <p>Выбирайте файлы — новые будут появляться сверху</p>`;
    list.append(placeholder);
  } else {
    list.append(...state.previewHistory.map((item, index) => createHistoryPreviewItem(item, index, options)));
  }
  dom.preview.replaceChildren(list);
}

function removeFromPreviewHistory(itemPath) {
  const previousLength = state.previewHistory.length;
  state.previewHistory = state.previewHistory.filter((entry) => !isPathWithinDirectory(entry.path, itemPath));
  if (state.previewHistoryEnabled && state.previewHistory.length !== previousLength) renderPreviewHistory();
}

function replacePreviewHistoryItem(oldPath, nextItem) {
  state.previewHistory = state.previewHistory.map((entry) => entry.path === oldPath ? nextItem : entry);
  if (state.previewHistoryEnabled) renderPreviewHistory();
}

function playNextInQueue(item) {
  if (!state.queueAutoplay) return;
  const queue = state.media.filter((entry) => entry.kind === 'video' || entry.kind === 'audio');
  const currentIndex = queue.findIndex((entry) => entry.path === item.path);
  if (currentIndex < 0 || currentIndex >= queue.length - 1) return;
  const next = queue[currentIndex + 1];
  selectMedia(next, { autoplay: true });
  const galleryIndex = state.media.findIndex((entry) => entry.path === next.path);
  if (galleryIndex >= 0) scrollToMediaIndex(galleryIndex);
}

async function renderPreview(item, options = {}) {
  dom.preview.classList.remove('history-mode');
  const active = document.createElement('div');
  active.className = 'preview-active';

  const stage = document.createElement('div');
  stage.className = 'preview-stage';
  let mediaElement;
  if (item.kind === 'image') {
    mediaElement = document.createElement('img');
    mediaElement.src = item.url;
    mediaElement.alt = item.name;
  } else if (item.kind === 'video') {
    mediaElement = document.createElement('video');
    mediaElement.src = item.url;
    mediaElement.controls = true;
    mediaElement.loop = state.loopVideoPaths.has(item.path);
    mediaElement.preload = 'metadata';
    mediaElement.addEventListener('ended', () => playNextInQueue(item));
  } else if (item.kind === 'audio') {
    stage.classList.add('audio-preview-stage');
    const artwork = document.createElement('div');
    artwork.className = 'audio-preview-art';
    artwork.innerHTML = `${ICONS.audio}<span>Аудио</span>`;
    if (item.thumbnailUrl) {
      const cover = document.createElement('img');
      cover.className = 'audio-preview-cover';
      cover.src = item.thumbnailUrl;
      cover.alt = '';
      cover.addEventListener('load', () => artwork.classList.add('has-cover'), { once: true });
      cover.addEventListener('error', () => cover.remove(), { once: true });
      artwork.prepend(cover);
    }
    mediaElement = document.createElement('audio');
    mediaElement.src = item.url;
    mediaElement.controls = true;
    mediaElement.preload = 'metadata';
    mediaElement.addEventListener('ended', () => playNextInQueue(item));
    stage.append(artwork);
  } else if (isTextFile(item)) {
    stage.classList.add('text-editor-stage');
    const editor = document.createElement('textarea');
    editor.className = 'text-editor';
    editor.placeholder = 'Загрузка текста…';
    editor.setAttribute('aria-label', `Редактор файла ${item.name}`);
    editor.disabled = true;
    editor.addEventListener('contextmenu', (event) => event.stopPropagation());
    const editorFooter = document.createElement('div');
    editorFooter.className = 'text-editor-footer';
    const editorStatus = document.createElement('span');
    editorStatus.className = 'text-editor-status';
    editorStatus.textContent = 'Загрузка…';
    const editorButtons = document.createElement('div');
    editorButtons.className = 'text-editor-buttons';
    const discardText = document.createElement('button');
    discardText.className = 'button ghost';
    discardText.type = 'button';
    discardText.textContent = 'Отменить изменения';
    discardText.disabled = true;
    const saveText = document.createElement('button');
    saveText.className = 'button primary';
    saveText.type = 'button';
    saveText.textContent = 'Сохранить';
    saveText.disabled = true;
    editorButtons.append(discardText, saveText);
    editorFooter.append(editorStatus, editorButtons);
    stage.append(editor, editorFooter);
    mediaElement = { editor, editorStatus, discardText, saveText, originalText: '' };
  } else {
    stage.classList.add('file-preview-stage');
    const artwork = document.createElement('div');
    artwork.className = 'file-preview-art';
    artwork.innerHTML = `${ICONS.file}<span>Файл</span>`;
    stage.append(artwork);
  }
  if (mediaElement instanceof HTMLMediaElement || mediaElement instanceof HTMLImageElement) stage.append(mediaElement);

  const details = document.createElement('div');
  details.className = 'preview-details';
  const title = document.createElement('h3');
  title.className = 'preview-name';
  title.textContent = item.name;
  const kind = document.createElement('span');
  kind.className = 'preview-kind';
  kind.textContent = isTextFile(item)
    ? (/\.md$/i.test(item.name) ? 'Markdown · MD' : 'Текст · TXT')
    : MEDIA_LABELS[item.kind];

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
  active.addEventListener('contextmenu', (event) => showFileContextMenu(event, item));
  dom.preview.replaceChildren(active);
  if (isTextFile(item)) {
    const textEditor = mediaElement;
    const setEditorState = () => {
      const dirty = textEditor.editor.value !== textEditor.originalText;
      textEditor.saveText.disabled = !dirty;
      textEditor.discardText.disabled = !dirty;
      textEditor.editorStatus.textContent = dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены';
      textEditor.editorStatus.classList.toggle('dirty', dirty);
    };
    const saveEditor = async () => {
      if (textEditor.saveText.disabled) return;
      textEditor.saveText.disabled = true;
      textEditor.discardText.disabled = true;
      textEditor.editorStatus.textContent = 'Сохранение…';
      try {
        const result = await window.lumina.writeTextFile(item.path, textEditor.editor.value);
        if (!textEditor.editor.isConnected || state.selected?.path !== item.path) return;
        textEditor.originalText = textEditor.editor.value;
        size.value.textContent = formatBytes(result.size);
        modified.value.textContent = formatDate(result.modifiedAt);
        setEditorState();
        showToast('Изменения сохранены');
      } catch (error) {
        if (textEditor.editor.isConnected) setEditorState();
        showToast(`Не удалось сохранить файл: ${formatError(error)}`, 'error');
      }
    };
    textEditor.editor.addEventListener('input', setEditorState);
    textEditor.editor.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveEditor();
      }
    });
    textEditor.discardText.addEventListener('click', () => {
      textEditor.editor.value = textEditor.originalText;
      setEditorState();
      textEditor.editor.focus();
    });
    textEditor.saveText.addEventListener('click', () => void saveEditor());
    try {
      const result = await window.lumina.readTextFile(item.path);
      if (!textEditor.editor.isConnected || state.selected?.path !== item.path) return;
      textEditor.originalText = result.text;
      textEditor.editor.value = result.text;
      textEditor.editor.disabled = false;
      textEditor.editor.placeholder = '';
      size.value.textContent = formatBytes(result.size);
      modified.value.textContent = formatDate(result.modifiedAt);
      setEditorState();
    } catch (error) {
      textEditor.editorStatus.textContent = 'Не удалось открыть файл';
      textEditor.editor.placeholder = formatError(error);
      showToast(`Не удалось открыть текст: ${formatError(error)}`, 'error');
    }
  }
  if (options.autoplay && mediaElement instanceof HTMLMediaElement) {
    mediaElement.play().catch(() => {});
  }

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

async function openInDefaultApp(item) {
  if (!item) return;
  try {
    await window.lumina.openItem(item.path);
  } catch (error) {
    showToast(`Не удалось открыть файл: ${formatError(error)}`, 'error');
  }
}

function hideFileContextMenu() {
  dom.contextMenu.classList.add('hidden');
  state.contextItem = null;
}

function showFileContextMenu(event, item) {
  event.preventDefault();
  event.stopPropagation();
  hideFileContextMenu();
  if (event.ctrlKey) {
    void openInDefaultApp(item);
    return;
  }
  state.contextItem = item;
  const isRoot = isLibraryRootPath(item.path);
  dom.contextRename.disabled = isRoot;
  dom.contextDelete.disabled = false;
  dom.contextDetachRoot.classList.toggle('hidden', !isRoot);
  const loops = state.loopVideoPaths.has(item.path);
  dom.contextLoopVideo.classList.toggle('hidden', item.kind !== 'video');
  dom.contextLoopVideo.setAttribute('aria-pressed', String(loops));
  dom.contextLoopVideo.querySelector('span').textContent = loops ? 'Отключить повтор видео' : 'Зациклить видео';
  dom.contextFavorite.querySelector('span').textContent = isFavorite(item.path)
    ? 'Убрать из избранного'
    : 'Добавить в избранное';
  dom.contextCreateFolder.querySelector('span').textContent = item.kind === 'directory'
    ? 'Создать папку внутри'
    : 'Создать новую папку';
  dom.contextMenu.classList.remove('hidden');
  const menuWidth = dom.contextMenu.offsetWidth;
  const menuHeight = dom.contextMenu.offsetHeight;
  const left = Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8));
  const top = Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8));
  dom.contextMenu.style.left = `${left}px`;
  dom.contextMenu.style.top = `${top}px`;
  dom.contextOpenDefault.focus();
}

function openNameModal(mode, item) {
  if (!item) return;
  state.nameAction = { mode, item };
  const isRename = mode === 'rename';
  dom.nameTitle.textContent = isRename ? 'Переименовать' : 'Создать новую папку';
  dom.nameDescription.textContent = isRename
    ? `Введите новое имя для «${item.name}».`
    : `Папка будет создана в «${item.kind === 'directory' ? item.name : parentPath(item.path).split(/[\\/]/).pop()}».`;
  dom.nameInput.value = isRename ? item.name : 'Новая папка';
  dom.nameSubmit.textContent = isRename ? 'Переименовать' : 'Создать';
  dom.nameModal.classList.remove('hidden');
  dom.nameInput.focus();
  if (isRename) {
    const extensionIndex = item.kind === 'directory' ? -1 : item.name.lastIndexOf('.');
    dom.nameInput.setSelectionRange(0, extensionIndex > 0 ? extensionIndex : item.name.length);
  } else {
    dom.nameInput.select();
  }
}

function closeNameModal() {
  state.nameAction = null;
  dom.nameModal.classList.add('hidden');
  dom.nameSubmit.disabled = false;
}

async function submitNameAction(event) {
  event.preventDefault();
  const action = state.nameAction;
  if (!action || !dom.nameInput.value.trim()) return;
  dom.nameSubmit.disabled = true;
  try {
    if (action.mode === 'create-folder') {
      const directoryPath = action.item.kind === 'directory' ? action.item.path : parentPath(action.item.path);
      const created = await window.lumina.createFolder(directoryPath, dom.nameInput.value);
      closeNameModal();
      await refreshTreeDirectory(directoryPath);
      showToast(`Папка «${created.name}» создана`);
      return;
    }

    const oldPath = action.item.path;
    const selectedPath = state.selected?.path;
    const selectedPaths = [...state.selectedPaths];
    const result = await window.lumina.renameItem(oldPath, dom.nameInput.value);
    closeNameModal();
    if (!result.renamed) return;
    if (isPathWithinDirectory(state.currentDirectory, oldPath)) {
      state.currentDirectory = replacePathPrefix(state.currentDirectory, oldPath, result.path);
    }
    const nextSelectedPath = selectedPath && isPathWithinDirectory(selectedPath, oldPath)
      ? replacePathPrefix(selectedPath, oldPath, result.path)
      : selectedPath;
    state.selected = null;
    state.selectedPaths = new Set(selectedPaths.map((itemPath) => (
      isPathWithinDirectory(itemPath, oldPath) ? replacePathPrefix(itemPath, oldPath, result.path) : itemPath
    )));
    state.selectionAnchorPath = state.selectionAnchorPath && isPathWithinDirectory(state.selectionAnchorPath, oldPath)
      ? replacePathPrefix(state.selectionAnchorPath, oldPath, result.path)
      : state.selectionAnchorPath;
    remapTrackedItems(oldPath, result.path, {
      ...itemWithPath(action.item, result.path),
      name: result.name,
    });
    state.preparedPaths = new Set();
    state.warmedPaths = new Set();
    await refreshTreeDirectory(parentPath(oldPath));
    await loadMedia();
    const nextSelected = state.allMedia.find((entry) => entry.path === nextSelectedPath);
    if (nextSelected) selectMedia(nextSelected);
    showToast(`Переименовано в «${result.name}»`);
  } catch (error) {
    showToast(`Не удалось выполнить операцию: ${formatError(error)}`, 'error');
    dom.nameSubmit.disabled = false;
    dom.nameInput.focus();
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
  state.autoplay = Boolean(enabled && state.media.some(isAutoplayMedia));
  dom.playAll.classList.toggle('active', state.autoplay);
  dom.playAllLabel.textContent = state.autoplay ? 'Видео/GIF/WebP: вкл.' : 'Видео/GIF/WebP: выкл.';
  if (state.media.length) renderVirtualWindow(true);
}

function actionItemsFor(item) {
  if (!item) return [];
  if (state.selectedPaths.has(item.path)) {
    const selected = selectedMediaItems();
    if (selected.length) return selected;
  }
  return [item];
}

function removeFavoritesWithin(itemPath) {
  const previousLength = state.favoriteItems.length;
  state.favoriteItems = state.favoriteItems.filter((entry) => !isPathWithinDirectory(entry.path, itemPath));
  if (state.favoriteItems.length !== previousLength) persistFavorites();
}

function requestDelete(item) {
  const items = actionItemsFor(item);
  if (!items.length) return;
  const hasRoot = items.some((entry) => isLibraryRootPath(entry.path));
  if (!state.confirmBeforeDelete && !hasRoot) {
    void deleteItems(items);
    return;
  }
  state.pendingDelete = items;
  if (hasRoot) {
    dom.deleteDescription.textContent = `ВНИМАНИЕ: корневая папка «${items[0].name}» и всё её содержимое будут перемещены в Корзину Windows. Это действие требует отдельного подтверждения.`;
  } else if (items.length > 1) {
    dom.deleteDescription.textContent = `${items.length} выбранных файлов будут перемещены в Корзину Windows.`;
  } else {
    dom.deleteDescription.textContent = items[0].kind === 'directory'
      ? `Папка «${items[0].name}» и всё её содержимое будут перемещены в Корзину Windows.`
      : `«${items[0].name}» исчезнет из исходной папки, но его можно будет восстановить из Корзины Windows.`;
  }
  dom.deleteModal.classList.remove('hidden');
  dom.deleteConfirm.focus();
}

function closeDeleteModal() {
  state.pendingDelete = null;
  dom.deleteModal.classList.add('hidden');
}

async function applyRootsAfterRemoval(nextRoots, removedPath, removeFavorites) {
  state.roots = nextRoots;
  state.previewHistory = state.previewHistory.filter((entry) => !isPathWithinDirectory(entry.path, removedPath));
  if (removeFavorites) removeFavoritesWithin(removedPath);
  state.preparedPaths = new Set([...state.preparedPaths].filter((itemPath) => !isPathWithinDirectory(itemPath, removedPath)));
  state.warmedPaths = new Set([...state.warmedPaths].filter((itemPath) => !isPathWithinDirectory(itemPath, removedPath)));
  const currentRemoved = state.currentDirectory && isPathWithinDirectory(state.currentDirectory, removedPath);
  if (currentRemoved || !state.roots.length) {
    state.selected = null;
    state.selectedPaths = new Set();
    state.selectionAnchorPath = null;
    state.allMedia = [];
    state.media = [];
    if (state.roots.length) {
      state.root = state.roots[0];
      state.currentDirectory = state.root.path;
    } else {
      state.root = null;
      state.currentDirectory = null;
    }
  } else {
    state.root = rootForPath(state.currentDirectory) || state.roots[0];
  }
  updateRootTitle();
  if (!state.roots.length) {
    dom.tree.innerHTML = `<div class="panel-placeholder compact"><div class="placeholder-icon">${ICONS.folder}</div><p>Добавьте одну или несколько папок, чтобы увидеть их структуру</p></div>`;
    setGalleryView('welcome');
    dom.mediaSummary.textContent = 'Выберите папку для начала';
    renderBreadcrumbs();
    renderEmptyPreview();
    updateCustomScrollbars();
    return;
  }
  await renderTree();
  await loadMedia({ quiet: false });
}

async function detachRoot(item) {
  if (!item || !isLibraryRootPath(item.path)) return;
  try {
    const roots = await window.lumina.detachRoot(item.path);
    await applyRootsAfterRemoval(roots, item.path, false);
    showToast(`Папка «${item.name}» откреплена. Файлы не удалены.`);
  } catch (error) {
    showToast(`Не удалось открепить папку: ${formatError(error)}`, 'error');
  }
}

async function deleteItems(items, fromModal = false) {
  const uniqueItems = [...new Map((items || []).filter(Boolean).map((item) => [item.path, item])).values()];
  if (!uniqueItems.length || uniqueItems.some((item) => state.deletingPaths.has(item.path))) return;
  uniqueItems.forEach((item) => state.deletingPaths.add(item.path));
  if (fromModal) {
    dom.deleteConfirm.disabled = true;
    dom.deleteConfirm.textContent = 'Удаление…';
  }
  const deleted = [];
  const errors = [];
  try {
    if (uniqueItems.length === 1 && isLibraryRootPath(uniqueItems[0].path)) {
      const item = uniqueItems[0];
      try {
        const roots = await window.lumina.trashRoot(item.path);
        deleted.push(item);
        if (fromModal) closeDeleteModal();
        await applyRootsAfterRemoval(roots, item.path, true);
        showToast(`Корневая папка «${item.name}» перемещена в Корзину`);
      } catch (error) {
        errors.push({ item, error });
      }
    } else {
      for (const item of uniqueItems) {
        try {
          await window.lumina.moveToTrash(item.path);
          deleted.push(item);
        } catch (error) {
          errors.push({ item, error });
        }
      }
      if (fromModal) closeDeleteModal();
      for (const item of deleted) {
        state.preparedPaths.delete(item.path);
        state.warmedPaths.delete(item.path);
        removeFromPreviewHistory(item.path);
        removeFavoritesWithin(item.path);
        state.selectedPaths = new Set([...state.selectedPaths].filter((itemPath) => !isPathWithinDirectory(itemPath, item.path)));
        state.allMedia = state.allMedia.filter((media) => !isPathWithinDirectory(media.path, item.path));
        if (state.selected && isPathWithinDirectory(state.selected.path, item.path)) state.selected = null;
        if (item.kind === 'directory' && isPathWithinDirectory(state.currentDirectory, item.path)) {
          state.currentDirectory = parentPath(item.path);
          state.root = rootForPath(state.currentDirectory) || state.root;
        }
      }
      applyMediaFilters({ resetScroll: false });
      await renderTree();
      await loadMedia({ quiet: true });
      if (!state.selected) renderEmptyPreview();
      if (deleted.length) {
        showToast(deleted.length === 1 ? 'Элемент перемещён в Корзину' : `${deleted.length} элементов перемещено в Корзину`);
      }
    }
    if (errors.length) showToast(`Не удалось удалить ${errors.length} элементов: ${formatError(errors[0].error)}`, 'error');
  } finally {
    uniqueItems.forEach((item) => state.deletingPaths.delete(item.path));
    if (fromModal) {
      dom.deleteConfirm.disabled = false;
      dom.deleteConfirm.textContent = 'В корзину';
    }
  }
}

async function deleteItem(item, fromModal = false) {
  return deleteItems([item], fromModal);
}

async function confirmDelete() {
  await deleteItems(state.pendingDelete, true);
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
dom.queueAutoplayToggle.addEventListener('change', () => {
  state.queueAutoplay = dom.queueAutoplayToggle.checked;
  localStorage.setItem('lumina:queue-autoplay', String(state.queueAutoplay));
});
dom.previewHistoryToggle.addEventListener('change', () => {
  state.previewHistoryEnabled = dom.previewHistoryToggle.checked;
  localStorage.setItem('lumina:preview-history', String(state.previewHistoryEnabled));
  if (state.previewHistoryEnabled) {
    if (state.selected) {
      state.previewHistory = [state.selected, ...state.previewHistory.filter((entry) => entry.path !== state.selected.path)]
        .slice(0, MAX_PREVIEW_HISTORY);
    }
    renderPreviewHistory();
  } else if (state.selected) {
    renderPreview(state.selected);
  } else {
    renderEmptyPreview();
  }
});
dom.mediaFilters.forEach((button) => {
  button.addEventListener('click', () => toggleMediaFilter(button.dataset.kind));
});
dom.contextOpenDefault.addEventListener('click', () => {
  const item = state.contextItem;
  hideFileContextMenu();
  void openInDefaultApp(item);
});
dom.contextReveal.addEventListener('click', async () => {
  const item = state.contextItem;
  hideFileContextMenu();
  if (!item) return;
  try {
    await window.lumina.revealItem(item.path);
  } catch (error) {
    showToast(`Не удалось открыть папку: ${formatError(error)}`, 'error');
  }
});
dom.contextFavorite.addEventListener('click', () => {
  const item = state.contextItem;
  hideFileContextMenu();
  toggleFavorite(item);
});
dom.contextLoopVideo.addEventListener('click', () => {
  const item = state.contextItem;
  hideFileContextMenu();
  if (!item || item.kind !== 'video') return;
  const shouldLoop = !state.loopVideoPaths.has(item.path);
  if (shouldLoop) state.loopVideoPaths.add(item.path);
  else state.loopVideoPaths.delete(item.path);

  const historyEntry = [...dom.preview.querySelectorAll('.preview-history-item')]
    .find((entry) => entry.dataset.path === item.path);
  const video = historyEntry?.querySelector('video')
    || (state.selected?.path === item.path ? dom.preview.querySelector('.preview-active video') : null);
  if (video) video.loop = shouldLoop;
});
dom.contextRename.addEventListener('click', () => {
  const item = state.contextItem;
  hideFileContextMenu();
  if (item) openNameModal('rename', item);
});
dom.contextCreateFolder.addEventListener('click', () => {
  const item = state.contextItem;
  hideFileContextMenu();
  if (item) openNameModal('create-folder', item);
});
dom.contextDetachRoot.addEventListener('click', () => {
  const item = state.contextItem;
  hideFileContextMenu();
  void detachRoot(item);
});
dom.contextDelete.addEventListener('click', () => {
  const item = state.contextItem;
  hideFileContextMenu();
  if (item) requestDelete(item);
});
dom.nameCancel.addEventListener('click', closeNameModal);
dom.nameForm.addEventListener('submit', submitNameAction);
dom.nameModal.addEventListener('click', (event) => {
  if (event.target === dom.nameModal) closeNameModal();
});
window.addEventListener('pointerdown', (event) => {
  if (!dom.contextMenu.classList.contains('hidden') && !dom.contextMenu.contains(event.target)) hideFileContextMenu();
});
window.addEventListener('blur', hideFileContextMenu);
window.addEventListener('scroll', hideFileContextMenu, true);
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
dom.queueAutoplayToggle.checked = state.queueAutoplay;
dom.previewHistoryToggle.checked = state.previewHistoryEnabled;
syncMediaFilters();
initCustomScrollbars();

async function loadInitialRoots() {
  try {
    const roots = await window.lumina.getRoots();
    if (!roots?.length || state.roots.length) return;
    state.roots = roots;
    state.root = roots[0];
    state.currentDirectory = roots[0].path;
    updateRootTitle();
    await renderTree();
    await loadMedia({ prepareRoots: true });
  } catch (error) {
    showToast(`Не удалось открыть начальные папки: ${formatError(error)}`, 'error');
  }
}

void loadInitialRoots();

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
  const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'AUDIO' || tag === 'VIDEO';
  if (event.key === 'Escape' && !dom.contextMenu.classList.contains('hidden')) {
    hideFileContextMenu();
    return;
  }
  if (event.key === 'Escape' && !dom.deleteModal.classList.contains('hidden')) {
    closeDeleteModal();
    return;
  }
  if (event.key === 'Escape' && !dom.nameModal.classList.contains('hidden')) {
    closeNameModal();
    return;
  }
  if (event.key === 'Escape' && !dom.settingsModal.classList.contains('hidden')) {
    closeSettings();
    return;
  }
  if (isEditing || !dom.deleteModal.classList.contains('hidden') || !dom.nameModal.classList.contains('hidden') || !dom.settingsModal.classList.contains('hidden')) return;
  if (event.ctrlKey && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    openFolder();
  } else if (event.key === 'Delete' && state.selected) {
    event.preventDefault();
    requestDelete(state.selected);
  } else if (event.key === ' ' && state.media.some(isAutoplayMedia)) {
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
    if (!state.roots.length) return;
    await loadMedia({ quiet: true });
  }, 1200);
});

window.lumina.onPrepareProgress((progress) => {
  if (progress.requestId !== state.requestId || dom.loadingState.classList.contains('hidden')) return;
  const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 100;
  dom.loadingProgressBar.style.width = `${percent}%`;
  dom.loadingProgressText.textContent = `${progress.completed} / ${progress.total} файлов${progress.errors ? ` · ошибок: ${progress.errors}` : ''}`;
});

window.lumina.onExternalDragEnded(async (result) => {
  const results = Array.isArray(result?.items) ? result.items : [];
  const draggedItems = [...state.externalDraggedItems];
  state.externalDraggedItems = [];
  state.externalDragStarted = false;
  state.externalDragCancelled = false;
  resetFileDragState();
  const removed = [];
  const errors = [];
  for (const itemResult of results) {
    const item = draggedItems.find((entry) => entry.path === itemResult.path)
      || state.allMedia.find((entry) => entry.path === itemResult.path);
    if (itemResult.error) errors.push(itemResult.error);
    if (!item || itemResult.sourceExists) continue;
    removed.push(item);
    state.preparedPaths.delete(item.path);
    state.warmedPaths.delete(item.path);
    state.allMedia = state.allMedia.filter((entry) => !isPathWithinDirectory(entry.path, item.path));
    removeFromPreviewHistory(item.path);
    removeFavoritesWithin(item.path);
    state.selectedPaths = new Set([...state.selectedPaths].filter((itemPath) => !isPathWithinDirectory(itemPath, item.path)));
    if (state.selected && isPathWithinDirectory(state.selected.path, item.path)) {
      state.selected = null;
    }
  }
  if (removed.length) {
    applyMediaFilters({ resetScroll: false });
    await renderTree();
    if (!state.selected) renderEmptyPreview();
    showToast(removed.length === 1
      ? 'Элемент передан Windows, исходник перемещён в Корзину'
      : `${removed.length} элементов передано Windows, исходники перемещены в Корзину`);
  }
  if (errors.length) {
    showToast(`Не удалось полностью завершить перенос (${errors.length}): ${errors[0]}`, 'error');
  } else if (!result?.cancelled && !removed.length && results.length) {
    showToast('Исходники оставлены: системное перетаскивание завершилось слишком быстро', 'error');
  }
});

function cancelReturnedExternalDrag() {
  if (!state.externalDragStarted || state.externalDragCancelled) return;
  state.externalDragCancelled = true;
  window.lumina.cancelExternalDrag();
  clearExternalDropTargets();
}

function beginExternalDragAtWindowEdge() {
  if (!state.draggedItem || state.externalDragStarted || state.moveInProgress) return;
  const items = state.draggedItems.length ? [...state.draggedItems] : [state.draggedItem];
  state.externalDragStarted = true;
  state.externalDragCancelled = false;
  state.externalDraggedItems = items;
  window.lumina.startExternalDrag(items.map((item) => item.path));
}

window.addEventListener('dragover', (event) => {
  if (state.externalDragStarted) {
    const returnInset = 8;
    const returnedInside = event.clientX > returnInset
      && event.clientY > returnInset
      && event.clientX < window.innerWidth - returnInset
      && event.clientY < window.innerHeight - returnInset;
    if (returnedInside) cancelReturnedExternalDrag();
    return;
  }
  if (!state.draggedItem) return;
  const edge = 3;
  const atWindowEdge = event.clientX <= edge
    || event.clientY <= edge
    || event.clientX >= window.innerWidth - edge
    || event.clientY >= window.innerHeight - edge;
  if (atWindowEdge) beginExternalDragAtWindowEdge();
}, true);

window.addEventListener('dragleave', (event) => {
  if (!state.draggedItem || state.externalDragStarted || event.relatedTarget) return;
  beginExternalDragAtWindowEdge();
}, true);

dom.galleryScroll.addEventListener('dragenter', (event) => {
  if (state.externalDragStarted) {
    cancelReturnedExternalDrag();
    event.preventDefault();
    return;
  }
  if (!isExternalFileDrag(event) || state.moveInProgress || !state.currentDirectory) return;
  event.preventDefault();
  dom.galleryScroll.classList.add('external-drop-target');
});

dom.galleryScroll.addEventListener('dragover', (event) => {
  if (state.externalDragStarted) {
    cancelReturnedExternalDrag();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'none';
    return;
  }
  if (!isExternalFileDrag(event) || state.moveInProgress || !state.currentDirectory) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  dom.galleryScroll.classList.add('external-drop-target');
});

dom.galleryScroll.addEventListener('dragleave', (event) => {
  if (!dom.galleryScroll.contains(event.relatedTarget)) dom.galleryScroll.classList.remove('external-drop-target');
});

dom.galleryScroll.addEventListener('drop', (event) => {
  if (!isExternalFileDrag(event) || state.moveInProgress || !state.currentDirectory) return;
  event.preventDefault();
  event.stopPropagation();
  const sourcePaths = droppedFilePaths(event.dataTransfer.files);
  clearExternalDropTargets();
  void importExternalFilesToDirectory(sourcePaths, state.currentDirectory);
});

dom.tree.addEventListener('dragover', (event) => {
  if (!isExternalFileDrag(event) || state.moveInProgress || !state.roots.length) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  dom.tree.classList.add('external-drop-target');
});

dom.tree.addEventListener('dragleave', (event) => {
  if (!dom.tree.contains(event.relatedTarget)) dom.tree.classList.remove('external-drop-target');
});

dom.tree.addEventListener('drop', (event) => {
  if (!isExternalFileDrag(event) || state.moveInProgress || !state.root) return;
  event.preventDefault();
  const sourcePaths = droppedFilePaths(event.dataTransfer.files);
  clearExternalDropTargets();
  void importExternalFilesToDirectory(sourcePaths, state.root.path);
});

window.addEventListener('dragover', (event) => {
  if (!isExternalFileDrag(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = state.currentDirectory ? 'move' : 'none';
}, true);

window.addEventListener('drop', (event) => {
  if (state.externalDragStarted) {
    event.preventDefault();
    event.stopImmediatePropagation();
    cancelReturnedExternalDrag();
    return;
  }
  if (!isExternalFileDrag(event)) return;
  event.preventDefault();
  clearExternalDropTargets();
  if (!state.currentDirectory) showToast('Сначала откройте папку в Lumina', 'error');
}, true);

window.addEventListener('dragleave', (event) => {
  if (isExternalFileDrag(event) && !event.relatedTarget) clearExternalDropTargets();
}, true);
