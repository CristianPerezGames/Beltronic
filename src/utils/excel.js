import { downloadFile } from './format.js';

// Genera un .xlsx de una hoja (lo abren Excel, Google Sheets y LibreOffice).
// encabezado: filas [etiqueta, valor] que van arriba de la tabla (opcional).
// columnas: [{ header, key, width, tipo?: 'money' | 'number' | 'date' }]
// La librería se carga solo al exportar para no agrandar la app.
export async function exportarExcel(nombreArchivo, { nombre, encabezado = [], columnas, filas }) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Beltronic';
  const ws = wb.addWorksheet(nombre);

  ws.columns = columnas.map(({ key, width }) => ({ key, width: width || 14 }));
  for (const [etiqueta, valor] of encabezado) {
    const row = ws.addRow([etiqueta, valor]);
    row.getCell(1).font = { bold: true };
    if (valor instanceof Date) row.getCell(2).numFmt = FORMATOS.date;
    row.getCell(2).alignment = { horizontal: 'left' };
  }
  if (encabezado.length) ws.addRow([]);

  const header = ws.addRow(columnas.map((c) => c.header));
  header.font = { bold: true };
  for (const fila of filas) {
    const row = ws.addRow(fila);
    columnas.forEach((c, i) => {
      if (FORMATOS[c.tipo]) row.getCell(i + 1).numFmt = FORMATOS[c.tipo];
    });
  }
  ws.views = [{ state: 'frozen', ySplit: header.number }];

  const buffer = await wb.xlsx.writeBuffer();
  downloadFile(nombreArchivo, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

const FORMATOS = { money: '#,##0.00', number: '#,##0.##', date: 'dd/mm/yyyy' };

// Fecha 'AAAA-MM-DD' como Date, para que la hoja la trate como fecha y no como texto.
// Va en UTC porque así la escribe la librería; en hora local podría correrse un día.
export const fechaExcel = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

// Lee la primera hoja de un .xlsx y devuelve sus filas como objetos { encabezado: valor }.
// La fila de encabezados es la primera (entre las 10 primeras) que tiene todas las columnas requeridas;
// así funciona aunque el archivo traiga un título o datos de la factura arriba de la tabla.
// Los encabezados se comparan con normalizar(), sin mayúsculas, tildes ni puntos.
export async function leerExcel(file, requeridas, normalizar) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('No se pudo leer el archivo. Debe ser un Excel .xlsx');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('El archivo no tiene hojas');

  const clave = (v) => normalizar(String(valorCelda(v) ?? '')).replace(/\./g, '');
  let columnas = null;
  let inicio = 0;
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !columnas; r++) {
    const valores = ws.getRow(r).values.map(clave);
    if (requeridas.every((c) => valores.includes(c))) {
      columnas = valores;
      inicio = r + 1;
    }
  }
  if (!columnas) throw new Error(`No se encontraron las columnas: ${requeridas.join(', ')}`);

  const filas = [];
  for (let r = inicio; r <= ws.rowCount; r++) {
    const valores = ws.getRow(r).values;
    const fila = {};
    columnas.forEach((c, i) => c && (fila[c] = valorCelda(valores[i])));
    if (Object.values(fila).some((v) => v !== null && v !== '')) filas.push({ ...fila, filaExcel: r });
  }
  return filas;
}

// Valor simple de una celda: las fórmulas dan su resultado y el texto con formato, su texto.
function valorCelda(v) {
  if (v == null) return null;
  if (typeof v !== 'object' || v instanceof Date) return v;
  if ('result' in v) return valorCelda(v.result);
  if (v.richText) return v.richText.map((t) => t.text).join('');
  if ('text' in v) return v.text;
  return null;
}

// Número de una celda que puede venir como texto: "1.234,50", "$ 1,234.50", "12".
// El último separador que aparece se toma como decimal si le siguen 1 o 2 dígitos.
export function numeroExcel(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const sep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  const decimales = sep >= 0 ? s.length - sep - 1 : 0;
  if (sep >= 0 && decimales > 0 && decimales <= 2) {
    s = s.slice(0, sep).replace(/[.,]/g, '') + '.' + s.slice(sep + 1);
  } else {
    s = s.replace(/[.,]/g, '');
  }
  return Number(s) || 0;
}
