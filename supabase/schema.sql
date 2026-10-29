-- Esquema para usar Beltronic con Supabase (PostgreSQL).
-- Ejecútalo en Supabase > SQL Editor. Las columnas usan camelCase
-- (entre comillas) para coincidir con los campos de la app.

create table if not exists productos (
  id text primary key,
  codigo text default '',
  nombre text not null,
  categoria text default 'General',
  unidad text default 'unidad',
  proveedor text default '',
  "precioCompra" numeric default 0,
  "precioVenta" numeric default 0,
  stock numeric default 0,
  "stockMinimo" numeric default 0,
  "creadoEn" timestamptz default now(),
  "actualizadoEn" timestamptz default now()
);

create table if not exists proveedores (
  id text primary key,
  nombre text not null,
  contacto text default '',
  telefono text default '',
  email text default '',
  notas text default '',
  "creadoEn" timestamptz default now()
);

create table if not exists compras (
  id text primary key,
  fecha date not null,
  proveedor text default '',
  factura text default '',
  notas text default '',
  items jsonb not null default '[]',
  total numeric default 0,
  estado text default 'recibida',
  "recibidaEn" timestamptz,
  "creadoEn" timestamptz default now()
);

-- Para bases creadas antes de que existiera el estado de las compras.
-- Las compras que ya estaban quedan como recibidas (ya habían sumado su stock).
alter table compras add column if not exists estado text default 'recibida';
alter table compras add column if not exists "recibidaEn" timestamptz;

create table if not exists ventas (
  id text primary key,
  fecha date not null,
  cliente text default '',
  items jsonb not null default '[]',
  total numeric default 0,
  costo numeric default 0,
  "creadoEn" timestamptz default now()
);

-- IMPORTANTE: estas políticas permiten acceso total con la anon key, útil solo
-- para empezar. Antes de usarlo en producción agrega autenticación y restringe
-- las políticas a usuarios autenticados.
alter table productos enable row level security;
alter table proveedores enable row level security;
alter table compras enable row level security;
alter table ventas enable row level security;

create policy "acceso abierto productos" on productos for all using (true) with check (true);
create policy "acceso abierto proveedores" on proveedores for all using (true) with check (true);
create policy "acceso abierto compras" on compras for all using (true) with check (true);
create policy "acceso abierto ventas" on ventas for all using (true) with check (true);

-- Índices para que filtrar compras y ventas por fecha sea rápido.
create index if not exists compras_fecha_idx on compras (fecha);
create index if not exists ventas_fecha_idx on ventas (fecha);
