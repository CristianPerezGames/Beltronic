import { useMemo, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import Modal from '../components/Modal.jsx';
import { mismoNombre } from '../data/coincidencias.js';
import { num } from '../utils/format.js';

const EMPTY = { nombre: '', contacto: '', telefono: '', email: '', notas: '' };

export default function Proveedores() {
  const { proveedores, productos, actions } = useData();
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState(null); // null | 'nuevo' | proveedor

  const productosPorProveedor = useMemo(() => {
    const conteo = {};
    for (const p of productos) if (p.proveedor) conteo[p.proveedor] = (conteo[p.proveedor] || 0) + 1;
    return conteo;
  }, [productos]);

  // Nombres usados en productos que todavía no están registrados como proveedor.
  const sinRegistrar = useMemo(
    () =>
      Object.keys(productosPorProveedor)
        .filter((n) => !proveedores.some((p) => mismoNombre(p.nombre, n)))
        .sort(),
    [productosPorProveedor, proveedores],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proveedores.filter(
      (p) =>
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.contacto.toLowerCase().includes(q) ||
        p.telefono.toLowerCase().includes(q),
    );
  }, [proveedores, busqueda]);

  const guardar = async (form) => {
    if (editando === 'nuevo') await actions.crearProveedor(form);
    else await actions.actualizarProveedor(editando.id, form);
    setEditando(null);
  };

  const eliminar = async (p) => {
    const usados = productosPorProveedor[p.nombre] || 0;
    const aviso = usados ? ` ${usados} producto(s) lo tienen asignado y conservarán el nombre.` : '';
    if (!confirm(`¿Eliminar el proveedor "${p.nombre}"?${aviso}`)) return;
    await actions.eliminarProveedor(p.id);
  };

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>Proveedores</h1>
          <p className="muted">{num(proveedores.length)} proveedores registrados</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditando('nuevo')}>
          + Nuevo proveedor
        </button>
      </header>

      {sinRegistrar.length > 0 && (
        <div className="alert">
          Hay {sinRegistrar.length} proveedor(es) en tus productos que no están en la lista: {sinRegistrar.join(', ')}.{' '}
          <button className="btn-link" onClick={() => actions.registrarProveedores(sinRegistrar)}>
            Registrarlos
          </button>
        </div>
      )}

      <div className="toolbar">
        <input
          type="search"
          placeholder="Buscar por nombre, contacto o teléfono…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card table-wrap">
        <table className="table-cards">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th className="num">Productos</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td className="cell-title">
                  {p.nombre}
                  {p.notas && <div className="muted small">{p.notas}</div>}
                </td>
                <td data-label="Contacto">{p.contacto || '—'}</td>
                <td data-label="Teléfono">{p.telefono || '—'}</td>
                <td data-label="Email">{p.email || '—'}</td>
                <td className="num" data-label="Productos">{num(productosPorProveedor[p.nombre] || 0)}</td>
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
                <td colSpan={6} className="empty">
                  {proveedores.length ? 'Ningún proveedor coincide con la búsqueda.' : 'Aún no hay proveedores. Crea el primero.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal title={editando === 'nuevo' ? 'Nuevo proveedor' : 'Editar proveedor'} onClose={() => setEditando(null)}>
          <ProveedorForm
            initial={editando === 'nuevo' ? {} : editando}
            onSubmit={guardar}
            onCancel={() => setEditando(null)}
          />
        </Modal>
      )}
    </section>
  );
}

function ProveedorForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="form">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-grid">
        <label className="span-2">
          Nombre *
          <input value={form.nombre} onChange={set('nombre')} required autoFocus />
          {initial.id && form.nombre.trim() !== initial.nombre && (
            <small className="muted">Los productos de este proveedor se actualizarán con el nuevo nombre.</small>
          )}
        </label>
        <label>
          Contacto
          <input value={form.contacto} onChange={set('contacto')} placeholder="Persona de contacto" />
        </label>
        <label>
          Teléfono
          <input type="tel" value={form.telefono} onChange={set('telefono')} />
        </label>
        <label className="span-2">
          Email
          <input type="email" value={form.email} onChange={set('email')} />
        </label>
        <label className="span-3">
          Notas
          <input value={form.notas} onChange={set('notas')} placeholder="Días de entrega, condiciones de pago…" />
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
