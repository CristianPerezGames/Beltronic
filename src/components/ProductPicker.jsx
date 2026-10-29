import { useEffect, useMemo, useRef, useState } from 'react';
import { num } from '../utils/format.js';

const MAX_RESULTADOS = 30;

const normalizar = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Cada palabra escrita debe aparecer en el código, nombre o categoría.
// Primero las coincidencias exactas de código, luego las que empiezan igual.
export function buscarProductos(productos, query) {
  const q = normalizar(query).trim();
  if (!q) return productos;
  const palabras = q.split(/\s+/);
  const puntaje = (p) => {
    const codigo = normalizar(p.codigo);
    if (codigo === q) return 0;
    if (codigo.startsWith(q)) return 1;
    if (normalizar(p.nombre).startsWith(q)) return 2;
    return 3;
  };
  return productos
    .filter((p) => {
      const texto = normalizar(`${p.codigo} ${p.nombre} ${p.categoria}`);
      return palabras.every((w) => texto.includes(w));
    })
    .sort((a, b) => puntaje(a) - puntaje(b));
}

// Campo con lupa para elegir un producto escribiendo código o nombre.
export default function ProductPicker({ productos, value, onChange, showStock, autoFocus }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = productos.find((p) => p.id === value);
  const resultados = useMemo(() => buscarProductos(productos, query), [productos, query]);
  const visibles = resultados.slice(0, MAX_RESULTADOS);

  // La lista va con position: fixed para que no la recorte la tabla (que tiene scroll).
  const abrir = () => {
    const r = inputRef.current.getBoundingClientRect();
    // En celulares la lista no debe salirse de la pantalla.
    const width = Math.min(Math.max(r.width, 340), window.innerWidth - 16);
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
    setQuery('');
    setActive(0);
    setOpen(true);
  };

  const elegir = (p) => {
    onChange(p.id);
    setOpen(false);
    inputRef.current.blur();
  };

  useEffect(() => {
    if (autoFocus) inputRef.current.focus();
  }, [autoFocus]);

  // Cerrar si se hace scroll en la página (la posición quedaría desfasada).
  useEffect(() => {
    if (!open) return;
    const cerrar = (e) => {
      if (!listRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => {
      window.removeEventListener('scroll', cerrar, true);
      window.removeEventListener('resize', cerrar);
    };
  }, [open]);

  // Mantener visible la opción marcada con el teclado.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, visibles.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // no enviar el formulario
      if (visibles[active]) elegir(visibles[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const texto = open ? query : selected ? `${selected.codigo ? `${selected.codigo} · ` : ''}${selected.nombre}` : '';

  return (
    <div className="picker">
      <span className="picker-icon" aria-hidden="true">🔍</span>
      <input
        ref={inputRef}
        value={texto}
        placeholder={selected && open ? selected.nombre : 'Buscar por código o nombre…'}
        onFocus={abrir}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && pos && (
        <ul
          ref={listRef}
          className="picker-list"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          role="listbox"
        >
          {visibles.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              className={`${i === active ? 'active' : ''} ${p.id === value ? 'selected' : ''}`}
              // onMouseDown en vez de onClick: se ejecuta antes del blur del input.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(p);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="picker-code">{p.codigo || '—'}</span>
              <span className="picker-name">{p.nombre}</span>
              {showStock && (
                <span className="picker-stock">
                  {num(p.stock)} {p.unidad}
                </span>
              )}
            </li>
          ))}
          {!visibles.length && <li className="picker-empty">Ningún producto coincide con “{query}”.</li>}
          {resultados.length > MAX_RESULTADOS && (
            <li className="picker-empty">
              {resultados.length - MAX_RESULTADOS} más… escribe más para filtrar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
