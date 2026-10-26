import { config } from '../config.js';

const moneyFormat = new Intl.NumberFormat(config.locale, {
  style: 'currency',
  currency: config.currency,
  minimumFractionDigits: config.currencyDecimals,
  maximumFractionDigits: config.currencyDecimals,
});
const numberFormat = new Intl.NumberFormat(config.locale, { maximumFractionDigits: 2 });

export const money = (n) => moneyFormat.format(Number(n) || 0);
export const num = (n) => numberFormat.format(Number(n) || 0);

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  return `${MESES[Number(m) - 1]} ${y.slice(2)}`;
}

export function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
