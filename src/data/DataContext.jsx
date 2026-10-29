import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { db, COLLECTIONS } from './storage.js';
import { config } from '../config.js';
import { ultimosMeses } from './stats.js';
import * as services from './services.js';

const DataContext = createContext(null);

const EMPTY = { productos: [], proveedores: [], compras: [], ventas: [] };
const byFechaDesc = (a, b) => (b.fecha + b.creadoEn).localeCompare(a.fecha + a.creadoEn);
const ORDEN = {
  productos: (a, b) => a.nombre.localeCompare(b.nombre),
  proveedores: (a, b) => a.nombre.localeCompare(b.nombre),
  compras: byFechaDesc,
  ventas: byFechaDesc,
};

// Primer día del mes más antiguo que se carga. Ej. 12 meses en oct-2026 -> 2025-11-01.
const desdeHistorial = () => `${ultimosMeses(config.historialMeses)[0]}-01`;

// Aplica { upsert, remove } devuelto por los servicios sobre los datos en memoria.
function aplicarCambios(data, { upsert = {}, remove = {} }) {
  const next = { ...data };
  for (const c of COLLECTIONS) {
    const nuevos = upsert[c] || [];
    const borrados = remove[c] || [];
    if (!nuevos.length && !borrados.length) continue;
    const ids = new Set([...nuevos.map((r) => r.id), ...borrados]);
    next[c] = [...data[c].filter((r) => !ids.has(r.id)), ...nuevos].sort(ORDEN[c]);
  }
  return next;
}

export function DataProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carga completa: al abrir la app, con el botón "Actualizar" o tras importar/borrar.
  const refresh = useCallback(async () => {
    try {
      const desde = desdeHistorial();
      const [productos, proveedores, compras, ventas] = await Promise.all([
        db.list('productos'),
        // Si la base de datos aún no tiene la tabla de proveedores, la app sigue funcionando sin ella.
        db.list('proveedores').catch((e) => {
          console.warn('No se pudieron cargar los proveedores:', e.message);
          return [];
        }),
        db.list('compras', { desde }),
        db.list('ventas', { desde }),
      ]);
      setData({
        productos: productos.sort(ORDEN.productos),
        proveedores: proveedores.sort(ORDEN.proveedores),
        compras: compras.sort(ORDEN.compras),
        ventas: ventas.sort(ORDEN.ventas),
      });
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const actions = useMemo(() => {
    // Aplica solo lo que cambió. Si algo falla a mitad de camino, recarga todo
    // para no mostrar un estado que no coincide con el almacenamiento.
    const run =
      (fn) =>
      async (...args) => {
        try {
          const cambios = await fn(db, ...args);
          setData((d) => aplicarCambios(d, cambios));
          return cambios;
        } catch (e) {
          if (!(e instanceof services.ErrorValidacion)) await refresh();
          throw e;
        }
      };
    const runYRecargar =
      (fn) =>
      async (...args) => {
        try {
          return await fn(db, ...args);
        } finally {
          await refresh();
        }
      };
    return {
      crearProducto: run(services.crearProducto),
      actualizarProducto: run(services.actualizarProducto),
      eliminarProducto: run(services.eliminarProducto),
      crearProveedor: run(services.crearProveedor),
      actualizarProveedor: run(services.actualizarProveedor),
      eliminarProveedor: run(services.eliminarProveedor),
      registrarProveedores: run(services.registrarProveedores),
      registrarCompra: run(services.registrarCompra),
      actualizarCompra: run(services.actualizarCompra),
      recibirCompra: run(services.recibirCompra),
      eliminarCompra: run(services.eliminarCompra),
      registrarVenta: run(services.registrarVenta),
      eliminarVenta: run(services.eliminarVenta),
      agregarInventario: run(services.agregarInventario),
      importarTodo: runYRecargar(services.importarTodo),
      borrarTodo: runYRecargar(services.borrarTodo),
      exportarTodo: () => services.exportarTodo(db),
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      ...data,
      loading,
      error,
      refresh,
      actions,
      storageName: db.name,
      isLocal: db.isLocal,
      historialMeses: config.historialMeses,
    }),
    [data, loading, error, refresh, actions],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
}
