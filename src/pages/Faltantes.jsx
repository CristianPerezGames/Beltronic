import { useMemo, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { faltantes } from '../data/stats.js';
import { compraRecibida } from '../data/services.js';
import StockBadge from '../components/StockBadge.jsx';
import { money, num, downloadFile } from '../utils/format.js';

export default function Faltantes({ onComprar }) {
  const { productos, compras } = useData();
  const lista = useMemo(() => faltantes(productos), [productos]);
  // Cantidades ya pedidas en compras que todavía no llegaron.
  const enCamino = useMemo(() => {
    const total = {};
    for (const c of compras) {
      if (compraRecibida(c)) continue;
      for (const i of c.items) total[i.productoId] = (total[i.productoId] || 0) + i.cantidad;
    }
    return total;
  }, [compras]);
  const [cantidades, setCantidades] = useState({});
  const [seleccion, setSeleccion] = useState(() => new Set(lista.map((p) => p.id)));

  const cantidad = (p) => cantidades[p.id] ?? p.sugerido;
  const elegidos = lista.filter((p) => seleccion.has(p.id));
  const costoEstimado = elegidos.reduce((s, p) => s + cantidad(p) * p.precioCompra, 0);

  const toggle = (id) => {
    const next = new Set(seleccion);
    next.has(id) ? next.delete(id) : next.add(id);
    setSeleccion(next);
  };

  // Agrupa por proveedor en orden alfabético; los que no tienen proveedor van al final.
  const grupos = useMemo(() => {
    const porProveedor = {};
    for (const p of lista) (porProveedor[p.proveedor] ||= []).push(p);
    return Object.entries(porProveedor)
      .sort(([a], [b]) => (!a - !b) || a.localeCompare(b, 'es', { sensitivity: 'base' }))
      .map(([proveedor, items]) => ({ proveedor, items }));
  }, [lista]);

  const toggleGrupo = (items, marcar) => {
    const next = new Set(seleccion);
    for (const p of items) marcar ? next.add(p.id) : next.delete(p.id);
    setSeleccion(next);
  };

  const crearCompra = (items, proveedor = '') =>
    onComprar({
      proveedor,
      items: items.map((p) => ({ productoId: p.id, cantidad: cantidad(p), costoUnitario: p.precioCompra })),
    });

  const exportarPedido = () => {
    const porProveedor = {};
    for (const p of elegidos) (porProveedor[p.proveedor || 'Sin proveedor'] ||= []).push(p);
    const texto = Object.entries(porProveedor)
      .map(
        ([prov, items]) =>
          `== ${prov} ==\n` +
          items.map((p) => `- ${cantidad(p)} ${p.unidad} · ${p.nombre}${p.codigo ? ` (${p.codigo})` : ''}`).join('\n'),
      )
      .join('\n\n');
    downloadFile('pedido-faltantes.txt', `Pedido de reposición\n\n${texto}\n`, 'text/plain;charset=utf-8');
  };

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>Faltantes</h1>
          <p className="muted">Productos en o por debajo de su stock mínimo.</p>
        </div>
        {lista.length > 0 && (
          <div className="actions">
            <button className="btn btn-secondary" onClick={exportarPedido} disabled={!elegidos.length}>
              Descargar pedido
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => crearCompra(elegidos)}
              disabled={!elegidos.length}
              title="Una sola compra con todos los productos seleccionados"
            >
              Registrar todo junto ({elegidos.length})
            </button>
          </div>
        )}
      </header>

      {lista.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">✅</span>
          <p>Todo el inventario está por encima del mínimo.</p>
        </div>
      ) : (
        <>
          {grupos.map(({ proveedor, items }) => {
            const elegidosGrupo = items.filter((p) => seleccion.has(p.id));
            const costoGrupo = elegidosGrupo.reduce((s, p) => s + cantidad(p) * p.precioCompra, 0);
            const todos = elegidosGrupo.length === items.length;
            return (
              <div key={proveedor} className="card grupo">
                <div className="card-header">
                  <label className="grupo-titulo">
                    <input
                      type="checkbox"
                      checked={todos}
                      ref={(el) => el && (el.indeterminate = elegidosGrupo.length > 0 && !todos)}
                      onChange={() => toggleGrupo(items, !todos)}
                    />
                    <strong className="grupo-nombre">{proveedor || 'Sin proveedor'}</strong>
                    <span className="muted small">
                      {items.length} {items.length === 1 ? 'producto' : 'productos'} · {money(costoGrupo)}
                    </span>
                  </label>
                  <button
                    className="btn btn-primary"
                    onClick={() => crearCompra(elegidosGrupo, proveedor)}
                    disabled={!elegidosGrupo.length}
                  >
                    Registrar compra ({elegidosGrupo.length})
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="table-cards">
                    <thead>
                      <tr>
                        <th />
                        <th>Producto</th>
                        <th className="num">Stock</th>
                        <th className="num">Mínimo</th>
                        <th className="num">Faltan</th>
                        <th className="num">Pedir</th>
                        <th className="num">Costo est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.id} className={p.stock <= 0 ? 'row-danger' : ''}>
                          <td className="cell-check">
                            <input type="checkbox" checked={seleccion.has(p.id)} onChange={() => toggle(p.id)} />
                          </td>
                          <td className="cell-title">
                            {p.nombre}
                            {p.stock <= 0 && <span className="badge badge-danger ml">Agotado</span>}
                            {enCamino[p.id] > 0 && (
                              <span className="badge badge-ok ml">En camino: {num(enCamino[p.id])} {p.unidad}</span>
                            )}
                            <div className="muted small">{p.categoria}</div>
                          </td>
                          <td className="num" data-label="Stock"><StockBadge producto={p} /></td>
                          <td className="num" data-label="Mínimo">{num(p.stockMinimo)}</td>
                          <td className="num" data-label="Faltan">{num(Math.max(p.stockMinimo - p.stock, 0))}</td>
                          <td className="num" data-label="Pedir">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              className="input-num"
                              value={cantidad(p)}
                              onChange={(e) => setCantidades({ ...cantidades, [p.id]: Number(e.target.value) })}
                            />
                          </td>
                          <td className="num" data-label="Costo est.">{money(cantidad(p) * p.precioCompra)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          <p className="items-total right">
            Costo estimado de reposición: <strong>{money(costoEstimado)}</strong>
          </p>
        </>
      )}
    </section>
  );
}
