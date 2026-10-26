import { useState } from 'react';
import { generarCodigo } from '../data/codigos.js';

const EMPTY = {
  codigo: '',
  nombre: '',
  categoria: '',
  unidad: 'unidad',
  proveedor: '',
  precioCompra: '',
  precioVenta: '',
  stock: '',
  stockMinimo: '',
};

export default function ProductForm({ initial, productos, categorias, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  // Producto nuevo: automático por defecto. Al editar se conserva el código que ya tiene.
  const [codigoAuto, setCodigoAuto] = useState(!initial.id || !initial.codigo);
  const codigoPreview = generarCodigo(form.categoria, productos, initial.id);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const margen =
    Number(form.precioCompra) > 0
      ? ((Number(form.precioVenta) - Number(form.precioCompra)) / Number(form.precioCompra)) * 100
      : null;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...form, codigoAuto });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="form">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-grid">
        <div className="field">
          <div className="field-label">
            Código
            <div className="segmented" role="group" aria-label="Tipo de código">
              <button type="button" className={codigoAuto ? 'active' : ''} onClick={() => setCodigoAuto(true)}>
                Automático
              </button>
              <button type="button" className={!codigoAuto ? 'active' : ''} onClick={() => setCodigoAuto(false)}>
                Manual
              </button>
            </div>
          </div>
          {codigoAuto ? (
            <>
              <input value={codigoPreview} disabled />
              <small className="muted">Según la categoría. Se asigna al guardar.</small>
            </>
          ) : (
            <input value={form.codigo} onChange={set('codigo')} placeholder="Ej. MAR-001" />
          )}
        </div>
        <label className="span-2">
          Nombre *
          <input value={form.nombre} onChange={set('nombre')} required autoFocus />
        </label>
        <label>
          Categoría
          <input value={form.categoria} onChange={set('categoria')} list="categorias" placeholder="General" />
          <datalist id="categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          Unidad
          <input value={form.unidad} onChange={set('unidad')} placeholder="unidad, kg, metro…" />
        </label>
        <label>
          Proveedor
          <input value={form.proveedor} onChange={set('proveedor')} />
        </label>
        <label>
          Precio de compra
          <input type="number" min="0" step="any" value={form.precioCompra} onChange={set('precioCompra')} />
        </label>
        <label>
          Precio de venta
          <input type="number" min="0" step="any" value={form.precioVenta} onChange={set('precioVenta')} />
          {margen !== null && <small className="muted">Margen: {margen.toFixed(1)}%</small>}
        </label>
        <label>
          Stock actual
          <input type="number" step="any" value={form.stock} onChange={set('stock')} />
        </label>
        <label>
          Stock mínimo
          <input type="number" min="0" step="any" value={form.stockMinimo} onChange={set('stockMinimo')} />
          <small className="muted">Si el stock baja de aquí, aparece en faltantes.</small>
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
