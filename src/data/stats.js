// Cálculos para el resumen y las estadísticas. Funciones puras sobre los datos cargados.

export const esFaltante = (p) => p.stock <= p.stockMinimo;

export function faltantes(productos) {
  return productos
    .filter(esFaltante)
    .map((p) => ({
      ...p,
      // Sugerencia: reponer hasta el doble del mínimo.
      sugerido: Math.max(p.stockMinimo * 2 - p.stock, 1),
    }))
    .sort((a, b) => a.stock - a.stockMinimo - (b.stock - b.stockMinimo));
}

export function resumenInventario(productos) {
  return {
    totalProductos: productos.length,
    unidades: productos.reduce((s, p) => s + p.stock, 0),
    valorCosto: productos.reduce((s, p) => s + Math.max(p.stock, 0) * p.precioCompra, 0),
    valorVenta: productos.reduce((s, p) => s + Math.max(p.stock, 0) * p.precioVenta, 0),
    faltantes: productos.filter(esFaltante).length,
    agotados: productos.filter((p) => p.stock <= 0).length,
  };
}

const monthKey = (fecha) => fecha.slice(0, 7);

export function ultimosMeses(n) {
  const keys = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export function porMes(compras, ventas, meses = 6) {
  const keys = ultimosMeses(meses);
  const rows = Object.fromEntries(
    keys.map((k) => [k, { mes: k, compras: 0, ventas: 0, ganancia: 0 }]),
  );
  for (const c of compras) {
    const row = rows[monthKey(c.fecha)];
    if (row) row.compras += c.total;
  }
  for (const v of ventas) {
    const row = rows[monthKey(v.fecha)];
    if (row) {
      row.ventas += v.total;
      row.ganancia += v.total - (v.costo || 0);
    }
  }
  return keys.map((k) => rows[k]);
}

export function totalesMes(compras, ventas, key = ultimosMeses(1)[0]) {
  const vMes = ventas.filter((v) => monthKey(v.fecha) === key);
  const cMes = compras.filter((c) => monthKey(c.fecha) === key);
  const totalVentas = vMes.reduce((s, v) => s + v.total, 0);
  return {
    ventas: totalVentas,
    numVentas: vMes.length,
    compras: cMes.reduce((s, c) => s + c.total, 0),
    numCompras: cMes.length,
    ganancia: totalVentas - vMes.reduce((s, v) => s + (v.costo || 0), 0),
  };
}

export function masVendidos(ventas, limite = 5) {
  const acc = new Map();
  for (const v of ventas) {
    for (const i of v.items) {
      const row = acc.get(i.productoId) || { nombre: i.nombre, cantidad: 0, total: 0 };
      row.cantidad += i.cantidad;
      row.total += i.cantidad * i.precioUnitario;
      acc.set(i.productoId, row);
    }
  }
  return [...acc.values()].sort((a, b) => b.total - a.total).slice(0, limite);
}

export function valorPorCategoria(productos) {
  const acc = new Map();
  for (const p of productos) {
    acc.set(p.categoria, (acc.get(p.categoria) || 0) + Math.max(p.stock, 0) * p.precioCompra);
  }
  return [...acc.entries()]
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
}
