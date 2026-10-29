import { useState } from 'react';
import { useData } from './data/DataContext.jsx';
import { faltantes } from './data/stats.js';
import Resumen from './pages/Resumen.jsx';
import Inventario from './pages/Inventario.jsx';
import Proveedores from './pages/Proveedores.jsx';
import Compras from './pages/Compras.jsx';
import Ventas from './pages/Ventas.jsx';
import Faltantes from './pages/Faltantes.jsx';
import Ajustes from './pages/Ajustes.jsx';

const PAGES = [
  { id: 'resumen', label: 'Resumen y estadísticas', icon: '📊' },
  { id: 'inventario', label: 'Inventario', icon: '📦' },
  { id: 'proveedores', label: 'Proveedores', icon: '🏭' },
  { id: 'compras', label: 'Compras', icon: '🚚' },
  { id: 'ventas', label: 'Ventas', icon: '🧾' },
  { id: 'faltantes', label: 'Faltantes', icon: '⚠️' },
  { id: 'ajustes', label: 'Datos y respaldo', icon: '⚙️' },
];

export default function App() {
  const { productos, loading, error, storageName, isLocal, refresh } = useData();
  const [actualizando, setActualizando] = useState(false);
  const [page, setPage] = useState('resumen');
  const [menuOpen, setMenuOpen] = useState(false);
  // Si no existe public/logo.png se muestra el emoji.
  const [logoOk, setLogoOk] = useState(true);
  // Proveedor e items precargados al crear una compra desde la página de faltantes.
  const [compraPrefill, setCompraPrefill] = useState(null);

  const numFaltantes = faltantes(productos).length;

  const navigate = (id) => {
    setPage(id);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  // Trae los cambios hechos desde otros equipos.
  const actualizar = async () => {
    setActualizando(true);
    await refresh();
    setActualizando(false);
  };

  const comprarFaltantes = (prefill) => {
    setCompraPrefill(prefill);
    navigate('compras');
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        {logoOk ? (
          <div className="brand brand-with-logo">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Beltronic" className="brand-logo" onError={() => setLogoOk(false)} />
            <small>{storageName}</small>
          </div>
        ) : (
          <div className="brand">
            <span className="brand-icon">🔧</span>
            <div>
              <strong>Beltronic</strong>
              <small>{storageName}</small>
            </div>
          </div>
        )}
        <nav>
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={`nav-item ${page === p.id ? 'active' : ''}`}
              onClick={() => navigate(p.id)}
            >
              <span>{p.icon}</span>
              {p.label}
              {p.id === 'faltantes' && numFaltantes > 0 && (
                <span className="nav-badge">{numFaltantes}</span>
              )}
            </button>
          ))}
        </nav>
        {!isLocal && (
          <button className="nav-item sync-btn" onClick={actualizar} disabled={actualizando}>
            <span>↻</span>
            {actualizando ? 'Actualizando…' : 'Actualizar datos'}
          </button>
        )}
      </aside>

      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <main className="content">
        <div className="mobile-bar">
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menú">
            ☰
          </button>
          <strong>{PAGES.find((p) => p.id === page)?.label}</strong>
          {numFaltantes > 0 && (
            <button className="nav-badge" onClick={() => navigate('faltantes')} title="Faltantes">
              ⚠ {numFaltantes}
            </button>
          )}
        </div>
        {error && <div className="alert alert-error">Error al cargar los datos: {error}</div>}
        {loading ? (
          <p className="muted">Cargando…</p>
        ) : (
          <>
            {page === 'resumen' && <Resumen onNavigate={navigate} />}
            {page === 'inventario' && <Inventario />}
            {page === 'proveedores' && <Proveedores />}
            {page === 'compras' && (
              <Compras prefill={compraPrefill} onPrefillUsed={() => setCompraPrefill(null)} />
            )}
            {page === 'ventas' && <Ventas />}
            {page === 'faltantes' && <Faltantes onComprar={comprarFaltantes} />}
            {page === 'ajustes' && <Ajustes />}
          </>
        )}
      </main>
    </div>
  );
}
