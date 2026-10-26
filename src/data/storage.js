import { config } from '../config.js';
import { createLocalAdapter } from './adapters/localAdapter.js';
import { createApiAdapter } from './adapters/apiAdapter.js';
import { createSupabaseAdapter } from './adapters/supabaseAdapter.js';

// Todo el resto de la app habla con `db`, nunca con un almacenamiento concreto.
// Para agregar otra base de datos (Firebase, MongoDB, etc.) crea un adaptador
// con los mismos métodos: list, create, update, remove.
export const COLLECTIONS = ['productos', 'compras', 'ventas'];

function createAdapter() {
  switch (config.storage) {
    case 'api':
      return createApiAdapter({ baseUrl: config.apiUrl, token: config.apiToken });
    case 'supabase':
      return createSupabaseAdapter({ url: config.supabaseUrl, key: config.supabaseKey });
    case 'local':
    default:
      return createLocalAdapter();
  }
}

export const db = createAdapter();
