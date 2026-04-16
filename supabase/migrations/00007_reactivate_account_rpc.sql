-- Reactivate account RPC
-- Called when a user with suspended_pending_deletion signs back in within 90 days.
-- Clears deleted_at and restores account_status to 'active'.

CREATE OR REPLACE FUNCTION public.reactivate_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET account_status = 'active',
      deleted_at = NULL,
      deletion_reason = NULL
  WHERE id = auth.uid()
    AND account_status = 'suspended_pending_deletion'
    AND deleted_at IS NOT NULL
    AND deleted_at > (now() - interval '90 days');
END;
$$;
