import { COLLECTIONS } from './storage.js';
import { generarCodigo } from './codigos.js';

// Reglas de negocio. Reciben el adaptador `db` para no depender del almacenamiento.
// Cada operación devuelve solo lo que cambió ({ upsert, remove }) para que la app
// actualice la pantalla sin volver a descargar todo.
// Nota: con una base de datos remota, registrar una compra/venta y ajustar el stock
// idealmente debería hacerse en una sola transacción del lado del servidor.

const now = () => new Date().toISOString();

// Errores de datos inválidos: se lanzan antes de escribir nada.
export class ErrorValidacion extends Error {}

function normalizeProducto(data) {
  return {
    codigo: (data.codigo || '').trim(),
    nombre: (data.nombre || '').trim(),
    categoria: (data.categoria || 'General').trim(),
    unidad: (data.unidad || 'unidad').trim(),
    proveedor: (data.proveedor || '').trim(),
    precioCompra: Number(data.precioCompra) || 0,
    precioVenta: Number(data.precioVenta) || 0,
    stock: Number(data.stock) || 0,
    stockMinimo: Number(data.stockMinimo) || 0,
  };
}

// Solo id y código: es lo único que se necesita para validar y generar códigos.
const listarCodigos = (db) => db.list('productos', { fields: 'id,codigo' });

// Con data.codigoAuto el código se calcula aquí, contra los datos actuales,
// para no repetir uno que se haya creado mientras el formulario estaba abierto.
export async function crearProducto(db, data) {
  const producto = normalizeProducto(data);
  if (!producto.nombre) throw new ErrorValidacion('El producto necesita un nombre');
  const codigos = await listarCodigos(db);
  if (data.codigoAuto) producto.codigo = generarCodigo(producto.categoria, codigos);
  if (producto.codigo && codigos.some((p) => p.codigo === producto.codigo)) {
    throw new ErrorValidacion(`Ya existe un producto con el código ${producto.codigo}`);
  }
  const creado = await db.create('productos', { ...producto, creadoEn: now(), actualizadoEn: now() });
  return { upsert: { productos: [creado] } };
}

export async function actualizarProducto(db, id, data) {
  const producto = normalizeProducto(data);
  if (!producto.nombre) throw new ErrorValidacion('El producto necesita un nombre');
  const codigos = await listarCodigos(db);
  if (data.codigoAuto) producto.codigo = generarCodigo(producto.categoria, codigos, id);
  if (producto.codigo && codigos.some((p) => p.codigo === producto.codigo && p.id !== id)) {
    throw new ErrorValidacion(`Ya existe un producto con el código ${producto.codigo}`);
  }
  const actualizado = await db.update('productos', id, { ...producto, actualizadoEn: now() });
  return { upsert: { productos: [actualizado] } };
}

export async function eliminarProducto(db, id) {
  await db.remove('productos', id);
  return { remove: { productos: [id] } };
}

// Trae del almacenamiento solo los productos de las líneas, con su stock actual.
const productosDe = (db, items) =>
  db.getMany('productos', [...new Set(items.map((i) => i.productoId).filter(Boolean))]);

// Suma `delta(item)` al stock de cada producto y devuelve los productos actualizados.
async function ajustarStock(db, productos, items, delta, extra = () => ({})) {
  const actualizados = [];
  for (const item of items) {
    const p = productos.find((x) => x.id === item.productoId);
    if (!p) continue;
    actualizados.push(
      await db.update('productos', p.id, {
        stock: Number(p.stock) + delta(item),
        ...extra(item, p),
        actualizadoEn: now(),
      }),
    );
  }
  return actualizados;
}

// Junta líneas repetidas del mismo producto y valida cantidades.
function prepararItems(items, productos, priceKey) {
  const merged = new Map();
  for (const item of items) {
    if (!item.productoId) continue;
    const cantidad = Number(item.cantidad);
    if (!(cantidad > 0)) throw new ErrorValidacion('Las cantidades deben ser mayores que cero');
    const producto = productos.find((p) => p.id === item.productoId);
    if (!producto) throw new ErrorValidacion('Uno de los productos ya no existe');
    const previo = merged.get(producto.id);
    merged.set(producto.id, {
      productoId: producto.id,
      nombre: producto.nombre,
      cantidad: (previo?.cantidad || 0) + cantidad,
      [priceKey]: Number(item[priceKey]) || 0,
    });
  }
  if (merged.size === 0) throw new ErrorValidacion('Agrega al menos un producto');
  return [...merged.values()];
}

export async function registrarCompra(db, data) {
  const productos = await productosDe(db, data.items);
  const items = prepararItems(data.items, productos, 'costoUnitario');
  const total = items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0);

  const compra = await db.create('compras', {
    fecha: data.fecha,
    proveedor: (data.proveedor || '').trim(),
    factura: (data.factura || '').trim(),
    notas: (data.notas || '').trim(),
    items,
    total,
    creadoEn: now(),
  });

  const actualizados = await ajustarStock(db, productos, items, (i) => i.cantidad, (i, p) => ({
    precioCompra: i.costoUnitario || p.precioCompra,
  }));
  return { upsert: { compras: [compra], productos: actualizados } };
}

export async function eliminarCompra(db, compra) {
  const productos = await productosDe(db, compra.items);
  const actualizados = await ajustarStock(db, productos, compra.items, (i) => -i.cantidad);
  await db.remove('compras', compra.id);
  return { upsert: { productos: actualizados }, remove: { compras: [compra.id] } };
}

export async function registrarVenta(db, data) {
  const productos = await productosDe(db, data.items);
  const items = prepararItems(data.items, productos, 'precioUnitario').map((item) => {
    const p = productos.find((x) => x.id === item.productoId);
    if (item.cantidad > p.stock) {
      throw new ErrorValidacion(`Stock insuficiente de "${p.nombre}" (disponible: ${p.stock})`);
    }
    return { ...item, costoUnitario: p.precioCompra };
  });
  const total = items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
  const costo = items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0);

  const venta = await db.create('ventas', {
    fecha: data.fecha,
    cliente: (data.cliente || '').trim(),
    items,
    total,
    costo,
    creadoEn: now(),
  });

  const actualizados = await ajustarStock(db, productos, items, (i) => -i.cantidad);
  return { upsert: { ventas: [venta], productos: actualizados } };
}

export async function eliminarVenta(db, venta) {
  const productos = await productosDe(db, venta.items);
  const actualizados = await ajustarStock(db, productos, venta.items, (i) => i.cantidad);
  await db.remove('ventas', venta.id);
  return { upsert: { productos: actualizados }, remove: { ventas: [venta.id] } };
}

// ---- Respaldo (siempre con todo el historial) ----

export async function exportarTodo(db) {
  const data = { app: 'Beltronic', version: 1, exportadoEn: now() };
  for (const c of COLLECTIONS) data[c] = await db.list(c);
  return data;
}

export async function importarTodo(db, data) {
  if (!data || COLLECTIONS.some((c) => !Array.isArray(data[c]))) {
    throw new ErrorValidacion('El archivo no tiene el formato de respaldo de Beltronic');
  }
  for (const c of COLLECTIONS) {
    if (db.replaceAll) {
      await db.replaceAll(c, data[c]);
      continue;
    }
    if (db.removeAll) await db.removeAll(c);
    else for (const item of await db.list(c, { fields: 'id' })) await db.remove(c, item.id);

    if (db.createMany) await db.createMany(c, data[c]);
    else for (const item of data[c]) await db.create(c, item);
  }
}

export function borrarTodo(db) {
  return importarTodo(db, Object.fromEntries(COLLECTIONS.map((c) => [c, []])));
}
