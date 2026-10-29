import { COLLECTIONS } from './storage.js';
import { generarCodigo } from './codigos.js';
import { newId } from '../utils/format.js';
import { mismoCodigo, mismoNombre } from './coincidencias.js';

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

// Solo id, código y nombre: es lo único que se necesita para validar y generar códigos.
const listarCodigos = (db) => db.list('productos', { fields: 'id,codigo,nombre' });

// No se permiten dos productos con el mismo código o nombre (sin importar mayúsculas ni tildes).
function validarRepetido(producto, existentes, id = null) {
  const otros = existentes.filter((p) => p.id !== id);
  const porCodigo = producto.codigo && otros.find((p) => mismoCodigo(p.codigo, producto.codigo));
  if (porCodigo) {
    throw new ErrorValidacion(`Ya existe un producto con el código ${porCodigo.codigo} (${porCodigo.nombre})`);
  }
  const porNombre = otros.find((p) => mismoNombre(p.nombre, producto.nombre));
  if (porNombre) {
    throw new ErrorValidacion(`Ya existe un producto llamado "${porNombre.nombre}"${porNombre.codigo ? ` (${porNombre.codigo})` : ''}`);
  }
}

// Con data.codigoAuto el código se calcula aquí, contra los datos actuales,
// para no repetir uno que se haya creado mientras el formulario estaba abierto.
export async function crearProducto(db, data) {
  const producto = normalizeProducto(data);
  if (!producto.nombre) throw new ErrorValidacion('El producto necesita un nombre');
  const codigos = await listarCodigos(db);
  if (data.codigoAuto) producto.codigo = generarCodigo(producto.categoria, codigos);
  validarRepetido(producto, codigos);
  const creado = await db.create('productos', { ...producto, creadoEn: now(), actualizadoEn: now() });
  return { upsert: { productos: [creado] } };
}

export async function actualizarProducto(db, id, data) {
  const producto = normalizeProducto(data);
  if (!producto.nombre) throw new ErrorValidacion('El producto necesita un nombre');
  const codigos = await listarCodigos(db);
  if (data.codigoAuto) producto.codigo = generarCodigo(producto.categoria, codigos, id);
  validarRepetido(producto, codigos, id);
  const actualizado = await db.update('productos', id, { ...producto, actualizadoEn: now() });
  return { upsert: { productos: [actualizado] } };
}

export async function eliminarProducto(db, id) {
  await db.remove('productos', id);
  return { remove: { productos: [id] } };
}

// ---- Proveedores ----
// Los productos guardan el nombre del proveedor, así que al renombrarlo se actualizan también.

function normalizeProveedor(data) {
  return {
    nombre: (data.nombre || '').trim(),
    contacto: (data.contacto || '').trim(),
    telefono: (data.telefono || '').trim(),
    email: (data.email || '').trim(),
    notas: (data.notas || '').trim(),
  };
}

async function validarProveedor(db, proveedor, id = null) {
  if (!proveedor.nombre) throw new ErrorValidacion('El proveedor necesita un nombre');
  const existentes = await db.list('proveedores', { fields: 'id,nombre' });
  if (existentes.some((p) => p.id !== id && mismoNombre(p.nombre, proveedor.nombre))) {
    throw new ErrorValidacion(`Ya existe el proveedor "${proveedor.nombre}"`);
  }
}

export async function crearProveedor(db, data) {
  const proveedor = normalizeProveedor(data);
  await validarProveedor(db, proveedor);
  const creado = await db.create('proveedores', { ...proveedor, creadoEn: now() });
  return { upsert: { proveedores: [creado] } };
}

export async function actualizarProveedor(db, id, data) {
  const proveedor = normalizeProveedor(data);
  await validarProveedor(db, proveedor, id);
  const [anterior] = await db.getMany('proveedores', [id]);
  const actualizado = await db.update('proveedores', id, proveedor);
  const productos = [];
  if (anterior && anterior.nombre !== proveedor.nombre) {
    const todos = await db.list('productos', { fields: 'id,proveedor' });
    for (const p of todos.filter((x) => x.proveedor === anterior.nombre)) {
      productos.push(await db.update('productos', p.id, { proveedor: proveedor.nombre, actualizadoEn: now() }));
    }
  }
  return { upsert: { proveedores: [actualizado], productos } };
}

// Los productos conservan el nombre del proveedor eliminado.
export async function eliminarProveedor(db, id) {
  await db.remove('proveedores', id);
  return { remove: { proveedores: [id] } };
}

// Registra de una vez los proveedores que ya aparecen en productos pero no están en la lista.
export async function registrarProveedores(db, nombres) {
  const creados = [];
  for (const nombre of nombres) {
    creados.push(await db.create('proveedores', { ...normalizeProveedor({ nombre }), creadoEn: now() }));
  }
  return { upsert: { proveedores: creados } };
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

// Las compras se registran como pendientes y no tocan el stock hasta que se confirma
// que la mercadería llegó. Las compras guardadas antes de existir el estado ya habían
// sumado su stock, por eso sin estado cuentan como recibidas.
export const compraRecibida = (compra) => compra.estado !== 'pendiente';

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
    estado: 'pendiente',
    creadoEn: now(),
  });
  return { upsert: { compras: [compra] } };
}

// Suma al stock lo que llegó y actualiza el precio de compra de cada producto.
export async function recibirCompra(db, compra) {
  if (compraRecibida(compra)) throw new ErrorValidacion('Esta compra ya se había recibido');
  const items = compra.items;
  const productos = await productosDe(db, items);
  const actualizada = await db.update('compras', compra.id, { estado: 'recibida', recibidaEn: now() });
  const actualizados = await ajustarStock(db, productos, items, (i) => i.cantidad, (i, p) => ({
    precioCompra: i.costoUnitario || p.precioCompra,
  }));
  return { upsert: { compras: [actualizada], productos: actualizados } };
}

// Reemplaza las líneas de una compra. Si ya se había recibido, ajusta el stock solo
// por la diferencia con lo que había ingresado antes; si está pendiente, no lo toca.
export async function actualizarCompra(db, anterior, data) {
  // Se guardan antes de escribir por si el adaptador modifica el objeto original.
  const itemsAnteriores = anterior.items;
  const productos = await productosDe(db, [...itemsAnteriores, ...data.items]);
  // Las líneas de productos que ya se eliminaron se conservan tal como estaban.
  const huerfanos = itemsAnteriores.filter(
    (i) => !productos.some((p) => p.id === i.productoId) && data.items.some((x) => x.productoId === i.productoId),
  );
  const nuevos = data.items.filter((i) => !huerfanos.some((h) => h.productoId === i.productoId));
  let items = huerfanos;
  if (nuevos.some((i) => i.productoId) || !huerfanos.length) {
    items = [...prepararItems(nuevos, productos, 'costoUnitario'), ...huerfanos];
  }
  const total = items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0);

  const compra = await db.update('compras', anterior.id, {
    fecha: data.fecha,
    proveedor: (data.proveedor || '').trim(),
    factura: (data.factura || '').trim(),
    notas: (data.notas || '').trim(),
    items,
    total,
  });
  if (!compraRecibida(anterior)) return { upsert: { compras: [compra] } };

  // El precio de compra del producto solo se actualiza en líneas nuevas o con otro costo,
  // para que corregir una compra vieja no pise un precio más reciente.
  const lineaDe = (lista, id) => lista.find((i) => i.productoId === id);
  const actualizados = [];
  for (const p of productos) {
    const nueva = lineaDe(items, p.id);
    const vieja = lineaDe(itemsAnteriores, p.id);
    const delta = (nueva?.cantidad || 0) - (vieja?.cantidad || 0);
    const cambioCosto = nueva?.costoUnitario && nueva.costoUnitario !== vieja?.costoUnitario;
    const precioCompra = cambioCosto ? nueva.costoUnitario : p.precioCompra;
    if (delta === 0 && precioCompra === p.precioCompra) continue;
    actualizados.push(
      await db.update('productos', p.id, { stock: Number(p.stock) + delta, precioCompra, actualizadoEn: now() }),
    );
  }
  return { upsert: { compras: [compra], productos: actualizados } };
}

// Si la compra ya se había recibido, descuenta del stock lo que había ingresado.
export async function eliminarCompra(db, compra) {
  let actualizados = [];
  if (compraRecibida(compra)) {
    const productos = await productosDe(db, compra.items);
    actualizados = await ajustarStock(db, productos, compra.items, (i) => -i.cantidad);
  }
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

// Colecciones que pueden faltar en respaldos hechos con versiones anteriores.
const OPCIONALES = ['proveedores'];

export async function importarTodo(db, data) {
  if (!data || COLLECTIONS.some((c) => !OPCIONALES.includes(c) && !Array.isArray(data[c]))) {
    throw new ErrorValidacion('El archivo no tiene el formato de respaldo de Beltronic');
  }
  data = { ...data };
  if (!Array.isArray(data.proveedores)) {
    const nombres = [...new Set(data.productos.map((p) => (p.proveedor || '').trim()).filter(Boolean))];
    data.proveedores = nombres.map((nombre) => ({ id: newId(), ...normalizeProveedor({ nombre }), creadoEn: now() }));
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
