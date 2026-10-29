import { newId } from '../utils/format.js';

// Datos de ejemplo para probar la app. Genera compras y ventas de los últimos meses.
const BASE = [
  ['MAR-001', 'Martillo de uña 16 oz', 'Herramientas', 'unidad', 'Truper', 26000, 42000, 14, 5],
  ['DES-002', 'Juego de destornilladores 6 pzs', 'Herramientas', 'juego', 'Stanley', 32000, 55000, 9, 4],
  ['LLA-003', 'Llave ajustable 10"', 'Herramientas', 'unidad', 'Truper', 29000, 49000, 3, 4],
  ['TAL-004', 'Taladro percutor 600W', 'Herramientas eléctricas', 'unidad', 'Black+Decker', 170000, 269000, 4, 2],
  ['CIN-005', 'Cinta métrica 5 m', 'Medición', 'unidad', 'Stanley', 12500, 22000, 22, 8],
  ['TOR-006', 'Tornillo drywall 6x1" (100 u)', 'Tornillería', 'caja', 'Fijaciones SA', 9500, 17000, 40, 15],
  ['CLA-007', 'Clavo acero 2" (1 kg)', 'Tornillería', 'kg', 'Fijaciones SA', 7500, 12500, 12, 15],
  ['CEM-008', 'Cemento gris 50 kg', 'Construcción', 'saco', 'Cementos del Valle', 29500, 36500, 30, 20],
  ['ARE-009', 'Arena fina (m³)', 'Construcción', 'm³', 'Agregados Norte', 72000, 98000, 2, 3],
  ['PIN-010', 'Pintura látex blanca galón', 'Pintura', 'galón', 'Pinturas Color', 45000, 72000, 16, 6],
  ['BRO-011', 'Brocha 3"', 'Pintura', 'unidad', 'Pinturas Color', 6500, 11500, 0, 10],
  ['TUB-012', 'Tubo PVC 1/2" x 6 m', 'Plomería', 'unidad', 'Plásticos Andinos', 11500, 18500, 25, 10],
  ['LLV-013', 'Llave de paso 1/2"', 'Plomería', 'unidad', 'Plásticos Andinos', 14000, 24000, 7, 6],
  ['CAB-014', 'Cable eléctrico #12 (metro)', 'Electricidad', 'metro', 'Eléctricos Unidos', 1800, 3200, 180, 100],
  ['BOM-015', 'Bombillo LED 9W', 'Electricidad', 'unidad', 'Eléctricos Unidos', 4500, 8900, 48, 20],
  ['CAN-016', 'Candado de acero 40 mm', 'Seguridad', 'unidad', 'Yale', 17000, 29900, 5, 5],
  ['SIL-017', 'Silicona transparente 280 ml', 'Adhesivos', 'tubo', 'Sika', 11000, 18900, 11, 8],
];

function fechaHace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

// Pseudoaleatorio determinístico para que los ejemplos sean siempre iguales.
function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function crearDatosEjemplo() {
  const now = new Date().toISOString();
  const productos = BASE.map(
    ([codigo, nombre, categoria, unidad, proveedor, precioCompra, precioVenta, stock, stockMinimo]) => ({
      id: newId(),
      codigo, nombre, categoria, unidad, proveedor,
      precioCompra, precioVenta, stock, stockMinimo,
      creadoEn: now, actualizadoEn: now,
    }),
  );

  const rand = rng(42);
  const pick = () => productos[Math.floor(rand() * productos.length)];

  const ventas = [];
  for (let dia = 170; dia >= 0; dia -= 1 + Math.floor(rand() * 3)) {
    const items = [];
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const p = pick();
      if (items.some((x) => x.productoId === p.id)) continue;
      items.push({
        productoId: p.id,
        nombre: p.nombre,
        cantidad: 1 + Math.floor(rand() * 4),
        precioUnitario: p.precioVenta,
        costoUnitario: p.precioCompra,
      });
    }
    ventas.push({
      id: newId(),
      fecha: fechaHace(dia),
      cliente: rand() > 0.6 ? 'Cliente frecuente' : '',
      items,
      total: items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0),
      costo: items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0),
      creadoEn: now,
    });
  }

  const compras = [];
  for (let dia = 165; dia >= 0; dia -= 12 + Math.floor(rand() * 10)) {
    const proveedor = pick().proveedor;
    const items = productos
      .filter((p) => p.proveedor === proveedor)
      .map((p) => ({
        productoId: p.id,
        nombre: p.nombre,
        cantidad: Math.max(p.stockMinimo, 2),
        costoUnitario: p.precioCompra,
      }));
    compras.push({
      id: newId(),
      fecha: fechaHace(dia),
      proveedor,
      factura: `F-${1000 + compras.length}`,
      notas: '',
      items,
      total: items.reduce((s, i) => s + i.cantidad * i.costoUnitario, 0),
      creadoEn: now,
    });
  }

  const proveedores = [...new Set(BASE.map((b) => b[4]))].map((nombre) => ({
    id: newId(),
    nombre, contacto: '', telefono: '', email: '', notas: '',
    creadoEn: now,
  }));

  return { productos, proveedores, compras, ventas };
}
