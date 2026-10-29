import { Fragment, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import ItemsEditor from '../components/ItemsEditor.jsx';
import { money, num, today, formatDate } from '../utils/format.js';

const lineaVacia = () => ({ productoId: '', cantidad: 1, precioUnitario: 0 });
const nuevoForm = () => ({ fecha: today(), cliente: '', items: [lineaVacia()] });

export default function Ventas() {
  const { productos, ventas, actions, historialMeses } = useData();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(nuevoForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [abierta, setAbierta] = useState(null);

  const disponibles = productos.filter((p) => p.stock > 0);

  const reset = () => {
    setForm(nuevoForm());
    setError(null);
    setMostrarForm(false);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await actions.registrarVenta(form);
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (venta) => {
    if (!confirm('¿Anular esta venta? Las cantidades vuelven al stock.')) return;
    await actions.eliminarVenta(venta);
  };

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>Ventas</h1>
          <p className="muted">Registra lo que sale de la ferretería. El stock se descuenta automáticamente.</p>
          <p className="muted small">Se muestran los últimos {historialMeses} meses. El respaldo incluye todo el historial.</p>
        </div>
        {!mostrarForm && (
          <button className="btn btn-primary" onClick={() => setMostrarForm(true)} disabled={!disponibles.length}>
            + Registrar venta
          </button>
        )}
      </header>

      {mostrarForm && (
        <form className="card form" onSubmit={guardar}>
          <h2>Nueva venta</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-grid">
            <label>
              Fecha
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
            </label>
            <label className="span-2">
              Cliente (opcional)
              <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
            </label>
          </div>
          <ItemsEditor
            items={form.items}
            onChange={(items) => setForm({ ...form, items })}
            productos={disponibles}
            priceKey="precioUnitario"
            priceLabel="Precio unit."
            defaultPrice={(p) => p.precioVenta}
            showStock
          />
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar venta'}
            </button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table className="table-cards">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th className="num">Productos</th>
              <th className="num">Total</th>
              <th className="num">Ganancia</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <Fragment key={v.id}>
                <tr className="clickable" onClick={() => setAbierta(abierta === v.id ? null : v.id)}>
                  <td className="cell-title">{formatDate(v.fecha)}</td>
                  <td data-label="Cliente">{v.cliente || '—'}</td>
                  <td className="num" data-label="Productos">{v.items.length}</td>
                  <td className="num" data-label="Total">{money(v.total)}</td>
                  <td className="num" data-label="Ganancia">{money(v.total - (v.costo || 0))}</td>
                  <td className="row-actions">
                    <button
                      className="btn-icon danger"
                      title="Anular"
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminar(v);
                      }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
                {abierta === v.id && (
                  <tr className="detail-row">
                    <td colSpan={6}>
                      <ul className="detail-list">
                        {v.items.map((i) => (
                          <li key={i.productoId}>
                            <span>{num(i.cantidad)} × {i.nombre}</span>
                            <span>{money(i.precioUnitario)} c/u = {money(i.cantidad * i.precioUnitario)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!ventas.length && (
              <tr>
                <td colSpan={6} className="empty">Todavía no hay ventas registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
