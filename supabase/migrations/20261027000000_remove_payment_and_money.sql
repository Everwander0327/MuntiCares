-- Remove all payment / money-related data from the MuntiCares schema.
-- Apply with: supabase db push  (or run in the Supabase SQL Editor)

-- 1. Drop the unused transactions table (and its RLS policies).
DROP TABLE IF EXISTS public.transactions CASCADE;

-- 2. Remove the per-provider rate column.
ALTER TABLE public.providers DROP COLUMN IF EXISTS price_per_service;

-- 3. Remove the booking price snapshot column.
ALTER TABLE public.requests DROP COLUMN IF EXISTS price;
