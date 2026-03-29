-- fuel_prices table is no longer needed — fuel cost estimates
-- now derive from community-reported gas_prices (crowdsourced).
drop table if exists public.fuel_prices;
