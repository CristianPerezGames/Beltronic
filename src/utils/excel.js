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
