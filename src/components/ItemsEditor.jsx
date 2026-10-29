import { useState } from 'react';
import { money, num } from '../utils/format.js';
import ProductPicker from './ProductPicker.jsx';

// Editor de líneas de productos, compartido por compras y ventas.
// priceKey: campo del precio en cada línea ('costoUnitario' o 'precioUnitario').
export default function ItemsEditor({ items, onChange, productos, priceKey, priceLabel, defaultPrice, showStock }) {
  const update = (index, changes) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const selectProducto = (index, productoId) => {
    const p = productos.find((x) => x.id === productoId);
    update(index, { productoId, [priceKey]: p ? defaultPrice(p) : 0 });
  };

  // Línea recién agregada con el botón: su buscador recibe el foco.
  const [focusIndex, setFocusIndex] = useState(null);
  const add = () => {
    setFocusIndex(items.length);
    onChange([...items, { productoId: '', cantidad: 1, [priceKey]: 0 }]);
  };
  const remove = (index) => onChange(items.filter((_, i) => i !== index));

  const total = items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i[priceKey]) || 0), 0);

  return (
    <div className="items-editor">
      <div className="table-wrap">
        <table className="table-cards">
          <thead>
            <tr>
              <th>Producto</th>
              {showStock && <th className="num">Disponible</th>}
              <th className="num">Cantidad</th>
              <th className="num">{priceLabel}</th>
              <th className="num">Subtotal</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const p = productos.find((x) => x.id === item.productoId);
              const sinStock = showStock && p && Number(item.cantidad) > p.stock;
              return (
                <tr key={index}>
                  <td className="picker-cell cell-title">
                    <ProductPicker
                      productos={productos}
                      value={item.productoId}
                      onChange={(id) => selectProducto(index, id)}
                      autoFocus={index === focusIndex}
                      showStock
                    />
                  </td>
                  {showStock && (
                    <td className="num" data-label="Disponible">{p ? `${num(p.stock)} ${p.unidad}` : '—'}</td>
                  )}
                  <td className="num" data-label="Cantidad">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      className={`input-num ${sinStock ? 'invalid' : ''}`}
                      value={item.cantidad}
                      onChange={(e) => update(index, { cantidad: e.target.value })}
                      required
                    />
                  </td>
                  <td className="num" data-label={priceLabel}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="input-num"
                      value={item[priceKey]}
                      onChange={(e) => update(index, { [priceKey]: e.target.value })}
                    />
                  </td>
                  <td className="num" data-label="Subtotal">
                    {money((Number(item.cantidad) || 0) * (Number(item[priceKey]) || 0))}
                  </td>
                  <td className="row-actions">
                    <button type="button" className="btn-icon" onClick={() => remove(index)} title="Quitar">
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="items-footer">
        <button type="button" className="btn btn-secondary" onClick={add}>
          + Agregar producto
        </button>
        <span className="items-total">
          Total: <strong>{money(total)}</strong>
        </span>
      </div>
    </div>
  );
}
