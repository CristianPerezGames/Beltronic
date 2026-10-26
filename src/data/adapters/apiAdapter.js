import { newId } from '../../utils/format.js';

// API REST genérica:
//   GET    /{coleccion}                 -> lista (?fecha_gte=AAAA-MM-DD filtra por fecha)
//   GET    /{coleccion}?id=a&id=b       -> varios por id
//   POST   /{coleccion}                 -> crea
//   PATCH  /{coleccion}/{id}            -> actualiza
//   DELETE /{coleccion}/{id}            -> elimina
// Compatible tal cual con json-server, y fácil de implementar en cualquier backend.
export function createApiAdapter({ baseUrl, token }) {
  if (!baseUrl) throw new Error('Falta VITE_API_URL para usar el almacenamiento "api"');

  async function request(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!res.ok) throw new Error(`Error ${res.status} en ${options.method || 'GET'} ${path}`);
    return res.status === 204 ? null : res.json();
  }

  return {
    name: `API REST (${baseUrl})`,
    isLocal: false,

    list: (collection, { desde } = {}) =>
      request(`/${collection}${desde ? `?fecha_gte=${encodeURIComponent(desde)}` : ''}`),

    getMany: (collection, ids) =>
      ids.length
        ? request(`/${collection}?${ids.map((id) => `id=${encodeURIComponent(id)}`).join('&')}`)
        : Promise.resolve([]),

    create: (collection, item) =>
      request(`/${collection}`, {
        method: 'POST',
        body: JSON.stringify({ ...item, id: item.id || newId() }),
      }),

    update: (collection, id, changes) =>
      request(`/${collection}/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),

    remove: (collection, id) => request(`/${collection}/${id}`, { method: 'DELETE' }),
  };
}
