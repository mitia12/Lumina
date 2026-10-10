const MAX_BOARD_SIZE = 10 * 1024 * 1024;
const TYPES = new Set(['file', 'note', 'rectangle', 'square', 'circle', 'stroke', 'arrow']);

function validateBoard(data) {
  if (!data || data.format !== 'lumina-board' || data.version !== 1 || !Array.isArray(data.nodes)
    || data.nodes.length > 10000) throw new Error('Некорректный файл board или неподдерживаемая версия.');
  const ids = new Map();
  const finite = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100000;
  const coordinate = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER;
  for (const node of data.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || node.id.length > 100 || ids.has(node.id)
      || !TYPES.has(node.type)) throw new Error('Некорректный элемент board.');
    ids.set(node.id, node);
    if (node.type === 'arrow') {
      const endpoint = node.to !== undefined
        ? typeof node.to === 'string' && node.from !== node.to
        : node.end && coordinate(node.end.x) && coordinate(node.end.y);
      if (typeof node.from !== 'string' || !endpoint || (node.to !== undefined && node.end !== undefined)) throw new Error('Некорректная стрелка.');
    } else if (!coordinate(node.x) || !coordinate(node.y) || !finite(node.width) || !finite(node.height)
      || node.width <= 0 || node.height <= 0) throw new Error('Некорректные координаты board.');
    if (node.type === 'file' && (typeof node.path !== 'string' || !node.path || node.path.length > 4096)) throw new Error('Некорректное вложение.');
    if (node.type === 'note' && (typeof node.text !== 'string' || node.text.length > 100000)) throw new Error('Некорректная заметка.');
    if (node.type === 'stroke' && (!Array.isArray(node.points) || node.points.length < 2 || node.points.length > 100000
      || node.points.some((p) => !Array.isArray(p) || p.length !== 2 || !p.every(finite)))) throw new Error('Некорректный рисунок.');
    const styled = !['note', 'file'].includes(node.type);
    if ((styled || node.color !== undefined) && (typeof node.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(node.color))) throw new Error('Некорректный цвет.');
    if ((styled || node.lineWidth !== undefined) && (!finite(node.lineWidth) || node.lineWidth < 1 || node.lineWidth > 30)) throw new Error('Некорректная толщина линии.');
    if (node.dashed !== undefined && typeof node.dashed !== 'boolean') throw new Error('Некорректный стиль линии.');
  }
  for (const node of data.nodes.filter((n) => n.type === 'arrow')) {
    const targets = node.to !== undefined ? [ids.get(node.from), ids.get(node.to)] : [ids.get(node.from)];
    if (targets.some((n) => !n || n.type === 'arrow')) throw new Error('Стрелка ссылается на отсутствующий элемент.');
  }
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_BOARD_SIZE) throw new Error('Размер board превышает 10 МБ.');
  return data;
}

module.exports = { MAX_BOARD_SIZE, validateBoard };
