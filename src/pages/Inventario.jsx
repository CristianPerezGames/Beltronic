import { useMemo, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import Modal from '../components/Modal.jsx';
import ProductForm from '../components/ProductForm.jsx';
import StockBadge from '../components/StockBadge.jsx';
import { money, num, downloadFile } from '../utils/format.js';

export default function Inventario() {
  const { productos, actions } = useData();
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('');
  const [editando, setEditando] = useState(null); // null | 'nuevo' | producto

  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.categoria))].sort(),
    [productos],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (!categoria || p.categoria === categoria) &&
        (!q ||
          p.nombre.toLowerCase().includes(q) ||
          p.codigo.toLowerCase().includes(q) ||
          p.proveedor.toLowerCase().includes(q)),
    );
  }, [productos, busqueda, categoria]);

  const guardar = async (form) => {
    if (editando === 'nuevo') await actions.crearProducto(form);
    else await actions.actualizarProducto(editando.id, form);
    setEditando(null);
  };

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"? El historial de compras y ventas se conserva.`)) return;
    await actions.eliminarProducto(p.id);
  };

  const exportarCsv = () => {
    const header = ['Código', 'Nombre', 'Categoría', 'Unidad', 'Proveedor', 'Precio compra', 'Precio venta', 'Stock', 'Stock mínimo'];
    const rows = filtrados.map((p) => [p.codigo, p.nombre, p.categoria, p.unidad, p.proveedor, p.precioCompra, p.precioVenta, p.stock, p.stockMinimo]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadFile('inventario.csv', '﻿' + csv, 'text/csv;charset=utf-8');
  };

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>Inventario</h1>
          <p className="muted">{num(productos.length)} productos registrados</p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={exportarCsv} disabled={!filtrados.length}>
            Exportar CSV
          </button>
          <button className="btn btn-primary" onClick={() => setEditando('nuevo')}>
            + Nuevo producto
          </button>
        </div>
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Buscar por nombre, código o proveedor…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th className="num">Stock</th>
              <th className="num">Mínimo</th>
              <th className="num">P. compra</th>
              <th className="num">P. venta</th>
              <th className="num">Margen</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.codigo || '—'}</td>
                <td>
                  {p.nombre}
                  {p.proveedor && <div className="muted small">{p.proveedor}</div>}
                </td>
                <td>{p.categoria}</td>
                <td className="num">
                  <StockBadge producto={p} /> <span className="muted small">{p.unidad}</span>
                </td>
                <td className="num">{num(p.stockMinimo)}</td>
                <td className="num">{money(p.precioCompra)}</td>
                <td className="num">{money(p.precioVenta)}</td>
                <td className="num">
                  {p.precioCompra > 0
                    ? `${(((p.precioVenta - p.precioCompra) / p.precioCompra) * 100).toFixed(0)}%`
                    : '—'}
                </td>
                <td className="row-actions">
                  <button className="btn-icon" title="Editar" onClick={() => setEditando(p)}>
                    ✎
                  </button>
                  <button className="btn-icon danger" title="Eliminar" onClick={() => eliminar(p)}>
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {!filtrados.length && (
              <tr>
                <td colSpan={9} className="empty">
                  {productos.length ? 'Ningún producto coincide con la búsqueda.' : 'Aún no hay productos. Crea el primero.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal title={editando === 'nuevo' ? 'Nuevo producto' : 'Editar producto'} onClose={() => setEditando(null)}>
          <ProductForm
            initial={editando === 'nuevo' ? {} : editando}
            productos={productos}
            categorias={categorias}
            onSubmit={guardar}
            onCancel={() => setEditando(null)}
          />
        </Modal>
      )}
    </section>
  );
}
