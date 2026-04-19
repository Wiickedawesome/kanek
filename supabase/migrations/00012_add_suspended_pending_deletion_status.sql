-- Add suspended_pending_deletion to account_status enum.
-- This value is used by delete-account edge function and reactivate_account RPC
-- but was never added to the Postgres enum type.
ALTER TYPE public.account_status ADD VALUE IF NOT EXISTS 'suspended_pending_deletion';
