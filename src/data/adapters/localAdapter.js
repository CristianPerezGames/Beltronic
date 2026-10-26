import { newId } from '../../utils/format.js';

// Guarda cada colección como un arreglo JSON en localStorage.
const PREFIX = 'ferrecontrol:';

function read(collection) {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + collection)) || [];
  } catch {
    return [];
  }
}

function write(collection, items) {
  localStorage.setItem(PREFIX + collection, JSON.stringify(items));
}

export function createLocalAdapter() {
  return {
    name: 'Local (navegador)',
    isLocal: true,

    // `fields` se ignora: en local no hay costo por traer todo.
    async list(collection, { desde } = {}) {
      const items = read(collection);
      return desde ? items.filter((i) => i.fecha >= desde) : items;
    },

    async getMany(collection, ids) {
      return read(collection).filter((i) => ids.includes(i.id));
    },

    async create(collection, item) {
      const items = read(collection);
      const record = { ...item, id: item.id || newId() };
      items.push(record);
      write(collection, items);
      return record;
    },

    async update(collection, id, changes) {
      const items = read(collection);
      const index = items.findIndex((i) => i.id === id);
      if (index === -1) throw new Error(`No existe el registro ${id} en ${collection}`);
      items[index] = { ...items[index], ...changes, id };
      write(collection, items);
      return items[index];
    },

    async remove(collection, id) {
      write(collection, read(collection).filter((i) => i.id !== id));
    },

    async replaceAll(collection, items) {
      write(collection, items);
    },
  };
}
