const env = import.meta.env || {};

export const config = {
  storage: env.VITE_STORAGE || 'local',
  apiUrl: (env.VITE_API_URL || '').replace(/\/$/, ''),
  apiToken: env.VITE_API_TOKEN || '',
  supabaseUrl: (env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
  supabaseKey: env.VITE_SUPABASE_KEY || '',
  currency: env.VITE_CURRENCY || 'COP',
  currencyDecimals: Number(env.VITE_CURRENCY_DECIMALS ?? 0),
  locale: env.VITE_LOCALE || 'es-CO',
  // Meses de compras y ventas que se cargan al abrir la app (el respaldo siempre trae todo).
  historialMeses: Number(env.VITE_HISTORIAL_MESES) || 12,
};
