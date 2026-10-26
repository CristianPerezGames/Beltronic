import { newId } from '../../utils/format.js';

// Usa la API REST de Supabase (PostgREST) directamente, sin dependencias extra.
// Las tablas se crean con supabase/schema.sql.
export function createSupabaseAdapter({ url, key }) {
  if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY');

  async function request(path, options = {}) {
    const res = await fetch(`${url}/rest/v1${path}`, {
      ...options,
      headers: {
        apikey: key,
        // La anon key antigua es un JWT y también va como Bearer; la nueva (sb_publishable_...) no.
        ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...options.headers,
      },
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Supabase ${res.status}: ${detail}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // Para escrituras cuya respuesta no se usa: no descargar las filas de vuelta.
  const MINIMAL = { Prefer: 'return=minimal' };
  const LOTE = 500;

  return {
    name: 'Supabase (PostgreSQL)',
    isLocal: false,

    list(collection, { desde, fields } = {}) {
      const filtro = desde ? `&fecha=gte.${encodeURIComponent(desde)}` : '';
      return request(`/${collection}?select=${fields || '*'}${filtro}`);
    },

    getMany(collection, ids) {
      if (!ids.length) return Promise.resolve([]);
      const lista = ids.map((id) => `"${id}"`).join(',');
      return request(`/${collection}?select=*&id=in.(${encodeURIComponent(lista)})`);
    },

    async create(collection, item) {
      const rows = await request(`/${collection}`, {
        method: 'POST',
        body: JSON.stringify({ ...item, id: item.id || newId() }),
      });
      return rows[0];
    },

    async createMany(collection, items) {
      for (let i = 0; i < items.length; i += LOTE) {
        const lote = items.slice(i, i + LOTE).map((item) => ({ ...item, id: item.id || newId() }));
        await request(`/${collection}`, { method: 'POST', body: JSON.stringify(lote), headers: MINIMAL });
      }
    },

    async update(collection, id, changes) {
      const rows = await request(`/${collection}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      return rows[0];
    },

    async remove(collection, id) {
      await request(`/${collection}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: MINIMAL });
    },

    async removeAll(collection) {
      // PostgREST exige un filtro en DELETE; este coincide con todas las filas.
      await request(`/${collection}?id=not.is.null`, { method: 'DELETE', headers: MINIMAL });
    },
  };
}
