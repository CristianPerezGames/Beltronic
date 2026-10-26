import { useMemo, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { faltantes } from '../data/stats.js';
import StockBadge from '../components/StockBadge.jsx';
import { money, num, downloadFile } from '../utils/format.js';

export default function Faltantes({ onComprar }) {
  const { productos } = useData();
  const lista = useMemo(() => faltantes(productos), [productos]);
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

  const crearCompra = () =>
    onComprar(
      elegidos.map((p) => ({ productoId: p.id, cantidad: cantidad(p), costoUnitario: p.precioCompra })),
    );

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
            <button className="btn btn-primary" onClick={crearCompra} disabled={!elegidos.length}>
              Registrar compra ({elegidos.length})
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
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Producto</th>
                  <th>Proveedor</th>
                  <th className="num">Stock</th>
                  <th className="num">Mínimo</th>
                  <th className="num">Faltan</th>
                  <th className="num">Pedir</th>
                  <th className="num">Costo est.</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id} className={p.stock <= 0 ? 'row-danger' : ''}>
                    <td>
                      <input type="checkbox" checked={seleccion.has(p.id)} onChange={() => toggle(p.id)} />
                    </td>
                    <td>
                      {p.nombre}
                      {p.stock <= 0 && <span className="badge badge-danger ml">Agotado</span>}
                      <div className="muted small">{p.categoria}</div>
                    </td>
                    <td>{p.proveedor || '—'}</td>
                    <td className="num"><StockBadge producto={p} /></td>
                    <td className="num">{num(p.stockMinimo)}</td>
                    <td className="num">{num(Math.max(p.stockMinimo - p.stock, 0))}</td>
                    <td className="num">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        className="input-num"
                        value={cantidad(p)}
                        onChange={(e) => setCantidades({ ...cantidades, [p.id]: Number(e.target.value) })}
                      />
                    </td>
                    <td className="num">{money(cantidad(p) * p.precioCompra)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="items-total right">
            Costo estimado de reposición: <strong>{money(costoEstimado)}</strong>
          </p>
        </>
      )}
    </section>
  );
}
