-- Wrap the "approved" payment cascade in a single transaction.
-- Called by ekyash-callback edge function on statusPay=3 (approved).

CREATE OR REPLACE FUNCTION process_ekyash_payment(
  p_order_id text,
  p_transaction_id text,
  p_callback_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn record;
  v_payer_email text;
  v_result jsonb;
BEGIN
  -- 1. Update transaction record (idempotency: skip if already processed)
  UPDATE ekyash_transactions
  SET transaction_id  = p_transaction_id,
      status          = 'approved',
      callback_received = true,
      callback_payload  = p_callback_payload,
      updated_at        = now()
  WHERE order_id = p_order_id
    AND callback_received = false
  RETURNING * INTO v_txn;

  -- Nothing to update — already processed or not found
  IF v_txn IS NULL THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  -- 2. Confirm related booking
  UPDATE bookings
  SET status     = 'confirmed',
      updated_at = now()
  WHERE ekyash_invoice_id = v_txn.invoice_id;

  -- 3. Activate contract
  UPDATE contracts
  SET status = 'active'
  WHERE id = v_txn.contract_id;

  -- 4. Create notifications for both parties
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES
    (
      v_txn.payer_id,
      'payment_sent',
      'Payment Sent',
      'Your E-Kyash payment of $' || to_char(v_txn.amount_cents / 100.0, 'FM999990.00') || ' BZD was approved.',
      jsonb_build_object('contractId', v_txn.contract_id, 'orderId', p_order_id)
    ),
    (
      v_txn.payee_id,
      'payment_received',
      'Payment Received',
      'You received an E-Kyash payment of $' || to_char(v_txn.amount_cents / 100.0, 'FM999990.00') || ' BZD.',
      jsonb_build_object('contractId', v_txn.contract_id, 'orderId', p_order_id)
    );

  -- 5. Look up payer email for potential receipt
  SELECT email INTO v_payer_email
  FROM profiles
  WHERE id = v_txn.payer_id;

  v_result := jsonb_build_object(
    'status',      'ok',
    'txn_id',      v_txn.id,
    'payer_id',    v_txn.payer_id,
    'payer_email', v_payer_email,
    'contract_id', v_txn.contract_id
  );

  RETURN v_result;
END;
$$;
