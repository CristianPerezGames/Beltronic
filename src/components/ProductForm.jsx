import { useMemo, useState } from 'react';
import { generarCodigo } from '../data/codigos.js';
import { buscarCoincidencias } from '../data/coincidencias.js';
import { num } from '../utils/format.js';

const MAX_COINCIDENCIAS = 5;

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

export default function ProductForm({
  initial,
  productos,
  categorias,
  proveedores,
  onSubmit,
  onCancel,
  onEditarExistente,
  onNuevoProveedor,
}) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  // Producto nuevo: automático por defecto. Al editar se conserva el código que ya tiene.
  const [codigoAuto, setCodigoAuto] = useState(!initial.id || !initial.codigo);
  const codigoPreview = generarCodigo(form.categoria, productos, initial.id);
  const codigoFinal = codigoAuto ? codigoPreview : form.codigo;
  const coincidencias = useMemo(
    () => buscarCoincidencias(productos, { nombre: form.nombre, codigo: codigoFinal }, initial.id),
    [productos, form.nombre, codigoFinal, initial.id],
  );
  const repetido = coincidencias.find((c) => c.codigoExacto || c.nombreExacto);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  // Si el producto tiene un proveedor que no está registrado, se muestra igual para no perderlo.
  const opcionesProveedor = proveedores.map((p) => p.nombre);
  if (form.proveedor && !opcionesProveedor.includes(form.proveedor)) opcionesProveedor.unshift(form.proveedor);

  const nuevoProveedor = async () => {
    const nombre = prompt('Nombre del nuevo proveedor:')?.trim();
    if (!nombre) return;
    try {
      const { upsert } = await onNuevoProveedor({ nombre });
      setForm((f) => ({ ...f, proveedor: upsert.proveedores[0].nombre }));
    } catch (err) {
      setError(err.message);
    }
  };

  const margen =
    Number(form.precioCompra) > 0
      ? ((Number(form.precioVenta) - Number(form.precioCompra)) / Number(form.precioCompra)) * 100
      : null;

  const submit = async (e) => {
    e.preventDefault();
    if (repetido) return;
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
        {coincidencias.length > 0 && (
          <div className={`span-3 coincidencias ${repetido ? 'coincidencias-error' : ''}`}>
            <strong>
              {repetido
                ? repetido.codigoExacto
                  ? `El código ${repetido.producto.codigo} ya está en uso.`
                  : 'Ya existe un producto con este nombre.'
                : 'Productos parecidos — revisa que no esté ya registrado:'}
            </strong>
            {onEditarExistente && (
              <small>Haz clic en uno para editarlo (stock, precios, etc.) en lugar de crear otro.</small>
            )}
            <ul>
              {coincidencias.slice(0, MAX_COINCIDENCIAS).map(({ producto: p, nombreExacto, codigoExacto }) => (
                <li
                  key={p.id}
                  className={`${nombreExacto || codigoExacto ? 'exacto' : ''} ${onEditarExistente ? 'clickable' : ''}`}
                  onClick={onEditarExistente && (() => onEditarExistente(p))}
                  title={onEditarExistente ? `Editar ${p.nombre}` : undefined}
                >
                  <span className="picker-code">{p.codigo || '—'}</span>
                  <span className="picker-name">{p.nombre}</span>
                  <span className="picker-stock">
                    {num(p.stock)} {p.unidad}
                  </span>
                  {onEditarExistente && <span className="coincidencia-accion">Editar ✎</span>}
                </li>
              ))}
            </ul>
            {coincidencias.length > MAX_COINCIDENCIAS && (
              <small className="muted">y {coincidencias.length - MAX_COINCIDENCIAS} más…</small>
            )}
          </div>
        )}
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
        <div className="field">
          <div className="field-label">
            Proveedor
            {onNuevoProveedor && (
              <button type="button" className="btn-link" onClick={nuevoProveedor}>
                + Nuevo
              </button>
            )}
          </div>
          <select value={form.proveedor} onChange={set('proveedor')}>
            <option value="">— Sin proveedor —</option>
            {opcionesProveedor.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {!proveedores.length && <small className="muted">Regístralos en la sección Proveedores.</small>}
        </div>
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
        <button type="submit" className="btn btn-primary" disabled={saving || !!repetido}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
