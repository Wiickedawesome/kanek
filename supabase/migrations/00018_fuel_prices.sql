-- Fuel price configuration table
-- Belize government sets fuel prices (changes infrequently)
-- This table allows updating the price without redeploying the app

create table if not exists public.fuel_prices (
  id          uuid primary key default gen_random_uuid(),
  fuel_type   text not null default 'regular',
  price_bzd_per_litre numeric(6,3) not null,
  updated_at  timestamptz not null default now(),
  source      text, -- e.g. 'globalpetrolprices.com', 'manual'
  unique (fuel_type)
);

-- Seed with current Belize gasoline price (Mar 13, 2026 — $13.02 BZD/imp gal)
insert into public.fuel_prices (fuel_type, price_bzd_per_litre, source)
values ('regular', 2.864, 'belize-gov')
on conflict (fuel_type) do update
  set price_bzd_per_litre = excluded.price_bzd_per_litre,
      updated_at = now(),
      source = excluded.source;

-- Everyone can read fuel prices
alter table public.fuel_prices enable row level security;

create policy "Anyone can read fuel prices"
  on public.fuel_prices for select
  using (true);
