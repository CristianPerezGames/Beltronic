// Códigos automáticos: 3 letras de la categoría + consecutivo. Ej. "Herramientas" -> HER-001.

export function prefijoCategoria(categoria) {
  const letras = (categoria || 'General')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  return (letras + 'XXX').slice(0, 3);
}

// excluirId: al editar, el propio producto no cuenta para el consecutivo.
export function generarCodigo(categoria, productos, excluirId = null) {
  const prefijo = prefijoCategoria(categoria);
  const patron = new RegExp(`^${prefijo}-(\\d+)$`);
  const mayor = productos
    .filter((p) => p.id !== excluirId)
    .reduce((max, p) => {
      const m = patron.exec(p.codigo || '');
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
  return `${prefijo}-${String(mayor + 1).padStart(3, '0')}`;
}
