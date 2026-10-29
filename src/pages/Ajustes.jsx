import { useRef, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { crearDatosEjemplo } from '../data/sampleData.js';
import { mismoCodigo, mismoNombre, normalizar } from '../data/coincidencias.js';
import Modal from '../components/Modal.jsx';
import { leerExcel, numeroExcel } from '../utils/excel.js';
import { downloadFile, money, num, today } from '../utils/format.js';

// Columnas del Excel de inventario (normalizadas, sin puntos):
// Item, Código, Proveedor, Nombre producto, Cantidad, Vr. Unitario, Valor Impto.Cargo, Vr. Total, Valor por Unidad
const COL = {
  codigo: 'codigo',
  nombre: 'nombre producto',
  proveedor: 'proveedor',
  cantidad: 'cantidad',
  valorUnidad: 'valor por unidad',
  vrUnitario: 'vr unitario',
};

// Busca cada fila en los productos: primero por código y, si no aparece, por nombre exacto.
// Las filas que no existen se preparan como productos nuevos (las repetidas en el archivo se juntan).
function cruzarInventario(filas, productos) {
  const encontrados = [];
  const nuevos = [];
  const ignorados = [];
  for (const fila of filas) {
    const codigo = String(fila[COL.codigo] ?? '').trim();
    const nombre = String(fila[COL.nombre] ?? '').trim();
    const cantidad = numeroExcel(fila[COL.cantidad]);
    const costo = numeroExcel(fila[COL.valorUnidad]) || numeroExcel(fila[COL.vrUnitario]);
    const coincide = (p) => (codigo && mismoCodigo(p.codigo, codigo)) || mismoNombre(p.nombre, nombre);
    const producto =
      (codigo && productos.find((p) => mismoCodigo(p.codigo, codigo))) ||
      (nombre && productos.find((p) => mismoNombre(p.nombre, nombre)));
    if (!(cantidad > 0)) {
      ignorados.push({ fila: fila.filaExcel, codigo, nombre, motivo: 'Cantidad inválida' });
    } else if (producto) {
      encontrados.push({ producto, cantidad, costo });
    } else if (!nombre) {
      ignorados.push({ fila: fila.filaExcel, codigo, nombre, motivo: 'No existe y no tiene nombre para crearlo' });
    } else {
      const previo = nuevos.find(coincide);
      if (previo) {
        previo.stock += cantidad;
        previo.precioCompra = costo || previo.precioCompra;
      } else {
        const proveedor = String(fila[COL.proveedor] ?? '').trim();
        nuevos.push({ codigo, nombre, proveedor, stock: cantidad, precioCompra: costo, codigoAuto: !codigo });
      }
    }
  }
  return { encontrados, nuevos, ignorados };
}

export default function Ajustes() {
  const { productos, proveedores, compras, ventas, actions, storageName, isLocal } = useData();
  const [mensaje, setMensaje] = useState(null);
  const fileRef = useRef(null);
  const excelRef = useRef(null);
  const [inventario, setInventario] = useState(null);
  const [aplicando, setAplicando] = useState(false);

  const ejecutar = async (fn, ok) => {
    try {
      await fn();
      setMensaje({ tipo: 'ok', texto: ok });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    }
  };

  const exportar = () =>
    ejecutar(async () => {
      const data = await actions.exportarTodo();
      downloadFile(`beltronic-respaldo-${today()}.json`, JSON.stringify(data, null, 2));
    }, 'Respaldo descargado.');

  const importar = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('Importar reemplazará TODOS los datos actuales. ¿Continuar?')) return;
    ejecutar(async () => {
      const data = JSON.parse(await file.text());
      await actions.importarTodo(data);
    }, 'Datos importados correctamente.');
  };

  const leerInventario = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const filas = await leerExcel(file, [COL.codigo, COL.cantidad], normalizar);
      const resultado = cruzarInventario(filas, productos);
      if (!resultado.encontrados.length && !resultado.nuevos.length) {
        setMensaje({ tipo: 'error', texto: `El archivo no tiene filas válidas para agregar (${filas.length} filas revisadas).` });
        return;
      }
      setMensaje(null);
      setInventario({ archivo: file.name, ...resultado });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  };

  const aplicarInventario = async () => {
    const { encontrados, nuevos, ignorados } = inventario;
    setAplicando(true);
    await ejecutar(
      () =>
        actions.agregarInventario({
          lineas: encontrados.map((e) => ({ productoId: e.producto.id, cantidad: e.cantidad, costoUnitario: e.costo })),
          nuevos,
        }),
      `Inventario actualizado: ${encontrados.length} con stock sumado, ${nuevos.length} productos nuevos` +
        (ignorados.length ? `, ${ignorados.length} ignoradas.` : '.'),
    );
    setAplicando(false);
    setInventario(null);
  };

  const cargarEjemplo = () => {
    if (productos.length && !confirm('Esto reemplazará los datos actuales por datos de ejemplo. ¿Continuar?')) return;
    ejecutar(() => actions.importarTodo(crearDatosEjemplo()), 'Datos de ejemplo cargados.');
  };

  const borrar = () => {
    if (!confirm('¿Borrar TODOS los productos, proveedores, compras y ventas? Esta acción no se puede deshacer.')) return;
    ejecutar(() => actions.borrarTodo(), 'Todos los datos fueron borrados.');
  };

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>Datos y respaldo</h1>
          <p className="muted">Dónde se guarda la información y cómo respaldarla.</p>
        </div>
      </header>

      {mensaje && (
        <div className={`alert ${mensaje.tipo === 'error' ? 'alert-error' : 'alert-ok'}`}>{mensaje.texto}</div>
      )}

      <div className="grid-2">
        <div className="card">
          <h2>Almacenamiento</h2>
          <p>
            Actualmente: <strong>{storageName}</strong>
          </p>
          <ul className="detail-list">
            <li><span>Productos</span><span>{num(productos.length)}</span></li>
            <li><span>Proveedores</span><span>{num(proveedores.length)}</span></li>
            <li><span>Compras</span><span>{num(compras.length)}</span></li>
            <li><span>Ventas</span><span>{num(ventas.length)}</span></li>
          </ul>
          {isLocal ? (
            <p className="muted small">
              Los datos viven solo en este navegador y en este equipo. Si borras los datos del navegador
              se pierden, así que descarga respaldos con frecuencia. Para usar una base de datos, configura
              <code> VITE_STORAGE</code> en el archivo <code>.env</code> (ver README).
            </p>
          ) : (
            <p className="muted small">Los datos se guardan en una base de datos remota.</p>
          )}
        </div>

        <div className="card">
          <h2>Respaldo</h2>
          <p className="muted small">
            El respaldo es un archivo JSON con todo. También sirve para migrar los datos locales a una base
            de datos: exporta aquí, cambia el almacenamiento e importa el archivo.
          </p>
          <div className="actions">
            <button className="btn btn-primary" onClick={exportar}>Descargar respaldo</button>
            <button className="btn btn-secondary" onClick={() => fileRef.current.click()}>Importar respaldo</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importar} />
          </div>
        </div>

        <div className="card">
          <h2>Agregar inventario desde Excel</h2>
          <p className="muted small">
            Suma al stock las cantidades de un archivo .xlsx con las columnas Item, Código, Proveedor, Nombre
            producto, Cantidad, Vr. Unitario, Valor Impto.Cargo, Vr. Total y Valor por Unidad. El precio de compra
            se actualiza con el Valor por Unidad. Los productos que no existen se crean como nuevos.
          </p>
          <button className="btn btn-secondary" onClick={() => excelRef.current.click()}>Cargar Excel</button>
          <input
            ref={excelRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={leerInventario}
          />
        </div>

        <div className="card">
          <h2>Datos de ejemplo</h2>
          <p className="muted small">Carga un inventario de ferretería con compras y ventas de los últimos meses para probar.</p>
          <button className="btn btn-secondary" onClick={cargarEjemplo}>Cargar datos de ejemplo</button>
        </div>

        <div className="card card-danger">
          <h2>Zona de peligro</h2>
          <p className="muted small">Elimina todos los productos, proveedores, compras y ventas.</p>
          <button className="btn btn-danger" onClick={borrar}>Borrar todos los datos</button>
        </div>
      </div>

      {inventario && (
        <Modal title="Agregar inventario" wide onClose={() => !aplicando && setInventario(null)}>
          <p className="muted small">
            {inventario.archivo}: {inventario.encontrados.length} existentes, {inventario.nuevos.length} nuevos
            {inventario.ignorados.length > 0 && `, ${inventario.ignorados.length} ignoradas`}.
          </p>
          {inventario.encontrados.length > 0 && (
            <div className="table-wrap">
              <table className="table-cards">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Stock actual</th>
                    <th className="num">Cantidad</th>
                    <th className="num">Nuevo stock</th>
                    <th className="num">Precio de compra</th>
                  </tr>
                </thead>
                <tbody>
                  {inventario.encontrados.map(({ producto: p, cantidad, costo }, i) => (
                    <tr key={i}>
                      <td className="cell-title">
                        {p.nombre}
                        {p.codigo && <div className="muted small">{p.codigo}</div>}
                      </td>
                      <td className="num" data-label="Stock actual">{num(p.stock)}</td>
                      <td className="num" data-label="Cantidad">+{num(cantidad)}</td>
                      <td className="num" data-label="Nuevo stock">{num(Number(p.stock) + cantidad)}</td>
                      <td className="num" data-label="Precio de compra">{money(costo || p.precioCompra)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {inventario.nuevos.length > 0 && (
            <>
              <h3>Productos nuevos</h3>
              <div className="table-wrap">
                <table className="table-cards">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Proveedor</th>
                      <th className="num">Stock inicial</th>
                      <th className="num">Precio de compra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.nuevos.map((p, i) => (
                      <tr key={i}>
                        <td className="cell-title">
                          {p.nombre}
                          <div className="muted small">{p.codigo || 'Código automático'}</div>
                        </td>
                        <td data-label="Proveedor">{p.proveedor || '—'}</td>
                        <td className="num" data-label="Stock inicial">{num(p.stock)}</td>
                        <td className="num" data-label="Precio de compra">{money(p.precioCompra)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {inventario.ignorados.length > 0 && (
            <>
              <h3>Ignoradas</h3>
              <ul className="detail-list">
                {inventario.ignorados.map((x, i) => (
                  <li key={i}>
                    <span>
                      Fila {x.fila}: {x.codigo && `${x.codigo} · `}{x.nombre || 'Sin nombre'}
                    </span>
                    <span className="muted small">{x.motivo}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setInventario(null)} disabled={aplicando}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={aplicarInventario} disabled={aplicando}>
              {aplicando ? 'Agregando…' : `Agregar al inventario (${inventario.encontrados.length + inventario.nuevos.length})`}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
