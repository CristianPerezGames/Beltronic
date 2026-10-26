import { num } from '../utils/format.js';

export default function StockBadge({ producto }) {
  const { stock, stockMinimo } = producto;
  let tone = 'ok';
  if (stock <= 0) tone = 'danger';
  else if (stock <= stockMinimo) tone = 'warn';
  return <span className={`badge badge-${tone}`}>{num(stock)}</span>;
}
