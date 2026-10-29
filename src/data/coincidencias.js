// Detección de productos repetidos por nombre o código.
// Se compara sin mayúsculas, tildes ni espacios de más: "Martillo  Carpintero" = "martillo carpintero".

export const normalizar = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Palabras que cuentan para el parecido (se ignoran "de", "x", "1/2"…).
const palabras = (s) => normalizar(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

export const mismoNombre = (a, b) => normalizar(a) === normalizar(b) && normalizar(a) !== '';
export const mismoCodigo = (a, b) => normalizar(a) === normalizar(b) && normalizar(a) !== '';

function nombreParecido(nombre, otro) {
  const a = normalizar(nombre);
  const b = normalizar(otro);
  if (a.length < 3 || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const pa = palabras(nombre);
  const pb = new Set(palabras(otro));
  if (!pa.length) return false;
  const comunes = pa.filter((w) => pb.has(w)).length;
  return comunes >= Math.max(1, Math.ceil(Math.min(pa.length, pb.size) / 2));
}

function codigoParecido(codigo, otro) {
  const a = normalizar(codigo);
  const b = normalizar(otro);
  return a.length >= 2 && !!b && (a.includes(b) || b.includes(a));
}

// Devuelve los productos que coinciden con el nombre/código dados, los exactos primero.
// excluirId: al editar, el propio producto no cuenta.
export function buscarCoincidencias(productos, { nombre, codigo }, excluirId = null) {
  const resultado = [];
  for (const p of productos) {
    if (p.id === excluirId) continue;
    const nombreExacto = mismoNombre(nombre, p.nombre);
    const codigoExacto = mismoCodigo(codigo, p.codigo);
    const parecido = nombreParecido(nombre, p.nombre) || codigoParecido(codigo, p.codigo);
    if (nombreExacto || codigoExacto || parecido) {
      resultado.push({ producto: p, nombreExacto, codigoExacto });
    }
  }
  const peso = (c) => (c.codigoExacto || c.nombreExacto ? 0 : 1);
  return resultado.sort((a, b) => peso(a) - peso(b));
}
