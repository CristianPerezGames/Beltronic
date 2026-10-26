import { useEffect, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import ItemsEditor from '../components/ItemsEditor.jsx';
import { money, num, today, formatDate } from '../utils/format.js';

const lineaVacia = () => ({ productoId: '', cantidad: 1, costoUnitario: 0 });

export default function Compras({ prefill, onPrefillUsed }) {
  const { productos, compras, actions, historialMeses } = useData();
  const [mostrarForm, setMostrarForm] = useState(Boolean(prefill));
  const [form, setForm] = useState(() => ({
    fecha: today(),
    proveedor: '',
    factura: '',
    notas: '',
    items: prefill?.length ? prefill : [lineaVacia()],
  }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    if (prefill) onPrefillUsed();
    // Solo al montar: el prefill ya se copió al estado inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const reset = () => {
    setForm({ fecha: today(), proveedor: '', factura: '', notas: '', items: [lineaVacia()] });
    setError(null);
    setMostrarForm(false);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await actions.registrarCompra(form);
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (compra) => {
    if (!confirm('¿Eliminar esta compra? Se descontarán del stock las cantidades que ingresó.')) return;
    await actions.eliminarCompra(compra);
  };

  const proveedores = [...new Set(productos.map((p) => p.proveedor).filter(Boolean))];

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>Compras</h1>
          <p className="muted">Registra la mercancía que entra. El stock se suma automáticamente.</p>
          <p className="muted small">Se muestran los últimos {historialMeses} meses. El respaldo incluye todo el historial.</p>
        </div>
        {!mostrarForm && (
          <button className="btn btn-primary" onClick={() => setMostrarForm(true)} disabled={!productos.length}>
            + Registrar compra
          </button>
        )}
      </header>

      {!productos.length && (
        <div className="alert">Primero crea productos en el inventario para poder registrar compras.</div>
      )}

      {mostrarForm && (
        <form className="card form" onSubmit={guardar}>
          <h2>Nueva compra</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-grid">
            <label>
              Fecha
              <input type="date" value={form.fecha} onChange={set('fecha')} required />
            </label>
            <label>
              Proveedor
              <input value={form.proveedor} onChange={set('proveedor')} list="proveedores" />
              <datalist id="proveedores">
                {proveedores.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <label>
              N.º factura
              <input value={form.factura} onChange={set('factura')} />
            </label>
            <label className="span-3">
              Notas
              <input value={form.notas} onChange={set('notas')} />
            </label>
          </div>
          <ItemsEditor
            items={form.items}
            onChange={(items) => setForm({ ...form, items })}
            productos={productos}
            priceKey="costoUnitario"
            priceLabel="Costo unit."
            defaultPrice={(p) => p.precioCompra}
          />
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar compra'}
            </button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Factura</th>
              <th className="num">Productos</th>
              <th className="num">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <CompraRow
                key={c.id}
                compra={c}
                abierta={abierta === c.id}
                onToggle={() => setAbierta(abierta === c.id ? null : c.id)}
                onEliminar={() => eliminar(c)}
              />
            ))}
            {!compras.length && (
              <tr>
                <td colSpan={6} className="empty">Todavía no hay compras registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompraRow({ compra, abierta, onToggle, onEliminar }) {
  return (
    <>
      <tr className="clickable" onClick={onToggle}>
        <td>{formatDate(compra.fecha)}</td>
        <td>{compra.proveedor || '—'}</td>
        <td>{compra.factura || '—'}</td>
        <td className="num">{compra.items.length}</td>
        <td className="num">{money(compra.total)}</td>
        <td className="row-actions">
          <button
            className="btn-icon danger"
            title="Eliminar"
            onClick={(e) => {
              e.stopPropagation();
              onEliminar();
            }}
          >
            🗑
          </button>
        </td>
      </tr>
      {abierta && (
        <tr className="detail-row">
          <td colSpan={6}>
            <ul className="detail-list">
              {compra.items.map((i) => (
                <li key={i.productoId}>
                  <span>{num(i.cantidad)} × {i.nombre}</span>
                  <span>{money(i.costoUnitario)} c/u = {money(i.cantidad * i.costoUnitario)}</span>
                </li>
              ))}
            </ul>
            {compra.notas && <p className="muted small">Notas: {compra.notas}</p>}
          </td>
        </tr>
      )}
    </>
  );
}
