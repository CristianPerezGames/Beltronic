import { useEffect, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import ItemsEditor from '../components/ItemsEditor.jsx';
import { money, num, today, formatDate } from '../utils/format.js';
import { exportarExcel, fechaExcel } from '../utils/excel.js';
import { compraRecibida } from '../data/services.js';

const lineaVacia = () => ({ productoId: '', cantidad: 1, costoUnitario: 0 });

export default function Compras({ prefill, onPrefillUsed }) {
  const { productos, proveedores: listaProveedores, compras, actions, historialMeses } = useData();
  const [mostrarForm, setMostrarForm] = useState(Boolean(prefill));
  const [form, setForm] = useState(() => ({
    fecha: today(),
    proveedor: prefill?.proveedor ?? '',
    factura: '',
    notas: '',
    items: prefill?.items?.length ? prefill.items : [lineaVacia()],
  }));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [editando, setEditando] = useState(null); // compra que se está editando
  const [exportando, setExportando] = useState(false);

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
    setEditando(null);
  };

  const editar = (compra) => {
    setForm({
      fecha: compra.fecha,
      proveedor: compra.proveedor || '',
      factura: compra.factura || '',
      notas: compra.notas || '',
      items: compra.items.map(({ productoId, cantidad, costoUnitario }) => ({ productoId, cantidad, costoUnitario })),
    });
    setEditando(compra);
    setError(null);
    setMostrarForm(true);
    window.scrollTo(0, 0);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editando) await actions.actualizarCompra(editando, form);
      else await actions.registrarCompra(form);
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const recibir = async (compra) => {
    if (!confirm(`¿Confirmar que llegó la compra${compra.proveedor ? ` de ${compra.proveedor}` : ''}? Se sumará al inventario.`)) return;
    try {
      await actions.recibirCompra(compra);
      if (editando?.id === compra.id) reset();
    } catch (err) {
      alert(err.message);
    }
  };

  const eliminar = async (compra) => {
    const aviso = compraRecibida(compra)
      ? '¿Eliminar esta compra? Se descontarán del stock las cantidades que ingresó.'
      : '¿Eliminar esta compra pendiente? El stock no cambia.';
    if (!confirm(aviso)) return;
    await actions.eliminarCompra(compra);
    if (editando?.id === compra.id) reset();
  };

  // Exporta una compra como lista de productos, sin costos.
  const exportar = async (compra) => {
    setExportando(true);
    try {
      const codigoDe = (id) => productos.find((p) => p.id === id)?.codigo || '';
      const unidadDe = (id) => productos.find((p) => p.id === id)?.unidad || '';
      const nombreArchivo = ['compra', compra.fecha, compra.proveedor, compra.factura]
        .filter(Boolean)
        .join('-')
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '_');
      await exportarExcel(`${nombreArchivo}.xlsx`, {
        nombre: 'Compra',
        encabezado: [
          ['Fecha', fechaExcel(compra.fecha)],
          ['Proveedor', compra.proveedor || '—'],
          ['Factura', compra.factura || '—'],
          ...(compra.notas ? [['Notas', compra.notas]] : []),
        ],
        columnas: [
          { header: 'Código', key: 'codigo', width: 12 },
          { header: 'Producto', key: 'producto', width: 40 },
          { header: 'Cantidad', key: 'cantidad', tipo: 'number', width: 11 },
          { header: 'Unidad', key: 'unidad', width: 12 },
        ],
        filas: compra.items.map((i) => ({
          codigo: codigoDe(i.productoId),
          producto: i.nombre,
          cantidad: i.cantidad,
          unidad: unidadDe(i.productoId),
        })),
      });
    } catch (err) {
      alert(`No se pudo exportar: ${err.message}`);
    } finally {
      setExportando(false);
    }
  };

  const proveedores = [...new Set([...listaProveedores.map((p) => p.nombre), ...productos.map((p) => p.proveedor)].filter(Boolean))];

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>Compras</h1>
          <p className="muted">Registra los pedidos a proveedores. El stock se suma cuando confirmas que la mercadería llegó.</p>
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
          <h2>{editando ? 'Editar compra' : 'Nueva compra'}</h2>
          <p className="muted small">
            {!editando
              ? 'Queda pendiente: el stock no cambia hasta que confirmes la llegada.'
              : compraRecibida(editando)
                ? 'Esta compra ya se recibió: el stock se ajusta según la diferencia con lo que había ingresado.'
                : 'Compra pendiente: el stock no cambia hasta que confirmes la llegada.'}
          </p>
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
              {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar compra'}
            </button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table className="table-cards">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Factura</th>
              <th className="num">Productos</th>
              <th className="num">Total</th>
              <th>Estado</th>
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
                onRecibir={() => recibir(c)}
                onEditar={() => editar(c)}
                onExportar={() => exportar(c)}
                exportando={exportando}
                onEliminar={() => eliminar(c)}
              />
            ))}
            {!compras.length && (
              <tr>
                <td colSpan={7} className="empty">Todavía no hay compras registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompraRow({ compra, abierta, onToggle, onRecibir, onEditar, onExportar, exportando, onEliminar }) {
  return (
    <>
      <tr className="clickable" onClick={onToggle}>
        <td className="cell-title">{formatDate(compra.fecha)}</td>
        <td data-label="Proveedor">{compra.proveedor || '—'}</td>
        <td data-label="Factura">{compra.factura || '—'}</td>
        <td className="num" data-label="Productos">{compra.items.length}</td>
        <td className="num" data-label="Total">{money(compra.total)}</td>
        <td data-label="Estado">
          {compraRecibida(compra) ? (
            <span className="badge badge-ok">Recibida</span>
          ) : (
            <span className="estado-pendiente">
              <span className="badge badge-warn">Pendiente</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRecibir();
                }}
              >
                Confirmar llegada
              </button>
            </span>
          )}
        </td>
        <td className="row-actions">
          <button
            className="btn-icon"
            title="Exportar a Excel"
            disabled={exportando}
            onClick={(e) => {
              e.stopPropagation();
              onExportar();
            }}
          >
            📥
          </button>
          <button
            className="btn-icon"
            title="Editar"
            onClick={(e) => {
              e.stopPropagation();
              onEditar();
            }}
          >
            ✎
          </button>
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
          <td colSpan={7}>
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
