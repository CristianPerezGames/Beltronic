import { useRef, useState } from 'react';
import { useData } from '../data/DataContext.jsx';
import { crearDatosEjemplo } from '../data/sampleData.js';
import { downloadFile, num, today } from '../utils/format.js';

export default function Ajustes() {
  const { productos, proveedores, compras, ventas, actions, storageName, isLocal } = useData();
  const [mensaje, setMensaje] = useState(null);
  const fileRef = useRef(null);

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
    </section>
  );
}
