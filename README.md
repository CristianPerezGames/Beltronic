# Beltronic

Aplicación web en React para gestionar una ferretería:

- **Inventario**: productos con código, categoría, unidad, proveedor, precios, stock y stock mínimo. Búsqueda, filtro por categoría y exportación a CSV.
- **Compras**: registra la mercancía que entra; suma el stock y actualiza el precio de compra.
- **Ventas**: registra lo que sale; valida y descuenta el stock y calcula la ganancia.
- **Faltantes**: productos en o por debajo del mínimo, con cantidad sugerida, costo estimado, pedido descargable y botón para convertirlo en compra.
- **Resumen y estadísticas**: ventas, compras y ganancia del mes, valor del inventario, gráficas por mes y por categoría, productos más vendidos.
- **Datos y respaldo**: exportar e importar todo en JSON, cargar datos de ejemplo, borrar todo.

## Uso

```bash
npm install
npm run dev
```

Abre http://localhost:5173. Por defecto los datos se guardan en el navegador (localStorage).

## Almacenamiento: local o base de datos

Las pantallas nunca hablan directamente con el almacenamiento. Usan un **adaptador** ([src/data/storage.js](src/data/storage.js)) que se elige con la variable `VITE_STORAGE`. Copia `.env.example` a `.env` y elige una opción:

| `VITE_STORAGE` | Dónde se guarda | Archivo |
|---|---|---|
| `local` (por defecto) | Navegador (localStorage) | [localAdapter.js](src/data/adapters/localAdapter.js) |
| `api` | Cualquier API REST (json-server, Node/Express, Laravel…) | [apiAdapter.js](src/data/adapters/apiAdapter.js) |
| `supabase` | PostgreSQL en Supabase | [supabaseAdapter.js](src/data/adapters/supabaseAdapter.js) |

Reinicia `npm run dev` después de cambiar el `.env`.

### Probar con un servidor local (json-server)

```bash
# Terminal 1: API REST guardando en db.json
npm run api
# Terminal 2, con VITE_STORAGE=api y VITE_API_URL=http://localhost:3001 en .env
npm run dev
```

### Supabase

1. Crea un proyecto en https://supabase.com.
2. En *SQL Editor* ejecuta [supabase/schema.sql](supabase/schema.sql).
3. En `.env` pon `VITE_STORAGE=supabase`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` (la *anon key*).

> Si ya tenías el proyecto creado antes de que existiera la sección de proveedores, ejecuta solo la parte de `proveedores` del esquema (`create table`, `enable row level security` y `create policy`).

> Las políticas del esquema dejan las tablas abiertas para empezar rápido. Antes de usarlo en serio, agrega inicio de sesión y restringe las políticas.

### Tu propio backend

Implementa estos endpoints (es lo que espera el adaptador `api`):

```
GET    /productos | /compras | /ventas        -> lista
POST   /{coleccion}                            -> crea (el id viene en el body)
PATCH  /{coleccion}/{id}                       -> actualiza campos
DELETE /{coleccion}/{id}                       -> elimina
```

Si `VITE_API_TOKEN` está definido se envía como `Authorization: Bearer <token>`.

Para otra base de datos (Firebase, MongoDB Atlas…) crea un adaptador nuevo con los métodos `list`, `create`, `update` y `remove`, y agrégalo en `storage.js`.

### Migrar los datos locales a la base de datos

1. En *Datos y respaldo*, descarga el respaldo.
2. Cambia `VITE_STORAGE` y reinicia.
3. En *Datos y respaldo*, importa el archivo.

## Consumo de datos

Para gastar poca transferencia en bases de datos remotas:

- Al abrir la app se cargan todos los productos, pero solo las compras y ventas de los últimos `VITE_HISTORIAL_MESES` meses (12 por defecto). El respaldo siempre incluye todo.
- Después de guardar algo, solo se actualiza en pantalla lo que cambió; no se vuelve a descargar todo.
- Para ver cambios hechos desde otro equipo, usa **↻ Actualizar datos** en el menú.

## Nota sobre consistencia

Al registrar una compra o una venta, la app guarda el movimiento y luego ajusta el stock de cada producto con llamadas separadas. En local no importa, pero con varios usuarios a la vez en una base de datos remota conviene mover esa lógica ([src/data/services.js](src/data/services.js)) a una transacción en el servidor (por ejemplo, una función RPC en Supabase).

## Estructura

```
src/
  config.js               variables de entorno
  data/
    storage.js            elige el adaptador
    adapters/             local, api, supabase
    services.js           reglas de negocio (compras, ventas, stock, respaldo)
    stats.js              cálculos de estadísticas y faltantes
    DataContext.jsx       estado global y acciones para React
    sampleData.js         datos de ejemplo
  components/             Modal, ItemsEditor, ProductForm, StatCard, StockBadge
  pages/                  Resumen, Inventario, Compras, Ventas, Faltantes, Ajustes
```
