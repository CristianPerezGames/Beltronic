import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useData } from '../data/DataContext.jsx';
import StatCard from '../components/StatCard.jsx';
import { faltantes, masVendidos, porMes, resumenInventario, totalesMes, valorPorCategoria } from '../data/stats.js';
import { money, num, monthLabel } from '../utils/format.js';

const COLORS = { ventas: '#2563eb', compras: '#f59e0b', ganancia: '#16a34a', categoria: '#6366f1' };

export default function Resumen({ onNavigate }) {
  const { productos, compras, ventas } = useData();
  const [meses, setMeses] = useState(6);

  const inv = useMemo(() => resumenInventario(productos), [productos]);
  const mes = useMemo(() => totalesMes(compras, ventas), [compras, ventas]);
  const serie = useMemo(
    () => porMes(compras, ventas, meses).map((r) => ({ ...r, label: monthLabel(r.mes) })),
    [compras, ventas, meses],
  );
  const top = useMemo(() => masVendidos(ventas), [ventas]);
  const categorias = useMemo(() => valorPorCategoria(productos), [productos]);
  const urgentes = useMemo(() => faltantes(productos).slice(0, 5), [productos]);

  if (!productos.length) {
    return (
      <section>
        <h1>Bienvenido a Beltronic</h1>
        <div className="card empty-state">
          <span className="empty-icon">🔧</span>
          <p>Aún no hay productos. Empieza agregando tu inventario o carga datos de ejemplo para explorar.</p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => onNavigate('inventario')}>Ir al inventario</button>
            <button className="btn btn-secondary" onClick={() => onNavigate('ajustes')}>Cargar datos de ejemplo</button>
          </div>
        </div>
      </section>
    );
  }

  const tooltipMoney = (v) => money(v);

  return (
    <section>
      <header className="page-header">
        <div>
          <h1>Resumen y estadísticas</h1>
          <p className="muted">Estado del inventario y movimiento del mes actual.</p>
        </div>
      </header>

      <div className="stats-grid">
        <StatCard label="Ventas del mes" value={money(mes.ventas)} hint={`${num(mes.numVentas)} ventas`} tone="blue" />
        <StatCard label="Ganancia del mes" value={money(mes.ganancia)} hint={mes.ventas ? `${((mes.ganancia / mes.ventas) * 100).toFixed(0)}% de margen` : 'Sin ventas'} tone="green" />
        <StatCard label="Compras del mes" value={money(mes.compras)} hint={`${num(mes.numCompras)} compras`} tone="amber" />
        <StatCard label="Valor del inventario" value={money(inv.valorCosto)} hint={`${money(inv.valorVenta)} a precio de venta`} />
        <StatCard label="Productos" value={num(inv.totalProductos)} hint={`${num(inv.unidades)} unidades en stock`} />
        <StatCard label="Faltantes" value={num(inv.faltantes)} hint={`${num(inv.agotados)} agotados`} tone={inv.faltantes ? 'red' : undefined} />
      </div>

      <div className="grid-2">
        <div className="card chart-card span-2">
          <div className="card-header">
            <h2>Ventas vs. compras</h2>
            <select value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => num(v)} width={70} />
              <Tooltip formatter={tooltipMoney} />
              <Legend />
              <Bar dataKey="ventas" name="Ventas" fill={COLORS.ventas} radius={[4, 4, 0, 0]} />
              <Bar dataKey="compras" name="Compras" fill={COLORS.compras} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h2>Ganancia por mes</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v) => num(v)} width={70} />
              <Tooltip formatter={tooltipMoney} />
              <Line type="monotone" dataKey="ganancia" name="Ganancia" stroke={COLORS.ganancia} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h2>Valor del inventario por categoría</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categorias} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => num(v)} />
              <YAxis type="category" dataKey="categoria" width={130} tick={{ fontSize: 12 }} />
              <Tooltip formatter={tooltipMoney} />
              <Bar dataKey="valor" name="Valor" fill={COLORS.categoria} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Más vendidos</h2>
          {top.length ? (
            <ol className="rank-list">
              {top.map((t) => (
                <li key={t.nombre}>
                  <span>{t.nombre}</span>
                  <span className="muted">{num(t.cantidad)} u · {money(t.total)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Aún no hay ventas.</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Reponer pronto</h2>
            {urgentes.length > 0 && (
              <button className="btn-link" onClick={() => onNavigate('faltantes')}>Ver todos →</button>
            )}
          </div>
          {urgentes.length ? (
            <ul className="rank-list">
              {urgentes.map((p) => (
                <li key={p.id}>
                  <span>{p.nombre}</span>
                  <span className={p.stock <= 0 ? 'text-danger' : 'text-warn'}>
                    {num(p.stock)} / mín. {num(p.stockMinimo)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Todo el inventario está por encima del mínimo ✅</p>
          )}
        </div>
      </div>
    </section>
  );
}
